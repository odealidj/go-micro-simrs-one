package handlers

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	rawatjalanpb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// RegistrationHandler handles /registrations/* and /registration/* routes.
type RegistrationHandler struct {
	svc *ports.ServicePorts
	rdb *redis.Client
}

func (h *RegistrationHandler) validateDepartmentCode(ctx context.Context, deptCode string) bool {
	if deptCode == "" {
		return false
	}
	// 1. Check Redis Hash
	if h.rdb != nil {
		if exists, err := h.rdb.HExists(ctx, "master:polyclinics", deptCode).Result(); err == nil && exists {
			return true
		}
	}
	// 2. Fallback to RawatJalanService
	res, err := h.svc.RawatJalan.GetPolyclinics(ctx, &rawatjalanpb.GetPolyclinicsRequest{
		Page:     1,
		PageSize: 100,
	})
	if err == nil && res != nil {
		for _, p := range res.Data {
			// Populate cache
			if h.rdb != nil {
				_ = h.rdb.HSet(ctx, "master:polyclinics", p.Code, p.Name).Err()
			}
			if p.Code == deptCode {
				return true
			}
		}
	}
	return false
}

func NewRegistrationHandler(svc *ports.ServicePorts, rdb *redis.Client) *RegistrationHandler {
	return &RegistrationHandler{svc: svc, rdb: rdb}
}

// Register mounts routes (caller must apply RequireRole middleware).
func (h *RegistrationHandler) Register(r chi.Router) {
	// Dashboard & Today Encounters
	r.Get("/registrations/dashboard/metrics", h.DashboardMetrics)
	r.Get("/registration/dashboard/metrics", h.DashboardMetrics)
	r.Get("/registrations/today", h.TodayEncounters)
	r.Get("/registration/encounters/today", h.TodayEncounters)

	// Encounters
	r.Post("/registrations", h.RegisterEncounter)
	r.Post("/registration/encounter", h.RegisterEncounter)
	r.Post("/registrations/cancel", h.CancelEncounter)
	r.Post("/registration/encounter/{encounter_no}/cancel", h.CancelEncounter)
	r.Put("/registrations/guarantor", h.UpdateGuarantor)
	r.Put("/registration/encounter/{encounter_no}/guarantor", h.UpdateGuarantor)

	// New Patient & OCR
	r.Post("/registrations/new-patient", h.NewPatient)
	r.Post("/registrations/ocr-ktp", h.OCRKTP)
}

func (h *RegistrationHandler) DashboardMetrics(w http.ResponseWriter, r *http.Request) {
	// 1. Get metrics from Registration Service
	regMetrics, err := h.svc.Registration.GetDashboardMetrics(r.Context(), &regpb.GetDashboardMetricsRequest{})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	// 2. Get metrics from Auth Service
	authMetrics, err := h.svc.Auth.GetActivePersonnelMetrics(r.Context(), &authpb.GetActivePersonnelMetricsRequest{})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	// 3. Combine metrics
	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Dashboard metrics fetched successfully",
		Data: map[string]interface{}{
			"new_patients":   regMetrics.NewPatients,
			"old_patients":   regMetrics.OldPatients,
			"wait_times":     regMetrics.WaitTimes,
			"weekly_visits":  regMetrics.WeeklyVisits,
			"active_polis":   authMetrics.ActiveClinics,
			"active_doctors": authMetrics.ActiveDoctors,
			"active_nurses":  authMetrics.ActiveNurses,
		},
	})
}

func (h *RegistrationHandler) TodayEncounters(w http.ResponseWriter, r *http.Request) {
	dateStr := r.URL.Query().Get("date")
	queueOnly := r.URL.Query().Get("queue_only") == "true"

	reqDate := dateStr
	if reqDate == "TODAY" || reqDate == time.Now().Format("2006-01-02") {
		reqDate = ""
	}

	// 1. Get encounters from Registration Service
	resReg, err := h.svc.Registration.GetTodayEncounters(r.Context(), &regpb.GetTodayEncountersRequest{
		Page: 1, PageSize: 100, Date: reqDate,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	// 2. Map and enrich with Patient names and Status Pasien Baru/Lama
	type EnrichedEncounter struct {
		EncounterNo    string `json:"encounter_no"`
		MRN            string `json:"mrn"`
		PatientName    string `json:"patient_name"`
		Gender         string `json:"gender"`
		DateOfBirth    string `json:"date_of_birth"`
		DepartmentCode string `json:"department_code"`
		DoctorID       string `json:"doctor_id"`
		PerawatID      string `json:"perawat_id"`
		Status         string `json:"status"`
		StatusPasien   string `json:"status_pasien"` // "Baru RS" or "Lama RS"
		RegisteredTime string `json:"registered_time"`
	}

	var enriched []EnrichedEncounter

	for _, enc := range resReg.Encounters {
		if queueOnly {
			if enc.Status != "QUEUED" && enc.Status != "QUEUED_FOR_POLI" && enc.Status != "WAITING_FOR_TRIAGE" && enc.Status != "IN_PROGRESS" {
				continue
			}
		}

		var pName = "-"
		var pGender = "-"
		var pDob = "-"

		mrnClean := strings.TrimSpace(enc.Mrn)
		resPat, errPat := h.svc.Patient.GetPatientByMRN(r.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrnClean})
		if errPat == nil && resPat != nil && resPat.Patient != nil {
			pName = resPat.Patient.Name
			pGender = resPat.Patient.Gender
			pDob = resPat.Patient.Dob
		} else if errPat != nil {
			if st, ok := status.FromError(errPat); !ok || st.Code() != codes.NotFound {
				slog.Warn("Failed to fetch patient for encounter", "mrn", mrnClean, "err", errPat)
			}
		}

		parts := strings.Split(enc.RegisteredTime, "|")
		regTime := parts[0]
		isNew := "Lama RS"
		if len(parts) > 1 && parts[1] == "true" {
			isNew = "Baru RS"
		}

		enriched = append(enriched, EnrichedEncounter{
			EncounterNo:    enc.EncounterNo,
			MRN:            enc.Mrn,
			PatientName:    pName,
			Gender:         pGender,
			DateOfBirth:    pDob,
			DepartmentCode: enc.DepartmentCode,
			DoctorID:       enc.DoctorId,
			PerawatID:      enc.PerawatId,
			Status:         enc.Status,
			StatusPasien:   isNew,
			RegisteredTime: regTime,
		})
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data: map[string]interface{}{
			"encounters": enriched,
			"total":      len(enriched),
		},
	})
}

func (h *RegistrationHandler) RegisterEncounter(w http.ResponseWriter, r *http.Request) {
	var payload regpb.RegisterEncounterRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"mrn":             validator.NotEmpty(payload.Mrn),
		"department_code": validator.NotEmpty(payload.DepartmentCode),
		"guarantor":       validator.NotEmpty(payload.Guarantor),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}

	if !h.validateDepartmentCode(r.Context(), payload.DepartmentCode) {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
			Success: false,
			Message: "Kode poliklinik tidak valid atau tidak terdaftar di master rawat jalan",
		})
		return
	}

	// Validasi jadwal dokter hari ini (Prioritas 1: Piket, Prioritas 2: Jadwal Reguler)
	var piketDoctorID, piketNurseID string
	dbConnPiket, errPiket := db.ConnectPostgres("")
	if errPiket == nil {
		defer dbConnPiket.Close()
		_ = dbConnPiket.QueryRowContext(r.Context(), `
			SELECT dokter_id::text, COALESCE(perawat_id::text, '')
			FROM auth.jadwal_piket_poli
			WHERE poli_code = $1 AND piket_date = CURRENT_DATE
			LIMIT 1
		`, payload.DepartmentCode).Scan(&piketDoctorID, &piketNurseID)
	}

	todayWeekday := int32(time.Now().Weekday())
	if todayWeekday == 0 {
		todayWeekday = 7
	}

	if piketDoctorID != "" {
		payload.DoctorId = piketDoctorID
		if payload.PerawatId == "" && piketNurseID != "" {
			payload.PerawatId = piketNurseID
		}
	} else {
		docRes, errDoc := h.svc.Auth.GetDoctorsByPoli(r.Context(), &authpb.GetDoctorsByPoliRequest{
			PoliCode:  payload.DepartmentCode,
			Page:      1,
			PageSize:  50,
			DayOfWeek: todayWeekday,
		})
		if errDoc != nil || docRes == nil || len(docRes.Data) == 0 {
			response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
				Success: false,
				Message: "Tidak ada jadwal dokter yang bertugas di poliklinik ini pada hari ini. Pendaftaran kunjungan tidak dapat diproses.",
			})
			return
		}

		if payload.DoctorId == "" {
			payload.DoctorId = docRes.Data[0].Id
		} else {
			doctorFound := false
			for _, d := range docRes.Data {
				if d.Id == payload.DoctorId {
					doctorFound = true
					break
				}
			}
			if !doctorFound {
				payload.DoctorId = docRes.Data[0].Id
			}
		}
	}

	nurseRes, errNurse := h.svc.Auth.GetNursesByPoli(r.Context(), &authpb.GetNursesByPoliRequest{
		PoliCode:  payload.DepartmentCode,
		Page:      1,
		PageSize:  50,
		DayOfWeek: todayWeekday,
	})
	if errNurse == nil && nurseRes != nil && len(nurseRes.Data) > 0 {
		if payload.PerawatId == "" {
			payload.PerawatId = nurseRes.Data[0].Id
		} else {
			nurseFound := false
			for _, n := range nurseRes.Data {
				if n.Id == payload.PerawatId {
					nurseFound = true
					break
				}
			}
			if !nurseFound {
				payload.PerawatId = nurseRes.Data[0].Id
			}
		}
	} else {
		payload.PerawatId = ""
	}

	res, err := h.svc.Registration.RegisterEncounter(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	if payload.Guarantor == "Umum" {
		fee := 150000.0
		if payload.DepartmentCode == "UMU" || payload.DepartmentCode == "01" || payload.DepartmentCode == "Poli Umum" || payload.DepartmentCode == "POLI_UMUM" {
			fee = 50000.0
		}
		_, errBilling := h.svc.Billing.AddRegistrationFee(r.Context(), &billingpb.AddRegistrationFeeRequest{
			EncounterNo:    res.EncounterNo,
			DepartmentCode: payload.DepartmentCode,
			Amount:         fee,
		})
		if errBilling != nil {
			log.Printf("Failed to add registration fee to billing: %v", errBilling)
		}
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Encounter registered",
		Data:    res,
	})
}

func (h *RegistrationHandler) CancelEncounter(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	var payload regpb.CancelEncounterRequest

	if r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&payload)
	}
	if payload.EncounterNo == "" {
		payload.EncounterNo = encounterNo
	}
	if payload.EncounterNo == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "encounter_no is required"})
		return
	}
	if payload.Reason == "" {
		payload.Reason = "Dibatalkan oleh petugas admisi"
	}

	res, err := h.svc.Registration.CancelEncounter(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RegistrationHandler) UpdateGuarantor(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	var payload regpb.UpdateEncounterGuarantorRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if payload.EncounterNo == "" {
		payload.EncounterNo = encounterNo
	}
	if payload.EncounterNo == "" || payload.Guarantor == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "encounter_no and guarantor are required"})
		return
	}

	res, err := h.svc.Registration.UpdateEncounterGuarantor(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RegistrationHandler) NewPatient(w http.ResponseWriter, r *http.Request) {
	type NewPatientRegistrationPayload struct {
		Name           string `json:"name"`
		Nik            string `json:"nik"`
		Dob            string `json:"dob"` // YYYY-MM-DD
		Gender         string `json:"gender"`
		BirthPlace     string `json:"birth_place"`
		Address        string `json:"address"`
		DepartmentCode string `json:"department_code"`
		DoctorId       string `json:"doctor_id"`
		PerawatId      string `json:"perawat_id"`
		Guarantor      string `json:"guarantor"` // Umum or BPJS
		Email          string `json:"email"`
	}

	var payload NewPatientRegistrationPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}

	if err := validator.ValidateAll(map[string]func() error{
		"name":            validator.NotEmpty(payload.Name),
		"nik":             validator.NotEmpty(payload.Nik),
		"dob":             validator.IsDate(payload.Dob),
		"department_code": validator.NotEmpty(payload.DepartmentCode),
		"guarantor":       validator.NotEmpty(payload.Guarantor),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}

	if !h.validateDepartmentCode(r.Context(), payload.DepartmentCode) {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
			Success: false,
			Message: "Kode poliklinik tidak valid atau tidak terdaftar di master rawat jalan",
		})
		return
	}

	// Validasi jadwal dokter hari ini
	var piketDoctorID, piketNurseID string
	dbConnPiket, errPiket := db.ConnectPostgres("")
	if errPiket == nil {
		defer dbConnPiket.Close()
		_ = dbConnPiket.QueryRowContext(r.Context(), `
			SELECT dokter_id::text, COALESCE(perawat_id::text, '')
			FROM auth.jadwal_piket_poli
			WHERE poli_code = $1 AND piket_date = CURRENT_DATE
			LIMIT 1
		`, payload.DepartmentCode).Scan(&piketDoctorID, &piketNurseID)
	}

	todayWeekday := int32(time.Now().Weekday())
	if todayWeekday == 0 {
		todayWeekday = 7
	}

	if piketDoctorID != "" {
		payload.DoctorId = piketDoctorID
		if payload.PerawatId == "" && piketNurseID != "" {
			payload.PerawatId = piketNurseID
		}
	} else {
		docRes, errDoc := h.svc.Auth.GetDoctorsByPoli(r.Context(), &authpb.GetDoctorsByPoliRequest{
			PoliCode:  payload.DepartmentCode,
			Page:      1,
			PageSize:  50,
			DayOfWeek: todayWeekday,
		})
		if errDoc != nil || docRes == nil || len(docRes.Data) == 0 {
			response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
				Success: false,
				Message: "Tidak ada jadwal dokter yang bertugas di poliklinik ini pada hari ini. Pendaftaran kunjungan tidak dapat diproses.",
			})
			return
		}

		if payload.DoctorId == "" {
			payload.DoctorId = docRes.Data[0].Id
		} else {
			doctorFound := false
			for _, d := range docRes.Data {
				if d.Id == payload.DoctorId {
					doctorFound = true
					break
				}
			}
			if !doctorFound {
				payload.DoctorId = docRes.Data[0].Id
			}
		}
	}

	nurseRes, errNurse := h.svc.Auth.GetNursesByPoli(r.Context(), &authpb.GetNursesByPoliRequest{
		PoliCode:  payload.DepartmentCode,
		Page:      1,
		PageSize:  50,
		DayOfWeek: todayWeekday,
	})
	if errNurse == nil && nurseRes != nil && len(nurseRes.Data) > 0 {
		if payload.PerawatId == "" {
			payload.PerawatId = nurseRes.Data[0].Id
		} else {
			nurseFound := false
			for _, n := range nurseRes.Data {
				if n.Id == payload.PerawatId {
					nurseFound = true
					break
				}
			}
			if !nurseFound {
				payload.PerawatId = nurseRes.Data[0].Id
			}
		}
	} else {
		payload.PerawatId = ""
	}

	// SAGA 1: Register User in Auth Service
	authRes, err := h.svc.Auth.RegisterPatientUser(r.Context(), &authpb.RegisterPatientUserRequest{
		Username: payload.Nik,
		Password: payload.Dob,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	// SAGA 2: Register Patient in Patient Service
	patientRes, err := h.svc.Patient.RegisterPatient(r.Context(), &patientpb.RegisterPatientRequest{
		Name:       payload.Name,
		Nik:        payload.Nik,
		Dob:        payload.Dob,
		Gender:     payload.Gender,
		BirthPlace: payload.BirthPlace,
		Address:    payload.Address,
		Email:      payload.Email,
		UserId:     authRes.UserId,
	})
	if err != nil {
		log.Printf("SAGA: Rollback Auth User %s due to Patient creation failure", authRes.UserId)
		_, _ = h.svc.Auth.DeleteUser(context.Background(), &authpb.DeleteUserRequest{
			UserId:     authRes.UserId,
			HardDelete: true,
		})
		response.HandleGRPCError(w, err)
		return
	}

	// SAGA 3: Register Encounter in Registration Service
	regRes, err := h.svc.Registration.RegisterEncounter(r.Context(), &regpb.RegisterEncounterRequest{
		Mrn:            patientRes.Mrn,
		DepartmentCode: payload.DepartmentCode,
		DoctorId:       payload.DoctorId,
		PerawatId:      payload.PerawatId,
		Guarantor:      payload.Guarantor,
	})
	if err != nil {
		log.Printf("SAGA: Rollback Patient %s and Auth User %s", patientRes.Mrn, authRes.UserId)
		_, _ = h.svc.Patient.DeletePatient(context.Background(), &patientpb.DeletePatientRequest{
			Mrn: patientRes.Mrn,
		})
		_, _ = h.svc.Auth.DeleteUser(context.Background(), &authpb.DeleteUserRequest{
			UserId:     authRes.UserId,
			HardDelete: true,
		})
		response.HandleGRPCError(w, err)
		return
	}

	// SAGA 4: Optional Registration Fee for Umum
	if payload.Guarantor == "Umum" {
		fee := 150000.0
		if payload.DepartmentCode == "UMU" || payload.DepartmentCode == "01" || payload.DepartmentCode == "Poli Umum" || payload.DepartmentCode == "POLI_UMUM" {
			fee = 50000.0
		}
		_, errBilling := h.svc.Billing.AddRegistrationFee(r.Context(), &billingpb.AddRegistrationFeeRequest{
			EncounterNo:    regRes.EncounterNo,
			DepartmentCode: payload.DepartmentCode,
			Amount:         fee,
		})
		if errBilling != nil {
			log.Printf("SAGA: Failed to add registration fee: %v", errBilling)
		}
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Patient & Encounter created successfully",
		Data: map[string]interface{}{
			"mrn":          patientRes.Mrn,
			"encounter_no": regRes.EncounterNo,
		},
	})
}

func (h *RegistrationHandler) OCRKTP(w http.ResponseWriter, r *http.Request) {
	HandleOCRKTP(w, r)
}
