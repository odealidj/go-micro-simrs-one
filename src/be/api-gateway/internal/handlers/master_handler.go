package handlers

import (
	"net/http"
	"strconv"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
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
