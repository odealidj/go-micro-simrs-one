package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
	"github.com/go-chi/chi/v5"
)

// RegistrationHandler handles /registration/* and admission dashboard routes.
type RegistrationHandler struct {
	svc *ports.ServicePorts
}

func NewRegistrationHandler(svc *ports.ServicePorts) *RegistrationHandler {
	return &RegistrationHandler{svc: svc}
}

// Register mounts routes (caller must apply RequireRole middleware).
func (h *RegistrationHandler) Register(r chi.Router) {
	r.Post("/registration/encounter", h.RegisterEncounter)
	r.Post("/registration/encounter/{encounter_no}/cancel", h.CancelEncounter)
	r.Put("/registration/encounter/{encounter_no}/guarantor", h.UpdateGuarantor)
	r.Get("/registration/dashboard/metrics", h.DashboardMetrics)
	r.Get("/registration/encounters/today", h.TodayEncounters)
}

func (h *RegistrationHandler) RegisterEncounter(w http.ResponseWriter, r *http.Request) {
	var req regpb.RegisterEncounterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.Registration.RegisterEncounter(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Encounter registered", Data: res})
}

func (h *RegistrationHandler) CancelEncounter(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.Registration.CancelEncounter(r.Context(), &regpb.CancelEncounterRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Encounter cancelled", Data: res})
}

func (h *RegistrationHandler) UpdateGuarantor(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	var req regpb.UpdateEncounterGuarantorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	req.EncounterNo = encounterNo
	res, err := h.svc.Registration.UpdateEncounterGuarantor(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Guarantor updated", Data: res})
}

func (h *RegistrationHandler) DashboardMetrics(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.Registration.GetDashboardMetrics(r.Context(), &regpb.GetDashboardMetricsRequest{})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *RegistrationHandler) TodayEncounters(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize <= 0 {
		pageSize = 50
	}
	res, err := h.svc.Registration.GetTodayEncounters(r.Context(), &regpb.GetTodayEncountersRequest{
		Page:     int32(page),
		PageSize: int32(pageSize),
		Search:   r.URL.Query().Get("search"),
		Date:     r.URL.Query().Get("date"),
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	totalPages := (int(res.TotalCount) + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}
	meta := response.Meta{Page: page, PageSize: pageSize, TotalData: int(res.TotalCount), TotalPages: totalPages}
	response.JSON(w, http.StatusOK, response.SuccessPaginatedResponse{Success: true, Message: "Success", Data: res.Encounters, Meta: meta})
}
