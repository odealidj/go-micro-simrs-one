package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	pharmacypb "github.com/aliube/go-micro-simrs-one/shared/proto/pharmacy/v1"
	"github.com/go-chi/chi/v5"
)

// PharmacyHandler handles /pharmacy/* routes.
// Role: asisten_apoteker, admin.
type PharmacyHandler struct {
	svc *ports.ServicePorts
}

func NewPharmacyHandler(svc *ports.ServicePorts) *PharmacyHandler {
	return &PharmacyHandler{svc: svc}
}

// Register mounts /pharmacy/* routes.
// Caller applies RequireRole("asisten_apoteker", "admin").
func (h *PharmacyHandler) Register(r chi.Router) {
	r.Post("/pharmacy/prescriptions", h.CreatePrescription)
	r.Post("/pharmacy/dispense", h.Dispense)
}

func (h *PharmacyHandler) CreatePrescription(w http.ResponseWriter, r *http.Request) {
	var payload pharmacypb.CreatePrescriptionRequest
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
	res, err := h.svc.Pharmacy.CreatePrescription(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *PharmacyHandler) Dispense(w http.ResponseWriter, r *http.Request) {
	var payload pharmacypb.DispensePrescriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	res, err := h.svc.Pharmacy.DispensePrescription(r.Context(), &payload)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}
