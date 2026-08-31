package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	rawatjalanpb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
	"github.com/go-chi/chi/v5"
)

// RawatJalanHandler handles /rawat-jalan/*, /emr/*, dan /rekam-medis/* routes.
// Routes di-split dalam 3 group berdasarkan role:
//   - EMR group (dokter, perawat, rekam_medis)
//   - Rawat Jalan group (dokter, perawat, admin, super_admin)
//   - Rekam Medis group (rekam_medis, admin, super_admin, dokter)
type RawatJalanHandler struct {
	svc *ports.ServicePorts
}

func NewRawatJalanHandler(svc *ports.ServicePorts) *RawatJalanHandler {
	return &RawatJalanHandler{svc: svc}
}

// RegisterEMR mounts /emr/* routes (caller applies RequireRole dokter,perawat,rekam_medis).
func (h *RawatJalanHandler) RegisterEMR(r chi.Router) {
	r.Get("/emr/my-poli", h.GetMyPoli)
	r.Post("/emr/triage", h.Triage)
	r.Post("/emr/start", h.StartEncounter)
	r.Post("/emr/complete", h.CompleteEncounter)
	r.Post("/emr/diagnosis", h.AddDiagnosis)
	r.Put("/emr/diagnosis/{id}", h.UpdateDiagnosis)
	r.Delete("/emr/diagnosis/{id}", h.RemoveDiagnosis)
	r.Post("/emr/encounter/{encounter_no}/severity/finalize", h.FinalizeSeverity)
	r.Post("/emr/diagnosis/{id}/verify-kbm", h.VerifyKBM)
	r.Post("/emr/actions", h.AddAction)
	r.Delete("/emr/actions/{id}", h.RemoveAction)
	r.Get("/emr/record/{encounter_no}", h.GetRecord)
	// KBM lookup (dokter, perawat only — subset of EMR group)
	r.Get("/emr/kbm/search", h.SearchKBM)
	r.Get("/emr/kbm/{code}", h.GetKBMDetail)
}

// RegisterEMRVerify mounts KBM verification routes (dokter, admin, rekam_medis).
func (h *RawatJalanHandler) RegisterEMRVerify(r chi.Router) {
	r.Get("/emr/pending-kbm-verifications", h.PendingKBMVerifications)
	r.Get("/emr/icd10/{code}/kbm-suggestions", h.ICD10KBMSuggestions)
}

// RegisterRawatJalan mounts /rawat-jalan/* routes (caller applies RequireRole dokter,perawat,admin,super_admin).
func (h *RawatJalanHandler) RegisterRawatJalan(r chi.Router) {
	r.Post("/rawat-jalan/triage", h.RawatJalanTriage)
	r.Post("/rawat-jalan/encounter/start", h.RawatJalanStartEncounter)
	r.Post("/rawat-jalan/encounter/reset", h.RawatJalanResetEncounter)
	r.Post("/rawat-jalan/encounter/complete", h.RawatJalanCompleteEncounter)
	r.Post("/rawat-jalan/diagnosis", h.RawatJalanAddDiagnosis)
	r.Put("/rawat-jalan/diagnosis/{id}", h.RawatJalanUpdateDiagnosis)
	r.Delete("/rawat-jalan/diagnosis/{id}", h.RawatJalanRemoveDiagnosis)
	r.Post("/rawat-jalan/diagnosis/{id}/promote", h.RawatJalanPromoteDiagnosis)
	r.Post("/rawat-jalan/encounter/{encounter_no}/severity/finalize", h.RawatJalanFinalizeSeverity)
	r.Post("/rawat-jalan/actions", h.RawatJalanAddAction)
	r.Delete("/rawat-jalan/actions/{id}", h.RawatJalanRemoveAction)
	r.Get("/rawat-jalan/record/{encounter_no}", h.RawatJalanGetRecord)
	r.Get("/rawat-jalan/kbm/search", h.RawatJalanSearchKBM)
	r.Get("/rawat-jalan/kbm/{code}", h.RawatJalanGetKBMDetail)
	r.Get("/rawat-jalan/icd10/{code}/kbm-suggestions", h.RawatJalanICD10KBMSuggestions)
	r.Get("/rawat-jalan/master/tindakan/poli/{poli_code}", h.RawatJalanMasterTindakanByPoli)
	r.Get("/rawat-jalan/master/icd10/poli/{poli_code}", h.RawatJalanMasterICD10ByPoli)
	r.Get("/rawat-jalan/master/kbm/poli/{poli_code}", h.RawatJalanMasterKBMsByPoli)
}

// RegisterRekamMedis mounts /rekam-medis/* routes (caller applies RequireRole rekam_medis,admin,super_admin,dokter).
func (h *RawatJalanHandler) RegisterRekamMedis(r chi.Router) {
	r.Get("/rekam-medis/record/{encounter_no}", h.RekamMedisGetRecord)
	r.Post("/rekam-medis/coding/verify-kbm/{id}", h.RekamMedisVerifyKBM)
	r.Get("/rekam-medis/coding/pending-kbm", h.RekamMedisPendingKBM)
}

// ── EMR ───────────────────────────────────────────────────────────────────────

func (h *RawatJalanHandler) GetMyPoli(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("user_id").(string)
	res, err := h.svc.Auth.GetAssignedPoli(r.Context(), &authpb.GetAssignedPoliRequest{UserId: userID})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) Triage(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.SubmitTriageRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.SubmitTriage(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) StartEncounter(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.StartEncounterRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"encounter_no": validator.NotEmpty(payload.EncounterNo),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.StartEncounter(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	// Best-effort: sync status to registration
	_, _ = h.svc.Registration.UpdateEncounterStatus(r.Context(), &regpb.UpdateEncounterStatusRequest{
		EncounterNo: payload.EncounterNo, Status: "IN_PROGRESS",
	})
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) CompleteEncounter(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.CompleteEncounterRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"encounter_no": validator.NotEmpty(payload.EncounterNo),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.CompleteEncounter(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	_, _ = h.svc.Registration.UpdateEncounterStatus(r.Context(), &regpb.UpdateEncounterStatusRequest{
		EncounterNo: payload.EncounterNo, Status: "COMPLETED",
	})
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Pemeriksaan pasien berhasil diselesaikan", Data: res})
}

func (h *RawatJalanHandler) AddDiagnosis(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.AddEncounterDiagnosisRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"encounter_no":   validator.NotEmpty(payload.EncounterNo),
		"icd10_code":     validator.NotEmpty(payload.Icd10Code),
		"diagnosis_type": validator.NotEmpty(payload.DiagnosisType),
		"severity_level": validator.NotEmpty(payload.SeverityLevel),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.AddEncounterDiagnosis(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) UpdateDiagnosis(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.UpdateEncounterDiagnosisRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	payload.Id = chi.URLParam(r, "id")
	res, err := h.svc.RawatJalan.UpdateEncounterDiagnosis(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RemoveDiagnosis(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	res, err := h.svc.RawatJalan.RemoveEncounterDiagnosis(r.Context(), &rawatjalanpb.RemoveEncounterDiagnosisRequest{Id: id})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) FinalizeSeverity(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	var payload struct {
		SeverityLevel string `json:"severity_level"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	userID, _ := r.Context().Value("user_id").(string)
	res, err := h.svc.RawatJalan.FinalizeSeverity(r.Context(), &rawatjalanpb.FinalizeSeverityRequest{
		EncounterNo: encounterNo, SeverityLevel: payload.SeverityLevel, UserId: userID,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Severity finalized successfully", Data: res})
}

func (h *RawatJalanHandler) VerifyKBM(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var payload struct {
		KbmCode string `json:"kbm_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	userID, _ := r.Context().Value("user_id").(string)
	res, err := h.svc.EMR.VerifyKBMMapping(r.Context(), &emrpb.VerifyKBMMappingRequest{Id: id, KbmCode: payload.KbmCode, UserId: userID})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "KBM mapped successfully", Data: res})
}

func (h *RawatJalanHandler) AddAction(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.AddMedicalActionRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.AddMedicalAction(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RemoveAction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	encounterNo := r.URL.Query().Get("encounter_no")
	actionCode := r.URL.Query().Get("action_code")

	// Guard: jangan hapus jika tindakan sudah dibayar
	if encounterNo != "" && actionCode != "" {
		invRes, errInv := h.svc.Billing.GetActionPaymentStatus(r.Context(), &billingpb.GetActionPaymentStatusRequest{
			EncounterNo: encounterNo,
			ActionCode:  actionCode,
		})
		if errInv == nil && invRes != nil && invRes.IsFound && invRes.IsPaid {
			response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{
				Success: false, Message: "Tindakan tidak dapat dihapus karena tagihan tindakan sudah dibayar di kasir.",
			})
			return
		}
	}

	res, err := h.svc.RawatJalan.RemoveMedicalAction(r.Context(), &rawatjalanpb.RemoveMedicalActionRequest{
		Id: id, EncounterNo: encounterNo,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Tindakan medis berhasil dihapus", Data: res})
}

func (h *RawatJalanHandler) GetRecord(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.EMR.GetMedicalRecord(r.Context(), &emrpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) SearchKBM(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.SearchKBM(r.Context(), &emrpb.SearchKBMRequest{
		Query: r.URL.Query().Get("q"), DepartmentCode: r.URL.Query().Get("dept_code"), Limit: 20,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) GetKBMDetail(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetKBMDetail(r.Context(), &emrpb.GetKBMDetailRequest{KbmCode: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) PendingKBMVerifications(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.ListPendingKBMVerifications(r.Context(), &emrpb.ListPendingKBMVerificationsRequest{})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) ICD10KBMSuggestions(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetKBMSuggestionsForICD10(r.Context(), &emrpb.GetKBMSuggestionsForICD10Request{Icd10Code: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ── Rawat Jalan ───────────────────────────────────────────────────────────────

func (h *RawatJalanHandler) RawatJalanTriage(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.SubmitTriageRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.SubmitTriage(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	_, _ = h.svc.Registration.UpdateEncounterStatus(r.Context(), &regpb.UpdateEncounterStatusRequest{
		EncounterNo: payload.EncounterNo, Status: "IN_PROGRESS",
	})
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanStartEncounter(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.StartEncounterRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"encounter_no": validator.NotEmpty(payload.EncounterNo),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.StartEncounter(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	_, _ = h.svc.Registration.UpdateEncounterStatus(r.Context(), &regpb.UpdateEncounterStatusRequest{
		EncounterNo: payload.EncounterNo, Status: "IN_PROGRESS",
	})
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanResetEncounter(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		EncounterNo string `json:"encounter_no"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if payload.EncounterNo == "" {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: "encounter_no is required"})
		return
	}
	// Guard: jangan reset jika sudah CANCELLED/COMPLETED
	medRec, errMed := h.svc.RawatJalan.GetMedicalRecord(r.Context(), &rawatjalanpb.GetMedicalRecordRequest{EncounterNo: payload.EncounterNo})
	if errMed == nil && medRec != nil && (medRec.Status == "CANCELLED" || medRec.Status == "BATAL" || medRec.Status == "COMPLETED") {
		response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Encounter is cancelled or completed; reset skipped"})
		return
	}
	_, _ = h.svc.Registration.UpdateEncounterStatus(r.Context(), &regpb.UpdateEncounterStatusRequest{
		EncounterNo: payload.EncounterNo, Status: "QUEUED_FOR_POLI",
	})
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Encounter status reset to queue"})
}

func (h *RawatJalanHandler) RawatJalanCompleteEncounter(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.CompleteEncounterRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"encounter_no": validator.NotEmpty(payload.EncounterNo),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.CompleteEncounter(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	_, _ = h.svc.Registration.UpdateEncounterStatus(r.Context(), &regpb.UpdateEncounterStatusRequest{
		EncounterNo: payload.EncounterNo, Status: "COMPLETED",
	})
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Pemeriksaan pasien berhasil diselesaikan", Data: res})
}

func (h *RawatJalanHandler) RawatJalanAddDiagnosis(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.AddEncounterDiagnosisRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if err := validator.ValidateAll(map[string]func() error{
		"encounter_no":   validator.NotEmpty(payload.EncounterNo),
		"icd10_code":     validator.NotEmpty(payload.Icd10Code),
		"diagnosis_type": validator.NotEmpty(payload.DiagnosisType),
		"severity_level": validator.NotEmpty(payload.SeverityLevel),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.AddEncounterDiagnosis(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanUpdateDiagnosis(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.UpdateEncounterDiagnosisRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	payload.Id = chi.URLParam(r, "id")
	res, err := h.svc.RawatJalan.UpdateEncounterDiagnosis(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanRemoveDiagnosis(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.RawatJalan.RemoveEncounterDiagnosis(r.Context(), &rawatjalanpb.RemoveEncounterDiagnosisRequest{Id: chi.URLParam(r, "id")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanPromoteDiagnosis(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var payload struct {
		EncounterNo string `json:"encounter_no"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.PromoteDiagnosisToPrimary(r.Context(), &rawatjalanpb.PromoteDiagnosisToPrimaryRequest{
		EncounterNo: payload.EncounterNo, DiagnosisId: id,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanFinalizeSeverity(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	var payload struct {
		SeverityLevel string `json:"severity_level"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	userID, _ := r.Context().Value("user_id").(string)
	res, err := h.svc.RawatJalan.FinalizeSeverity(r.Context(), &rawatjalanpb.FinalizeSeverityRequest{
		EncounterNo: encounterNo, SeverityLevel: payload.SeverityLevel, UserId: userID,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Severity finalized successfully", Data: res})
}

func (h *RawatJalanHandler) RawatJalanAddAction(w http.ResponseWriter, r *http.Request) {
	var payload rawatjalanpb.AddMedicalActionRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.RawatJalan.AddMedicalAction(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanRemoveAction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	encounterNo := r.URL.Query().Get("encounter_no")
	actionCode := r.URL.Query().Get("action_code")
	if encounterNo != "" && actionCode != "" {
		invRes, errInv := h.svc.Billing.GetActionPaymentStatus(r.Context(), &billingpb.GetActionPaymentStatusRequest{
			EncounterNo: encounterNo,
			ActionCode:  actionCode,
		})
		if errInv == nil && invRes != nil && invRes.IsFound && invRes.IsPaid {
			response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{
				Success: false, Message: "Tindakan tidak dapat dihapus karena tagihan tindakan sudah dibayar di kasir.",
			})
			return
		}
	}
	res, err := h.svc.RawatJalan.RemoveMedicalAction(r.Context(), &rawatjalanpb.RemoveMedicalActionRequest{
		Id: id, EncounterNo: encounterNo,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Tindakan medis berhasil dihapus", Data: res})
}

func (h *RawatJalanHandler) RawatJalanGetRecord(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.RawatJalan.GetMedicalRecord(r.Context(), &rawatjalanpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	// Sinkronisasi status resmi dari Registration Service
	var encDate string
	if len(encounterNo) >= 8 {
		encDate = fmt.Sprintf("%s-%s-%s", encounterNo[0:4], encounterNo[4:6], encounterNo[6:8])
	}
	if resReg, errReg := h.svc.Registration.GetTodayEncounters(r.Context(), &regpb.GetTodayEncountersRequest{
		Page: 1, PageSize: 200, Date: encDate,
	}); errReg == nil && resReg != nil {
		for _, enc := range resReg.Encounters {
			if enc.EncounterNo == encounterNo {
				res.Status = enc.Status
				break
			}
		}
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanSearchKBM(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.RawatJalan.SearchKBM(r.Context(), &rawatjalanpb.SearchKBMRequest{
		Query: r.URL.Query().Get("q"), DepartmentCode: r.URL.Query().Get("dept_code"), Limit: 20,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanGetKBMDetail(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.RawatJalan.GetKBMDetail(r.Context(), &rawatjalanpb.GetKBMDetailRequest{KbmCode: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanICD10KBMSuggestions(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.RawatJalan.GetKBMSuggestionsForICD10(r.Context(), &rawatjalanpb.GetKBMSuggestionsForICD10Request{Icd10Code: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RawatJalanMasterTindakanByPoli(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	res, err := h.svc.RawatJalan.GetMasterTindakanByPoli(r.Context(), &rawatjalanpb.GetMasterTindakanByPoliRequest{
		PoliCode:   chi.URLParam(r, "poli_code"),
		Page:       int32(page),
		PageSize:   int32(pageSize),
		SearchName: r.URL.Query().Get("search_name"),
		SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res.Data})
}

func (h *RawatJalanHandler) RawatJalanMasterICD10ByPoli(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	res, err := h.svc.RawatJalan.GetMasterICD10ByPoli(r.Context(), &rawatjalanpb.GetMasterICD10ByPoliRequest{
		PoliCode:   chi.URLParam(r, "poli_code"),
		Page:       int32(page),
		PageSize:   int32(pageSize),
		SearchName: r.URL.Query().Get("search_name"),
		SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res.Data})
}

func (h *RawatJalanHandler) RawatJalanMasterKBMsByPoli(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	res, err := h.svc.RawatJalan.GetMasterKBMsByPoli(r.Context(), &rawatjalanpb.GetMasterKBMsByPoliRequest{
		PoliCode:   chi.URLParam(r, "poli_code"),
		Page:       int32(page),
		PageSize:   int32(pageSize),
		SearchName: r.URL.Query().Get("search_name"),
		SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res.Data})
}

// ── Rekam Medis ───────────────────────────────────────────────────────────────

func (h *RawatJalanHandler) RekamMedisGetRecord(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.EMR.GetMedicalRecord(r.Context(), &emrpb.GetMedicalRecordRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RawatJalanHandler) RekamMedisVerifyKBM(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var payload struct {
		KbmCode string `json:"kbm_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	userID, _ := r.Context().Value("user_id").(string)
	res, err := h.svc.EMR.VerifyKBMMapping(r.Context(), &emrpb.VerifyKBMMappingRequest{
		Id: id, KbmCode: payload.KbmCode, UserId: userID,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "KBM mapped successfully", Data: res})
}

func (h *RawatJalanHandler) RekamMedisPendingKBM(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.ListPendingKBMVerifications(r.Context(), &emrpb.ListPendingKBMVerificationsRequest{})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}
