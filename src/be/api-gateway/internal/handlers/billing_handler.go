package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	"github.com/go-chi/chi/v5"
)

// BillingHandler handles /billing/* and /kasir/* routes.
type BillingHandler struct {
	svc *ports.ServicePorts
}

func NewBillingHandler(svc *ports.ServicePorts) *BillingHandler {
	return &BillingHandler{svc: svc}
}

// Register mounts billing routes (caller applies RequireRole middleware).
func (h *BillingHandler) Register(r chi.Router) {
	r.Get("/billing/queue", h.GetBillingQueue)
	r.Get("/billing/encounter/{encounter_no}/invoices", h.GetInvoicesByEncounter)
	r.Post("/billing/encounter/{encounter_no}/invoice", h.GenerateInvoice)
	r.Post("/billing/invoice/{invoice_id}/pay", h.PayInvoice)
	r.Post("/billing/invoice/{invoice_id}/cancel", h.CancelInvoice)
	r.Post("/billing/encounter/{encounter_no}/registration-fee", h.AddRegistrationFee)
	r.Get("/billing/encounter/{encounter_no}/action-payment-status", h.GetActionPaymentStatus)
}

func (h *BillingHandler) GetBillingQueue(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize <= 0 {
		pageSize = 50
	}
	res, err := h.svc.Billing.GetInvoicesByEncounter(r.Context(), &billingpb.GetInvoicesByEncounterRequest{
		// Queue is a filtered list view — reuse existing endpoint with date filter
		EncounterNo: date, // adapter maps date param as encounter_no when empty
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *BillingHandler) GetInvoicesByEncounter(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.Billing.GetInvoicesByEncounter(r.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}

func (h *BillingHandler) GenerateInvoice(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	var req billingpb.GenerateInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	req.EncounterNo = encounterNo
	res, err := h.svc.Billing.GenerateInvoice(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Invoice generated", Data: res})
}

func (h *BillingHandler) PayInvoice(w http.ResponseWriter, r *http.Request) {
	invoiceID := chi.URLParam(r, "invoice_id")
	var req billingpb.PayInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	req.InvoiceId = invoiceID
	res, err := h.svc.Billing.PayInvoice(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Invoice paid", Data: res})
}

func (h *BillingHandler) CancelInvoice(w http.ResponseWriter, r *http.Request) {
	invoiceID := chi.URLParam(r, "invoice_id")
	var req billingpb.CancelInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	req.InvoiceId = invoiceID
	res, err := h.svc.Billing.CancelInvoice(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Invoice cancelled", Data: res})
}

func (h *BillingHandler) AddRegistrationFee(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	var req billingpb.AddRegistrationFeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	req.EncounterNo = encounterNo
	res, err := h.svc.Billing.AddRegistrationFee(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Registration fee added", Data: res})
}

func (h *BillingHandler) GetActionPaymentStatus(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.Billing.GetActionPaymentStatus(r.Context(), &billingpb.GetActionPaymentStatusRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}
