package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/db"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	authpb "github.com/aliube/go-micro-simrs-one/shared/proto/auth/v1"
	emrpb "github.com/aliube/go-micro-simrs-one/shared/proto/emr/v1"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
	"github.com/go-chi/chi/v5"
)

// MasterHandler handles /master/* read-only routes (all authenticated users).
type MasterHandler struct {
	svc *ports.ServicePorts
}

func NewMasterHandler(svc *ports.ServicePorts) *MasterHandler {
	return &MasterHandler{svc: svc}
}

// Register mounts master data routes.
func (h *MasterHandler) Register(r chi.Router) {
	// Roles & Personnel
	r.Get("/master/roles", h.GetMasterRoles)
	r.Get("/master/doctors", h.GetDoctors)
	r.Get("/master/nurses", h.GetNurses)
	r.Post("/master/doctors/assign", h.AssignDoctor)
	r.Post("/master/nurses/assign", h.AssignNurse)
	r.Post("/master/doctors/unassign", h.UnassignDoctor)
	r.Post("/master/nurses/unassign", h.UnassignNurse)
	r.Get("/master/doctors/poli/{poli_code}", h.GetDoctorsByPoli)
	r.Get("/master/nurses/poli/{poli_code}", h.GetNursesByPoli)

	// Polyclinic Schedules & Piket
	r.Get("/master/polyclinics/{poli_code}/schedule", h.GetPoliSchedule)
	r.Put("/master/polyclinics/{poli_code}/schedule", h.UpdatePoliSchedule)
	r.Get("/master/jadwal-piket", h.GetJadwalPiket)
	r.Post("/master/jadwal-piket", h.CreateJadwalPiket)
	r.Delete("/master/jadwal-piket/{id}", h.DeleteJadwalPiket)

	// Polyclinics
	r.Get("/master/polyclinics", h.GetPolyclinics)
	// KBM
	r.Get("/master/kbm", h.GetKBMs)
	r.Get("/master/kbm/poli/{poli_code}", h.GetKBMsByPoli)
	r.Get("/master/kbm/{code}/icd10-suggestions", h.GetKBMICD10Suggestions)
	// Tindakan
	r.Get("/master/tindakan", h.GetTindakan)
	r.Get("/master/tindakan/poli/{poli_code}", h.GetTindakanByPoli)
	r.Get("/master/tindakan/{code}/icd9-suggestions", h.GetTindakanICD9Suggestions)
	// ICD10
	r.Get("/master/icd10", h.GetICD10)
	r.Get("/master/icd10/poli/{poli_code}", h.GetICD10ByPoli)
	r.Get("/master/icd10/{code}/mappings", h.GetICD10Mappings)
	r.Get("/master/icd10/{code}/kbm-suggestions", h.GetICD10KBMSuggestions)
	// ICD9
	r.Get("/master/icd9", h.GetICD9)
	r.Get("/master/icd9/{code}/mappings", h.GetICD9Mappings)
	// SNOMED
	r.Get("/master/snomed", h.GetSNOMED)
	r.Get("/master/snomed/{concept_id}/mappings", h.GetSNOMEDMappings)
	// Pharmacy master
	r.Get("/master/obat", h.GetObat)
	r.Get("/master/obat/{item_code}/mappings", h.GetObatMappings)
	r.Get("/master/kfa", h.GetKFA)
	r.Get("/master/dpho", h.GetDPHO)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func pageParam(r *http.Request) (int, int) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 {
		pageSize = 10
	}
	return page, pageSize
}

func calcTotalPages(total, pageSize int) int {
	tp := (total + pageSize - 1) / pageSize
	if tp < 1 {
		return 1
	}
	return tp
}

// ── Polyclinics ───────────────────────────────────────────────────────────────

func (h *MasterHandler) GetPolyclinics(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	res, err := h.svc.EMR.GetPolyclinics(r.Context(), &emrpb.GetPolyclinicsRequest{
		Page: int32(page), PageSize: int32(pageSize), Search: r.URL.Query().Get("search"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

// ── KBM ──────────────────────────────────────────────────────────────────────

func (h *MasterHandler) GetKBMs(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	searchName := r.URL.Query().Get("search_name")
	if searchName == "" {
		searchName = r.URL.Query().Get("search")
	}
	res, err := h.svc.EMR.GetMasterKBMs(r.Context(), &emrpb.GetMasterKBMsRequest{
		Page: int32(page), PageSize: int32(pageSize),
		SearchName: searchName, SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetKBMsByPoli(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	searchName := r.URL.Query().Get("search_name")
	if searchName == "" {
		searchName = r.URL.Query().Get("search")
	}
	res, err := h.svc.EMR.GetMasterKBMsByPoli(r.Context(), &emrpb.GetMasterKBMsByPoliRequest{
		PoliCode: chi.URLParam(r, "poli_code"), Page: int32(page), PageSize: int32(pageSize),
		SearchName: searchName, SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetKBMICD10Suggestions(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetICD10SuggestionsForKBM(r.Context(), &emrpb.GetICD10SuggestionsForKBMRequest{KbmCode: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ── Tindakan ──────────────────────────────────────────────────────────────────

func (h *MasterHandler) GetTindakan(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	searchName := r.URL.Query().Get("search_name")
	if searchName == "" {
		searchName = r.URL.Query().Get("search")
	}
	res, err := h.svc.EMR.GetMasterTindakan(r.Context(), &emrpb.GetMasterTindakanRequest{
		Page: int32(page), PageSize: int32(pageSize),
		SearchName: searchName, SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetTindakanByPoli(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	searchName := r.URL.Query().Get("search_name")
	if searchName == "" {
		searchName = r.URL.Query().Get("search")
	}
	res, err := h.svc.EMR.GetMasterTindakanByPoli(r.Context(), &emrpb.GetMasterTindakanByPoliRequest{
		PoliCode: chi.URLParam(r, "poli_code"), Page: int32(page), PageSize: int32(pageSize),
		SearchName: searchName, SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetTindakanICD9Suggestions(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetICD9SuggestionsForTindakan(r.Context(), &emrpb.GetICD9SuggestionsForTindakanRequest{KodeTindakan: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ── ICD10 ─────────────────────────────────────────────────────────────────────

func (h *MasterHandler) GetICD10(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	searchName := r.URL.Query().Get("search")
	if searchName == "" {
		searchName = r.URL.Query().Get("search_name")
	}
	res, err := h.svc.EMR.GetMasterICD10(r.Context(), &emrpb.GetMasterICD10Request{
		Page: int32(page), PageSize: int32(pageSize),
		SearchName: searchName, SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetICD10ByPoli(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	searchName := r.URL.Query().Get("search")
	if searchName == "" {
		searchName = r.URL.Query().Get("search_name")
	}
	res, err := h.svc.EMR.GetMasterICD10ByPoli(r.Context(), &emrpb.GetMasterICD10ByPoliRequest{
		PoliCode: chi.URLParam(r, "poli_code"), Page: int32(page), PageSize: int32(pageSize),
		SearchName: searchName, SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetICD10Mappings(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetICD10MappingDetails(r.Context(), &emrpb.GetICD10MappingDetailsRequest{Icd10Code: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *MasterHandler) GetICD10KBMSuggestions(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetKBMSuggestionsForICD10(r.Context(), &emrpb.GetKBMSuggestionsForICD10Request{Icd10Code: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ── ICD9 ──────────────────────────────────────────────────────────────────────

func (h *MasterHandler) GetICD9(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	search := r.URL.Query().Get("search")
	if search == "" {
		search = r.URL.Query().Get("search_name")
	}
	res, err := h.svc.EMR.GetMasterICD9(r.Context(), &emrpb.GetMasterICD9Request{
		Offset: int32((page - 1) * pageSize), Limit: int32(pageSize), Search: search,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.Total), TotalPages: calcTotalPages(int(res.Total), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Items, Meta: meta})
}

func (h *MasterHandler) GetICD9Mappings(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetICD9MappingDetails(r.Context(), &emrpb.GetICD9MappingDetailsRequest{Icd9Code: chi.URLParam(r, "code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ── SNOMED ────────────────────────────────────────────────────────────────────

func (h *MasterHandler) GetSNOMED(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	search := r.URL.Query().Get("search")
	if search == "" {
		search = r.URL.Query().Get("search_name")
	}
	res, err := h.svc.EMR.GetMasterSNOMED(r.Context(), &emrpb.GetMasterSNOMEDRequest{
		Page: int32(page), PageSize: int32(pageSize), Search: search,
		SemanticTag: r.URL.Query().Get("semantic_tag"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetSNOMEDMappings(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.EMR.GetSNOMEDMappingDetails(r.Context(), &emrpb.GetSNOMEDMappingDetailsRequest{ConceptId: chi.URLParam(r, "concept_id")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

// ── Pharmacy Master ───────────────────────────────────────────────────────────

func (h *MasterHandler) GetObat(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	searchName := r.URL.Query().Get("search")
	if searchName == "" {
		searchName = r.URL.Query().Get("search_name")
	}
	res, err := h.svc.Pharmacy.GetMasterObat(r.Context(), &pharmacypb.GetMasterObatRequest{
		Page: int32(page), PageSize: int32(pageSize),
		SearchName: searchName, SearchCode: r.URL.Query().Get("search_code"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetObatMappings(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.Pharmacy.GetObatMappingDetails(r.Context(), &pharmacypb.GetObatMappingDetailsRequest{ItemCode: chi.URLParam(r, "item_code")})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *MasterHandler) GetKFA(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	res, err := h.svc.Pharmacy.GetMasterKFA(r.Context(), &pharmacypb.GetMasterKFARequest{
		Page: int32(page), PageSize: int32(pageSize), Search: r.URL.Query().Get("search"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	if page < 1 {
		page = 1
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetDPHO(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	var isFornasPtr, isPrbPtr *bool
	if s := r.URL.Query().Get("is_fornas"); s != "" {
		v := s == "true"
		isFornasPtr = &v
	}
	if s := r.URL.Query().Get("is_prb"); s != "" {
		v := s == "true"
		isPrbPtr = &v
	}
	res, err := h.svc.Pharmacy.GetMasterDPHO(r.Context(), &pharmacypb.GetMasterDPHORequest{
		Page: int32(page), PageSize: int32(pageSize), Search: r.URL.Query().Get("search"),
		IsFornas: isFornasPtr, IsPrb: isPrbPtr,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

// ── Roles & Personnel ────────────────────────────────────────────────────────

func (h *MasterHandler) GetMasterRoles(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	search := r.URL.Query().Get("search")

	res, err := h.svc.Auth.GetMasterRoles(r.Context(), &authpb.GetMasterRolesRequest{
		Page:     int32(page),
		PageSize: int32(pageSize),
		Search:   search,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	meta := response.Meta{
		Page:       page,
		PageSize:   pageSize,
		TotalData:  int(res.TotalCount),
		TotalPages: calcTotalPages(int(res.TotalCount), pageSize),
	}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{
		Success: true,
		Message: "Success",
		Data:    res.Data,
		Meta:    meta,
	})
}

func (h *MasterHandler) GetDoctors(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	search := r.URL.Query().Get("search")

	res, err := h.svc.Auth.GetDoctors(r.Context(), &authpb.GetDoctorsRequest{
		Page:     int32(page),
		PageSize: int32(pageSize),
		Search:   search,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetNurses(w http.ResponseWriter, r *http.Request) {
	page, pageSize := pageParam(r)
	search := r.URL.Query().Get("search")

	res, err := h.svc.Auth.GetNurses(r.Context(), &authpb.GetNursesRequest{
		Page:     int32(page),
		PageSize: int32(pageSize),
		Search:   search,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) AssignDoctor(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		DokterID   string  `json:"dokter_id"`
		PoliCode   string  `json:"poli_code"`
		StartDate  string  `json:"start_date"`
		EndDate    string  `json:"end_date"`
		DaysOfWeek []int32 `json:"days_of_week"`
		ShiftStart string  `json:"shift_start"`
		ShiftEnd   string  `json:"shift_end"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}
	if payload.StartDate == "" || payload.EndDate == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "start_date and end_date are required"})
		return
	}

	_, err := h.svc.Auth.AssignDoctorPoli(r.Context(), &authpb.AssignDoctorPoliRequest{
		DokterId:   payload.DokterID,
		PoliCode:   payload.PoliCode,
		StartDate:  payload.StartDate,
		EndDate:    payload.EndDate,
		DaysOfWeek: payload.DaysOfWeek,
		ShiftStart: payload.ShiftStart,
		ShiftEnd:   payload.ShiftEnd,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Doctor assigned successfully"})
}

func (h *MasterHandler) AssignNurse(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		PerawatID  string  `json:"perawat_id"`
		PoliCode   string  `json:"poli_code"`
		StartDate  string  `json:"start_date"`
		EndDate    string  `json:"end_date"`
		DaysOfWeek []int32 `json:"days_of_week"`
		ShiftStart string  `json:"shift_start"`
		ShiftEnd   string  `json:"shift_end"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}
	if payload.StartDate == "" || payload.EndDate == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "start_date and end_date are required"})
		return
	}

	_, err := h.svc.Auth.AssignNursePoli(r.Context(), &authpb.AssignNursePoliRequest{
		PerawatId:  payload.PerawatID,
		PoliCode:   payload.PoliCode,
		StartDate:  payload.StartDate,
		EndDate:    payload.EndDate,
		DaysOfWeek: payload.DaysOfWeek,
		ShiftStart: payload.ShiftStart,
		ShiftEnd:   payload.ShiftEnd,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Nurse assigned successfully"})
}

func (h *MasterHandler) UnassignDoctor(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		DokterID string `json:"dokter_id"`
		PoliCode string `json:"poli_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}
	if payload.DokterID == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "dokter_id is required"})
		return
	}

	res, err := h.svc.Auth.UnassignDoctorPoli(r.Context(), &authpb.UnassignDoctorPoliRequest{
		DokterId: payload.DokterID,
		PoliCode: payload.PoliCode,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: res.Message})
}

func (h *MasterHandler) UnassignNurse(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		PerawatID string `json:"perawat_id"`
		PoliCode  string `json:"poli_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}
	if payload.PerawatID == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "perawat_id is required"})
		return
	}

	res, err := h.svc.Auth.UnassignNursePoli(r.Context(), &authpb.UnassignNursePoliRequest{
		PerawatId: payload.PerawatID,
		PoliCode:  payload.PoliCode,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: res.Message})
}

func (h *MasterHandler) GetDoctorsByPoli(w http.ResponseWriter, r *http.Request) {
	poliCode := chi.URLParam(r, "poli_code")
	page, pageSize := pageParam(r)
	search := r.URL.Query().Get("search")
	dayOfWeek, _ := strconv.Atoi(r.URL.Query().Get("day_of_week"))

	res, err := h.svc.Auth.GetDoctorsByPoli(r.Context(), &authpb.GetDoctorsByPoliRequest{
		PoliCode:  poliCode,
		Page:      int32(page),
		PageSize:  int32(pageSize),
		Search:    search,
		DayOfWeek: int32(dayOfWeek),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

func (h *MasterHandler) GetNursesByPoli(w http.ResponseWriter, r *http.Request) {
	poliCode := chi.URLParam(r, "poli_code")
	page, pageSize := pageParam(r)
	search := r.URL.Query().Get("search")
	dayOfWeek, _ := strconv.Atoi(r.URL.Query().Get("day_of_week"))

	res, err := h.svc.Auth.GetNursesByPoli(r.Context(), &authpb.GetNursesByPoliRequest{
		PoliCode:  poliCode,
		Page:      int32(page),
		PageSize:  int32(pageSize),
		Search:    search,
		DayOfWeek: int32(dayOfWeek),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: calcTotalPages(int(res.TotalCount), pageSize)}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Data, Meta: meta})
}

// ── Polyclinic Schedule & Piket ──────────────────────────────────────────────

func (h *MasterHandler) GetPoliSchedule(w http.ResponseWriter, r *http.Request) {
	poliCode := chi.URLParam(r, "poli_code")
	docRes, err := h.svc.Auth.GetDoctorsByPoli(r.Context(), &authpb.GetDoctorsByPoliRequest{
		PoliCode: poliCode,
		Page:     1,
		PageSize: 100,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	nurseRes, err := h.svc.Auth.GetNursesByPoli(r.Context(), &authpb.GetNursesByPoliRequest{
		PoliCode: poliCode,
		Page:     1,
		PageSize: 100,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data: map[string]interface{}{
			"poli_code": poliCode,
			"doctors":   docRes.Data,
			"nurses":    nurseRes.Data,
		},
	})
}

func (h *MasterHandler) UpdatePoliSchedule(w http.ResponseWriter, r *http.Request) {
	poliCode := chi.URLParam(r, "poli_code")
	var payload struct {
		Slots []struct {
			DayOfWeek int32  `json:"day_of_week"`
			DokterID  string `json:"dokter_id"`
			PerawatID string `json:"perawat_id"`
		} `json:"slots"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}

	var protoSlots []*authpb.DayScheduleSlot
	for _, s := range payload.Slots {
		protoSlots = append(protoSlots, &authpb.DayScheduleSlot{
			DayOfWeek: s.DayOfWeek,
			DokterId:  s.DokterID,
			PerawatId: s.PerawatID,
		})
	}

	res, err := h.svc.Auth.UpdatePoliSchedule(r.Context(), &authpb.UpdatePoliScheduleRequest{
		PoliCode: poliCode,
		Slots:    protoSlots,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: res.Message})
}

func (h *MasterHandler) GetJadwalPiket(w http.ResponseWriter, r *http.Request) {
	dbConn, err := db.ConnectPostgres("")
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "database connection failed"})
		return
	}
	defer dbConn.Close()

	dateFilter := r.URL.Query().Get("date")
	monthFilter := r.URL.Query().Get("month")
	poliFilter := r.URL.Query().Get("poli_code")

	query := `
		SELECT 
			j.id::text, j.poli_code, 
			COALESCE(p.name, j.poli_code) as poli_name,
			j.dokter_id::text, u_d.username as dokter_name, COALESCE(pd.spesialisasi, 'Dokter') as dokter_spesialisasi,
			COALESCE(j.perawat_id::text, '') as perawat_id, 
			COALESCE(u_p.username, '') as perawat_name,
			TO_CHAR(j.piket_date, 'YYYY-MM-DD') as piket_date,
			TO_CHAR(j.shift_start, 'HH24:MI') as shift_start,
			TO_CHAR(j.shift_end, 'HH24:MI') as shift_end,
			COALESCE(j.keterangan, '') as keterangan,
			j.created_at
		FROM auth.jadwal_piket_poli j
		LEFT JOIN rawat_jalan.polyclinics p ON j.poli_code = p.code
		JOIN auth.profil_dokter pd ON j.dokter_id = pd.id
		JOIN auth.users u_d ON pd.user_id = u_d.id
		LEFT JOIN auth.profil_perawat pp ON j.perawat_id = pp.id
		LEFT JOIN auth.users u_p ON pp.user_id = u_p.id
		WHERE 1=1
	`
	var args []interface{}
	argIdx := 1

	if dateFilter != "" {
		query += fmt.Sprintf(" AND j.piket_date = $%d::DATE", argIdx)
		args = append(args, dateFilter)
		argIdx++
	}
	if monthFilter != "" {
		query += fmt.Sprintf(" AND TO_CHAR(j.piket_date, 'YYYY-MM') = $%d", argIdx)
		args = append(args, monthFilter)
		argIdx++
	}
	if poliFilter != "" {
		query += fmt.Sprintf(" AND j.poli_code = $%d", argIdx)
		args = append(args, poliFilter)
		argIdx++
	}
	query += " ORDER BY j.piket_date DESC, j.shift_start ASC"

	rows, err := dbConn.QueryContext(r.Context(), query, args...)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "failed to query jadwal piket: " + err.Error()})
		return
	}
	defer rows.Close()

	type PiketItem struct {
		ID                 string    `json:"id"`
		PoliCode           string    `json:"poli_code"`
		PoliName           string    `json:"poli_name"`
		DokterID           string    `json:"dokter_id"`
		DokterName         string    `json:"dokter_name"`
		DokterSpesialisasi string    `json:"dokter_spesialisasi"`
		PerawatID          string    `json:"perawat_id"`
		PerawatName        string    `json:"perawat_name"`
		PiketDate          string    `json:"piket_date"`
		ShiftStart         string    `json:"shift_start"`
		ShiftEnd           string    `json:"shift_end"`
		Keterangan         string    `json:"keterangan"`
		CreatedAt          time.Time `json:"created_at"`
	}

	var list []PiketItem
	for rows.Next() {
		var it PiketItem
		if err := rows.Scan(
			&it.ID, &it.PoliCode, &it.PoliName,
			&it.DokterID, &it.DokterName, &it.DokterSpesialisasi,
			&it.PerawatID, &it.PerawatName,
			&it.PiketDate, &it.ShiftStart, &it.ShiftEnd,
			&it.Keterangan, &it.CreatedAt,
		); err == nil {
			list = append(list, it)
		}
	}
	if list == nil {
		list = []PiketItem{}
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Jadwal piket fetched", Data: list})
}

func (h *MasterHandler) CreateJadwalPiket(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		PoliCode   string `json:"poli_code"`
		DokterID   string `json:"dokter_id"`
		PerawatID  string `json:"perawat_id"`
		PiketDate  string `json:"piket_date"`
		ShiftStart string `json:"shift_start"`
		ShiftEnd   string `json:"shift_end"`
		Keterangan string `json:"keterangan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}

	if payload.PoliCode == "" || payload.DokterID == "" || payload.PiketDate == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "poli_code, dokter_id, dan piket_date wajib diisi"})
		return
	}
	if payload.ShiftStart == "" {
		payload.ShiftStart = "08:00"
	}
	if payload.ShiftEnd == "" {
		payload.ShiftEnd = "14:00"
	}

	dbConn, err := db.ConnectPostgres("")
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "database connection failed"})
		return
	}
	defer dbConn.Close()

	userID, _ := r.Context().Value("user_id").(string)

	var insertedID string
	upsertQuery := `
		INSERT INTO auth.jadwal_piket_poli (
			poli_code, dokter_id, perawat_id, piket_date, shift_start, shift_end, keterangan, created_by
		) VALUES (
			$1, $2::uuid, NULLIF($3, '')::uuid, $4::DATE, $5::TIME, $6::TIME, $7, NULLIF($8, '')::uuid
		)
		ON CONFLICT (poli_code, piket_date) DO UPDATE SET
			dokter_id = EXCLUDED.dokter_id,
			perawat_id = EXCLUDED.perawat_id,
			shift_start = EXCLUDED.shift_start,
			shift_end = EXCLUDED.shift_end,
			keterangan = EXCLUDED.keterangan,
			created_at = CURRENT_TIMESTAMP
		RETURNING id::text
	`
	err = dbConn.QueryRowContext(r.Context(), upsertQuery,
		payload.PoliCode, payload.DokterID, payload.PerawatID, payload.PiketDate,
		payload.ShiftStart, payload.ShiftEnd, payload.Keterangan, userID,
	).Scan(&insertedID)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "failed to save jadwal piket: " + err.Error()})
		return
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Jadwal piket berhasil disimpan", Data: map[string]string{"id": insertedID}})
}

func (h *MasterHandler) DeleteJadwalPiket(w http.ResponseWriter, r *http.Request) {
	piketID := chi.URLParam(r, "id")
	if piketID == "" {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: "id is required"})
		return
	}

	dbConn, err := db.ConnectPostgres("")
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "database connection failed"})
		return
	}
	defer dbConn.Close()

	res, err := dbConn.ExecContext(r.Context(), "DELETE FROM auth.jadwal_piket_poli WHERE id = $1::uuid", piketID)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{Success: false, Message: "failed to delete jadwal piket: " + err.Error()})
		return
	}
	rowsAff, _ := res.RowsAffected()
	if rowsAff == 0 {
		response.JSON(w, http.StatusNotFound, response.ErrorResponse{Success: false, Message: "jadwal piket not found"})
		return
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Jadwal piket berhasil dibatalkan"})
}

