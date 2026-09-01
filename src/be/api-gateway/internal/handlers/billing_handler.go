package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/aliube/go-micro-simrs-one/api-gateway/internal/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/validator"
	billingpb "github.com/aliube/go-micro-simrs-one/shared/proto/billing/v1"
	patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"
	rawatjalanpb "github.com/aliube/go-micro-simrs-one/shared/proto/rawat_jalan/v1"
	regpb "github.com/aliube/go-micro-simrs-one/shared/proto/registration/v1"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
)

// BillingHandler handles /billing/* and /kasir/* routes.
type BillingHandler struct {
	svc *ports.ServicePorts
	rdb *redis.Client
}

func (h *BillingHandler) getDepartmentName(ctx context.Context, code string) string {
	if code == "" {
		return ""
	}
	// 1. Cek Redis Hash master:polyclinics (O(1))
	if h.rdb != nil {
		if val, err := h.rdb.HGet(ctx, "master:polyclinics", code).Result(); err == nil && val != "" {
			return val
		}
	}
	// 2. Fallback query ke rawat-jalan-service jika cache kosong, lalu isi cache Redis
	if h.svc != nil && h.svc.RawatJalan != nil {
		res, err := h.svc.RawatJalan.GetPolyclinics(ctx, &rawatjalanpb.GetPolyclinicsRequest{
			Page:     1,
			PageSize: 100,
		})
		if err == nil && res != nil {
			for _, p := range res.Data {
				if h.rdb != nil {
					_ = h.rdb.HSet(ctx, "master:polyclinics", p.Code, p.Name).Err()
				}
				if p.Code == code {
					return p.Name
				}
			}
		}
	}
	return "Poli " + code
}

func NewBillingHandler(svc *ports.ServicePorts, rdb *redis.Client) *BillingHandler {
	return &BillingHandler{svc: svc, rdb: rdb}
}

// Register mounts billing routes (caller applies RequireRole middleware).
func (h *BillingHandler) Register(r chi.Router) {
	// Queue & Invoices
	r.Get("/billing/queue", h.GetBillingQueue)
	r.Get("/billing/invoice/{encounter_no}", h.GetInvoice)
	r.Get("/billing/invoices/{encounter_no}", h.GetInvoicesByEncounter)
	r.Get("/billing/encounter/{encounter_no}/invoices", h.GetInvoicesByEncounter)
	r.Post("/billing/encounter/{encounter_no}/invoice", h.GenerateInvoice)

	// Payment & Cancellation
	r.Post("/billing/pay", h.PayInvoice)
	r.Post("/billing/invoice/{invoice_id}/pay", h.PayInvoice)
	r.Post("/billing/cancel", h.CancelInvoice)
	r.Post("/billing/invoice/{invoice_id}/cancel", h.CancelInvoice)

	// Reports & Fees
	r.Get("/billing/reports/rekap", h.GetRekapReport)
	r.Post("/billing/encounter/{encounter_no}/registration-fee", h.AddRegistrationFee)
	r.Get("/billing/encounter/{encounter_no}/action-payment-status", h.GetActionPaymentStatus)
}

func (h *BillingHandler) GetBillingQueue(w http.ResponseWriter, r *http.Request) {
	dateStr := r.URL.Query().Get("date")
	includeAll := r.URL.Query().Get("all") == "true" || r.URL.Query().Get("include_paid") == "true"
	reqDate := dateStr
	if reqDate == "TODAY" || reqDate == time.Now().Format("2006-01-02") {
		reqDate = ""
	}

	resReg, err := h.svc.Registration.GetTodayEncounters(r.Context(), &regpb.GetTodayEncountersRequest{
		Page: 1, PageSize: 5000, Date: reqDate,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	type BillingQueueItem struct {
		EncounterNo     string                     `json:"encounter_no"`
		MRN             string                     `json:"mrn"`
		PatientName     string                     `json:"patient_name"`
		Gender          string                     `json:"gender"`
		DateOfBirth     string                     `json:"date_of_birth"`
		DepartmentCode  string                     `json:"department_code"`
		DoctorID        string                     `json:"doctor_id"`
		Status          string                     `json:"status"`
		StatusPasien    string                     `json:"status_pasien"`
		RegisteredTime  string                     `json:"registered_time"`
		PaymentStatus   string                     `json:"payment_status"`
		HasUnpaid       bool                       `json:"has_unpaid"`
		TotalAmount     float64                    `json:"total_amount"`
		PaidAmount      float64                    `json:"paid_amount"`
		UnpaidAmount    float64                    `json:"unpaid_amount"`
		ActiveInvoiceID string                     `json:"active_invoice_id"`
		Invoices        []*billingpb.InvoiceDetail `json:"invoices"`
	}

	var queueList []BillingQueueItem

	for _, enc := range resReg.Encounters {
		var pName = "-"
		var pGender = "-"
		var pDob = "-"

		mrnClean := strings.TrimSpace(enc.Mrn)
		resPat, errPat := h.svc.Patient.GetPatientByMRN(r.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrnClean})
		if errPat == nil && resPat != nil && resPat.Patient != nil {
			pName = resPat.Patient.Name
			pGender = resPat.Patient.Gender
			pDob = resPat.Patient.Dob
		}

		parts := strings.Split(enc.RegisteredTime, "|")
		regTime := parts[0]
		isNew := "Lama RS"
		if len(parts) > 1 && parts[1] == "true" {
			isNew = "Baru RS"
		}

		// Fetch all invoices for this encounter
		var invoices []*billingpb.InvoiceDetail
		resInvs, _ := h.svc.Billing.GetInvoicesByEncounter(r.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: enc.EncounterNo})
		if resInvs != nil && len(resInvs.Invoices) > 0 {
			invoices = resInvs.Invoices
		} else {
			// If no invoice in billing db yet, generate initial registration invoice
			resGen, _ := h.svc.Billing.GenerateInvoice(r.Context(), &billingpb.GenerateInvoiceRequest{EncounterNo: enc.EncounterNo})
			if resGen != nil {
				invoices = append(invoices, &billingpb.InvoiceDetail{
					InvoiceId:   resGen.InvoiceId,
					EncounterNo: enc.EncounterNo,
					TotalAmount: resGen.TotalAmount,
					Status:      resGen.Status,
					IsPaid:      resGen.IsPaid,
					Items:       resGen.Items,
					CreatedAt:   time.Now().Format(time.RFC3339),
				})
			}
		}

		var totalAmount, paidAmount, unpaidAmount float64
		var hasUnpaid bool
		var activeInvID string

		for _, inv := range invoices {
			totalAmount += inv.TotalAmount
			if inv.IsPaid || inv.Status == "PAID" {
				paidAmount += inv.TotalAmount
			} else {
				unpaidAmount += inv.TotalAmount
				hasUnpaid = true
				if activeInvID == "" {
					activeInvID = inv.InvoiceId
				}
			}
		}

		if len(invoices) == 0 {
			fee := 50000.0
			if enc.DepartmentCode != "01" && enc.DepartmentCode != "UMU" && enc.DepartmentCode != "Poli Umum" {
				fee = 150000.0
			}
			totalAmount = fee
			if enc.Status == "WAITING_FOR_PAYMENT" || enc.Status == "REGISTERED" {
				unpaidAmount = fee
				hasUnpaid = true
			} else if enc.Status != "CANCELLED" && enc.Status != "BATAL" {
				paidAmount = fee
			}
		} else if !hasUnpaid && (enc.Status == "WAITING_FOR_PAYMENT" || enc.Status == "REGISTERED") {
			hasUnpaid = true
			if unpaidAmount == 0 {
				unpaidAmount = totalAmount
			}
		}

		paymentStatus := "PAID"
		if enc.Status == "CANCELLED" || enc.Status == "BATAL" {
			paymentStatus = "CANCELLED"
		} else if hasUnpaid {
			paymentStatus = "UNPAID"
		}

		onlyUnpaid := r.URL.Query().Get("only_unpaid") == "true" || r.URL.Query().Get("unpaid_only") == "true"

		// Only keep patients who actually need to make a payment unless includeAll is requested
		if onlyUnpaid || !includeAll {
			if enc.Status == "CANCELLED" || enc.Status == "BATAL" || !hasUnpaid || unpaidAmount <= 0 {
				continue
			}
		}

		queueList = append(queueList, BillingQueueItem{
			EncounterNo:     enc.EncounterNo,
			MRN:             enc.Mrn,
			PatientName:     pName,
			Gender:          pGender,
			DateOfBirth:     pDob,
			DepartmentCode:  enc.DepartmentCode,
			DoctorID:        enc.DoctorId,
			Status:          enc.Status,
			StatusPasien:    isNew,
			RegisteredTime:  regTime,
			PaymentStatus:   paymentStatus,
			HasUnpaid:       hasUnpaid,
			TotalAmount:     totalAmount,
			PaidAmount:      paidAmount,
			UnpaidAmount:    unpaidAmount,
			ActiveInvoiceID: activeInvID,
			Invoices:        invoices,
		})
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data:    queueList,
	})
}

func (h *BillingHandler) GetInvoice(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.Billing.GenerateInvoice(r.Context(), &billingpb.GenerateInvoiceRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	var patientName, mrn, poliName, doctorName string
	resEnc, errEnc := h.svc.Registration.GetTodayEncounters(r.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 5000})
	if errEnc == nil && resEnc != nil {
		for _, enc := range resEnc.Encounters {
			if enc.EncounterNo == encounterNo {
				mrn = enc.Mrn
				poliName = h.getDepartmentName(r.Context(), enc.DepartmentCode)
				doctorName = enc.DoctorId
				break
			}
		}
	}
	if mrn != "" {
		resPat, _ := h.svc.Patient.GetPatientByMRN(r.Context(), &patientpb.GetPatientByMRNRequest{Mrn: mrn})
		if resPat != nil && resPat.Patient != nil {
			patientName = resPat.Patient.Name
		}
	}

	// Also fetch all invoices for this encounter
	resAll, _ := h.svc.Billing.GetInvoicesByEncounter(r.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: encounterNo})
	var allInvoices []*billingpb.InvoiceDetail
	if resAll != nil {
		allInvoices = resAll.Invoices
	}

	invoiceID := res.InvoiceId
	totalAmount := res.TotalAmount
	status := res.Status
	isPaid := res.IsPaid || res.Status == "PAID"
	items := res.Items

	reqInvoiceID := r.URL.Query().Get("invoice_id")
	if reqInvoiceID == "" {
		reqInvoiceID = r.URL.Query().Get("receipt_no")
	}
	if reqInvoiceID != "" {
		cleanID := strings.TrimPrefix(reqInvoiceID, "KW-")
		cleanID = strings.TrimPrefix(cleanID, "#")
		for _, inv := range allInvoices {
			if inv.InvoiceId == reqInvoiceID || inv.InvoiceId == cleanID || strings.TrimPrefix(inv.InvoiceId, "INV-") == cleanID {
				invoiceID = inv.InvoiceId
				totalAmount = inv.TotalAmount
				status = inv.Status
				isPaid = inv.IsPaid || inv.Status == "PAID"
				items = inv.Items
				break
			}
		}
	}

	type EnrichedInvoiceResponse struct {
		Success     bool                       `json:"success"`
		InvoiceId   string                     `json:"invoice_id"`
		EncounterNo string                     `json:"encounter_no"`
		PatientName string                     `json:"patient_name"`
		MRN         string                     `json:"mrn"`
		PoliName    string                     `json:"poli_name"`
		DoctorName  string                     `json:"doctor_name"`
		Items       []*billingpb.InvoiceItem   `json:"items"`
		TotalAmount float64                    `json:"total_amount"`
		Status      string                     `json:"status"`
		IsPaid      bool                       `json:"is_paid"`
		Invoices    []*billingpb.InvoiceDetail `json:"invoices"`
		Message     string                     `json:"message"`
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data: EnrichedInvoiceResponse{
			Success:     res.Success,
			InvoiceId:   invoiceID,
			EncounterNo: encounterNo,
			PatientName: patientName,
			MRN:         mrn,
			PoliName:    poliName,
			DoctorName:  doctorName,
			Items:       items,
			TotalAmount: totalAmount,
			Status:      status,
			IsPaid:      isPaid,
			Invoices:    allInvoices,
			Message:     res.Message,
		},
	})
}

func (h *BillingHandler) GetInvoicesByEncounter(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	res, err := h.svc.Billing.GetInvoicesByEncounter(r.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: encounterNo})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res.Invoices})
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
	if req.InvoiceId == "" {
		req.InvoiceId = invoiceID
	}
	if err := validator.ValidateAll(map[string]func() error{
		"invoice_id": validator.NotEmpty(req.InvoiceId),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}

	res, err := h.svc.Billing.PayInvoice(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}

	// Notify Registration Service to update Encounter Status to QUEUED_FOR_POLI
	// ONLY if encounter is currently WAITING_FOR_PAYMENT or REGISTERED (do not regress if already in poli)
	if res.EncounterNo != "" {
		resEnc, _ := h.svc.Registration.GetTodayEncounters(r.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 5000})
		shouldQueue := true
		if resEnc != nil {
			for _, enc := range resEnc.Encounters {
				if enc.EncounterNo == res.EncounterNo {
					if enc.Status == "IN_PROGRESS" || enc.Status == "IN_EXAMINATION" || enc.Status == "COMPLETED" || enc.Status == "QUEUED_FOR_POLI" {
						shouldQueue = false
					}
					break
				}
			}
		}
		if shouldQueue {
			_, errReg := h.svc.Registration.UpdateEncounterStatus(r.Context(), &regpb.UpdateEncounterStatusRequest{
				EncounterNo: res.EncounterNo,
				Status:      "QUEUED_FOR_POLI",
			})
			if errReg != nil {
				slog.Warn("Failed to update encounter status after payment", "encounter_no", res.EncounterNo, "error", errReg)
			}
		}
	}

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data:    res,
	})
}

func (h *BillingHandler) CancelInvoice(w http.ResponseWriter, r *http.Request) {
	invoiceID := chi.URLParam(r, "invoice_id")
	var req billingpb.CancelInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.JSON(w, http.StatusBadRequest, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}
	if req.InvoiceId == "" {
		req.InvoiceId = invoiceID
	}
	if err := validator.ValidateAll(map[string]func() error{
		"invoice_id": validator.NotEmpty(req.InvoiceId),
	}); err != nil {
		response.JSON(w, http.StatusUnprocessableEntity, response.ErrorResponse{Success: false, Message: err.Error()})
		return
	}

	res, err := h.svc.Billing.CancelInvoice(r.Context(), &req)
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data:    res,
	})
}

func (h *BillingHandler) GetRekapReport(w http.ResponseWriter, r *http.Request) {
	dateStr := r.URL.Query().Get("date")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	filterDept := r.URL.Query().Get("department_code")
	filterMethod := r.URL.Query().Get("payment_method")

	var reqDate string
	var periodStr string

	if startDate != "" && endDate != "" {
		reqDate = startDate + ":" + endDate
		if startDate == endDate {
			periodStr = startDate
		} else {
			periodStr = startDate + " s/d " + endDate
		}
	} else if dateStr != "" && dateStr != "TODAY" {
		reqDate = dateStr
		periodStr = dateStr
	} else {
		today := time.Now().Format("2006-01-02")
		reqDate = today
		periodStr = today
	}

	resReg, err := h.svc.Registration.GetTodayEncounters(r.Context(), &regpb.GetTodayEncountersRequest{Page: 1, PageSize: 5000, Date: reqDate})

	type SettlementItem struct {
		ItemType    string  `json:"item_type"`
		Description string  `json:"description"`
		Qty         int     `json:"qty"`
		Amount      float64 `json:"amount"`
	}

	type SettlementTransaction struct {
		InvoiceID      string           `json:"invoice_id"`
		ReceiptNo      string           `json:"receipt_no"`
		EncounterNo    string           `json:"encounter_no"`
		MRN            string           `json:"mrn"`
		PatientName    string           `json:"patient_name"`
		DepartmentCode string           `json:"department_code"`
		DepartmentName string           `json:"department_name"`
		PaymentMethod  string           `json:"payment_method"`
		TotalAmount    float64          `json:"total_amount"`
		PaidAt         string           `json:"paid_at"`
		CashierName    string           `json:"cashier_name"`
		Status         string           `json:"status"`
		Items          []SettlementItem `json:"items"`
	}

	type ServiceBreakdown struct {
		DepartmentCode string  `json:"department_code"`
		DepartmentName string  `json:"department_name"`
		Count          int     `json:"count"`
		Total          float64 `json:"total"`
	}

	type RevenueMetrics struct {
		TotalRevenue      float64 `json:"total_revenue"`
		TotalTransactions int     `json:"total_transactions"`
		TunaiAmount       float64 `json:"tunai_amount"`
		TunaiCount        int     `json:"tunai_count"`
		QRISAmount        float64 `json:"qris_amount"`
		QRISCount         int     `json:"qris_count"`
		DebitAmount       float64 `json:"debit_amount"`
		DebitCount        int     `json:"debit_count"`
		BPJSAmount        float64 `json:"bpjs_amount"`
		BPJSCount         int     `json:"bpjs_count"`
		NonTunaiAmount    float64 `json:"non_tunai_amount"`
		NonTunaiCount     int     `json:"non_tunai_count"`
	}

	var transactions []SettlementTransaction
	serviceMap := make(map[string]*ServiceBreakdown)
	patientCache := make(map[string]string)
	var metrics RevenueMetrics

	// If regClient has encounters, iterate and build transactions
	if err == nil && resReg != nil && len(resReg.Encounters) > 0 {
		for _, enc := range resReg.Encounters {
			deptCode := enc.DepartmentCode
			if deptCode == "" {
				deptCode = "01"
			}
			deptName := h.getDepartmentName(r.Context(), deptCode)

			parts := strings.Split(enc.RegisteredTime, "|")
			timeStr := parts[0]
			if timeStr == "" {
				timeStr = "08:00"
			}

			resInvs, _ := h.svc.Billing.GetInvoicesByEncounter(r.Context(), &billingpb.GetInvoicesByEncounterRequest{EncounterNo: enc.EncounterNo})

			pName, found := patientCache[enc.Mrn]
			if !found {
				pName = "Pasien " + enc.Mrn
				resPat, _ := h.svc.Patient.GetPatientByMRN(r.Context(), &patientpb.GetPatientByMRNRequest{Mrn: enc.Mrn})
				if resPat != nil && resPat.Patient != nil && resPat.Patient.Name != "" {
					pName = resPat.Patient.Name
				}
				patientCache[enc.Mrn] = pName
			}

			method := "CASH"

			if resInvs != nil && len(resInvs.Invoices) > 0 {
				for _, inv := range resInvs.Invoices {
					if !inv.IsPaid && inv.Status != "PAID" {
						continue
					}

					var txItems []SettlementItem
					for _, itm := range inv.Items {
						txItems = append(txItems, SettlementItem{
							ItemType:    itm.ItemType,
							Description: itm.Description,
							Qty:         1,
							Amount:      itm.Amount,
						})
					}
					amount := inv.TotalAmount
					if len(txItems) == 0 {
						txItems = append(txItems, SettlementItem{
							ItemType:    "ACTION",
							Description: "Pemeriksaan & Konsultasi " + deptName,
							Qty:         1,
							Amount:      amount,
						})
					}

					receiptNo := "KW-" + strings.TrimPrefix(inv.InvoiceId, "INV-")
					if receiptNo == "KW-" || receiptNo == "" {
						receiptNo = "KW-" + enc.EncounterNo
					}

					tx := SettlementTransaction{
						InvoiceID:      inv.InvoiceId,
						ReceiptNo:      receiptNo,
						EncounterNo:    enc.EncounterNo,
						MRN:            enc.Mrn,
						PatientName:    pName,
						DepartmentCode: deptCode,
						DepartmentName: deptName,
						PaymentMethod:  method,
						TotalAmount:    amount,
						PaidAt:         timeStr,
						CashierName:    "Staf Kasir 1",
						Status:         "PAID",
						Items:          txItems,
					}

					if filterDept != "" && filterDept != "ALL" && filterDept != deptCode {
						continue
					}
					if filterMethod != "" && filterMethod != "ALL" && filterMethod != method {
						continue
					}

					transactions = append(transactions, tx)

					metrics.TotalRevenue += amount
					metrics.TotalTransactions++
					switch method {
					case "CASH":
						metrics.TunaiAmount += amount
						metrics.TunaiCount++
					case "QRIS":
						metrics.QRISAmount += amount
						metrics.QRISCount++
					case "DEBIT":
						metrics.DebitAmount += amount
						metrics.DebitCount++
					case "BPJS":
						metrics.BPJSAmount += amount
						metrics.BPJSCount++
					}

					if _, exists := serviceMap[deptCode]; !exists {
						serviceMap[deptCode] = &ServiceBreakdown{
							DepartmentCode: deptCode,
							DepartmentName: deptName,
							Count:          0,
							Total:          0,
						}
					}
					serviceMap[deptCode].Count++
					serviceMap[deptCode].Total += amount
				}
			} else {
				// Fallback check if encounter was already processed in poli
				isPaid := enc.Status == "QUEUED_FOR_POLI" ||
					enc.Status == "IN_PROGRESS" ||
					enc.Status == "IN_EXAMINATION" ||
					enc.Status == "COMPLETED" ||
					enc.Status == "PAID"

				if !isPaid {
					continue
				}

				amount := 50000.0
				txItems := []SettlementItem{
					{
						ItemType:    "ACTION",
						Description: "Pemeriksaan & Konsultasi " + deptName,
						Qty:         1,
						Amount:      amount,
					},
				}

				tx := SettlementTransaction{
					InvoiceID:      "INV-REG-" + enc.EncounterNo,
					ReceiptNo:      "KW-REG-" + enc.EncounterNo,
					EncounterNo:    enc.EncounterNo,
					MRN:            enc.Mrn,
					PatientName:    pName,
					DepartmentCode: deptCode,
					DepartmentName: deptName,
					PaymentMethod:  method,
					TotalAmount:    amount,
					PaidAt:         timeStr,
					CashierName:    "Staf Kasir 1",
					Status:         "PAID",
					Items:          txItems,
				}

				if filterDept != "" && filterDept != "ALL" && filterDept != deptCode {
					continue
				}
				if filterMethod != "" && filterMethod != "ALL" && filterMethod != method {
					continue
				}

				transactions = append(transactions, tx)

				metrics.TotalRevenue += amount
				metrics.TotalTransactions++
				metrics.TunaiAmount += amount
				metrics.TunaiCount++

				if _, exists := serviceMap[deptCode]; !exists {
					serviceMap[deptCode] = &ServiceBreakdown{
						DepartmentCode: deptCode,
						DepartmentName: deptName,
						Count:          0,
						Total:          0,
					}
				}
				serviceMap[deptCode].Count++
				serviceMap[deptCode].Total += amount
			}
		}
	}

	metrics.NonTunaiAmount = metrics.QRISAmount + metrics.DebitAmount + metrics.BPJSAmount
	metrics.NonTunaiCount = metrics.QRISCount + metrics.DebitCount + metrics.BPJSCount

	var serviceBreakdownList []ServiceBreakdown
	for _, v := range serviceMap {
		serviceBreakdownList = append(serviceBreakdownList, *v)
	}
	sort.Slice(serviceBreakdownList, func(i, j int) bool {
		return serviceBreakdownList[i].Total > serviceBreakdownList[j].Total
	})

	response.JSON(w, http.StatusOK, response.SuccessResponse{
		Success: true,
		Message: "Success",
		Data: map[string]interface{}{
			"period":            periodStr,
			"metrics":           metrics,
			"service_breakdown": serviceBreakdownList,
			"transactions":      transactions,
		},
	})
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
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Fee added", Data: res})
}

func (h *BillingHandler) GetActionPaymentStatus(w http.ResponseWriter, r *http.Request) {
	encounterNo := chi.URLParam(r, "encounter_no")
	actionID := r.URL.Query().Get("action_id")
	res, err := h.svc.Billing.GetActionPaymentStatus(r.Context(), &billingpb.GetActionPaymentStatusRequest{
		EncounterNo: encounterNo,
		ActionCode:  actionID,
	})
	if err != nil {
		response.HandleGRPCError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, response.SuccessResponse{Success: true, Message: "Success", Data: res})
}
