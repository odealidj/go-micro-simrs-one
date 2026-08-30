package services

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/ports"
	"github.com/google/uuid"
)

type billingServiceImpl struct {
	repo ports.BillingRepository
}

func NewBillingService(repo ports.BillingRepository) ports.BillingService {
	return &billingServiceImpl{repo: repo}
}

func (s *billingServiceImpl) getOrCreateRegistrationInvoice(ctx context.Context, encounterNo string) (*domain.Invoice, error) {
	inv, err := s.repo.GetInvoiceByEncounterNo(ctx, encounterNo)
	if err == nil {
		return inv, nil
	}

	// Create registration invoice
	inv = &domain.Invoice{
		ID:          fmt.Sprintf("INV-REG-%s", encounterNo),
		EncounterNo: encounterNo,
		TotalAmount: 0,
		Status:      "UNPAID",
	}
	err = s.repo.CreateInvoice(ctx, inv)
	if err != nil {
		// Fallback random ID if constraint conflicts
		inv.ID = fmt.Sprintf("INV-%d", time.Now().UnixNano())
		err = s.repo.CreateInvoice(ctx, inv)
		if err != nil {
			return nil, err
		}
	}
	return inv, nil
}

func (s *billingServiceImpl) getOrCreateUnpaidActionInvoice(ctx context.Context, encounterNo string) (*domain.Invoice, error) {
	inv, err := s.repo.GetActiveUnpaidInvoiceByEncounterNo(ctx, encounterNo)
	if err == nil && inv != nil {
		return inv, nil
	}

	// Create separate Action Invoice for Poli
	newInv := &domain.Invoice{
		ID:          fmt.Sprintf("INV-ACT-%s-%d", encounterNo, time.Now().Unix()%100000),
		EncounterNo: encounterNo,
		TotalAmount: 0,
		Status:      "UNPAID",
	}
	err = s.repo.CreateInvoice(ctx, newInv)
	if err != nil {
		newInv.ID = fmt.Sprintf("INV-%d", time.Now().UnixNano())
		err = s.repo.CreateInvoice(ctx, newInv)
		if err != nil {
			return nil, err
		}
	}
	return newInv, nil
}

func (s *billingServiceImpl) AddRegistrationFee(ctx context.Context, encounterNo, departmentCode string, amount float64) (string, error) {
	inv, err := s.getOrCreateRegistrationInvoice(ctx, encounterNo)
	if err != nil {
		return "", err
	}

	deptName := departmentCode
	isGeneral := departmentCode == "01" || departmentCode == "UMU" || departmentCode == "Poli Umum" || departmentCode == "POLI_UMUM"
	var desc string
	if isGeneral {
		desc = "Pemeriksaan Dokter Umum (Poli Umum)"
		if amount <= 0 {
			amount = 50000.0
		}
	} else {
		switch departmentCode {
		case "02":
			deptName = "Poli Gigi"
		case "03":
			deptName = "Poli Anak"
		case "04":
			deptName = "Poli Penyakit Dalam"
		case "05":
			deptName = "Poli Bedah"
		case "06":
			deptName = "Poli Mata"
		case "07":
			deptName = "Poli THT"
		case "08":
			deptName = "Poli Kandungan (Obgyn)"
		}
		desc = fmt.Sprintf("Pemeriksaan Dokter Spesialis (%s)", deptName)
		if amount <= 0 {
			amount = 150000.0
		}
	}

	item := &domain.InvoiceItem{
		ID:          uuid.New().String(),
		InvoiceID:   inv.ID,
		ItemType:    "ACTION",
		Description: desc,
		Amount:      amount,
	}

	err = s.repo.CreateInvoiceItem(ctx, item)
	if err != nil {
		return "", err
	}

	err = s.repo.UpdateInvoiceAmount(ctx, inv.ID, amount)
	if err != nil {
		return "", err
	}
	
	return inv.ID, nil
}

func (s *billingServiceImpl) AddActionItem(ctx context.Context, encounterNo, actionCode, description string, amount float64) error {
	inv, err := s.getOrCreateUnpaidActionInvoice(ctx, encounterNo)
	if err != nil {
		return err
	}

	item := &domain.InvoiceItem{
		ID:          uuid.New().String(),
		InvoiceID:   inv.ID,
		ItemType:    "ACTION",
		Description: fmt.Sprintf("[%s] %s", actionCode, description),
		Amount:      amount,
	}

	err = s.repo.CreateInvoiceItem(ctx, item)
	if err != nil {
		return err
	}

	err = s.repo.UpdateInvoiceAmount(ctx, inv.ID, amount)
	if err != nil {
		return err
	}

	// Publish InvoiceCreated / InvoiceUpdated event to Outbox
	payload := fmt.Sprintf(`{"invoice_id":"%s","encounter_no":"%s","amount":%f}`, inv.ID, inv.EncounterNo, amount)
	_ = s.repo.CreateOutboxEvent(ctx, uuid.New().String(), "Invoice", "InvoiceCreated", payload)

	return nil
}

func (s *billingServiceImpl) GetActionPaymentStatus(ctx context.Context, encounterNo, actionCode string) (string, string, bool, error) {
	pattern := fmt.Sprintf("%%[%s]%%", actionCode)
	invoiceID, invoiceStatus, err := s.repo.GetInvoiceItemByPattern(ctx, encounterNo, pattern)
	if err != nil {
		return "", "", false, err
	}
	isPaid := invoiceStatus == "PAID"
	return invoiceID, invoiceStatus, isPaid, nil
}

func (s *billingServiceImpl) RemoveActionItem(ctx context.Context, encounterNo, actionCode string) error {
	pattern := fmt.Sprintf("%%[%s]%%", actionCode)
	invoiceID, invoiceStatus, err := s.repo.GetInvoiceItemByPattern(ctx, encounterNo, pattern)
	if err != nil {
		return err
	}

	if invoiceStatus == "PAID" {
		return fmt.Errorf("cannot remove medical action: invoice is already paid")
	}

	err = s.repo.SoftDeleteInvoiceItemByPattern(ctx, invoiceID, pattern)
	if err != nil {
		return err
	}

	return s.repo.RecalculateInvoiceTotal(ctx, invoiceID)
}

func (s *billingServiceImpl) AddMedicineItem(ctx context.Context, encounterNo, prescriptionID string, amount float64) error {
	inv, err := s.getOrCreateUnpaidActionInvoice(ctx, encounterNo)
	if err != nil {
		return err
	}

	item := &domain.InvoiceItem{
		ID:          uuid.New().String(),
		InvoiceID:   inv.ID,
		ItemType:    "MEDICINE",
		Description: fmt.Sprintf("Prescription: %s", prescriptionID),
		Amount:      amount,
	}

	err = s.repo.CreateInvoiceItem(ctx, item)
	if err != nil {
		return err
	}

	err = s.repo.UpdateInvoiceAmount(ctx, inv.ID, amount)
	if err != nil {
		return err
	}

	payload := fmt.Sprintf(`{"invoice_id":"%s","encounter_no":"%s","amount":%f}`, inv.ID, inv.EncounterNo, amount)
	_ = s.repo.CreateOutboxEvent(ctx, uuid.New().String(), "Invoice", "InvoiceCreated", payload)

	return nil
}

func (s *billingServiceImpl) GenerateInvoice(ctx context.Context, encounterNo string) (*domain.Invoice, error) {
	// First check if there is an active unpaid invoice
	unpaidInv, errUnpaid := s.repo.GetActiveUnpaidInvoiceByEncounterNo(ctx, encounterNo)
	if errUnpaid == nil && unpaidInv != nil {
		return unpaidInv, nil
	}

	// Otherwise check latest invoice
	inv, err := s.repo.GetInvoiceByEncounterNo(ctx, encounterNo)
	if err != nil {
		var deptCode = "01"
		if len(encounterNo) >= 8 {
			deptCode = encounterNo[6:8]
		}
		fee := 150000.0
		if deptCode == "01" || deptCode == "UMU" {
			fee = 50000.0
		}
		_, errFee := s.AddRegistrationFee(ctx, encounterNo, deptCode, fee)
		if errFee != nil {
			return nil, fmt.Errorf("no invoice found for encounter: %s", encounterNo)
		}
		return s.repo.GetInvoiceByEncounterNo(ctx, encounterNo)
	}
	return inv, nil
}

func (s *billingServiceImpl) GetInvoicesByEncounter(ctx context.Context, encounterNo string) ([]*domain.Invoice, error) {
	return s.repo.GetInvoicesByEncounterNo(ctx, encounterNo)
}

func (s *billingServiceImpl) PayInvoice(ctx context.Context, invoiceID string, amountPaid float64) (string, error) {
	inv, err := s.repo.GetInvoice(ctx, invoiceID)
	if err != nil {
		return "", err
	}
	
	if inv.Status == "PAID" {
		return "", fmt.Errorf("invoice is already paid")
	}

	if amountPaid < inv.TotalAmount {
		return "", fmt.Errorf("insufficient amount. Total is %.2f", inv.TotalAmount)
	}

	err = s.repo.UpdateInvoiceStatus(ctx, invoiceID, "PAID")
	if err != nil {
		return "", err
	}

	// Publish InvoicePaid event to Outbox
	payload := fmt.Sprintf(`{"invoice_id":"%s","encounter_no":"%s","amount_paid":%f}`, invoiceID, inv.EncounterNo, amountPaid)
	err = s.repo.CreateOutboxEvent(ctx, uuid.New().String(), "Invoice", "InvoicePaid", payload)
	if err != nil {
		slog.Warn("Failed to create outbox event for InvoicePaid", "error", err)
	}

	return inv.EncounterNo, nil
}

func (s *billingServiceImpl) CancelInvoice(ctx context.Context, invoiceID string) (string, error) {
	inv, err := s.repo.GetInvoice(ctx, invoiceID)
	if err != nil {
		return "", err
	}

	if inv.Status == "PAID" {
		return "", fmt.Errorf("cannot cancel paid invoice")
	}

	err = s.repo.UpdateInvoiceStatus(ctx, invoiceID, "CANCELLED")
	if err != nil {
		return "", err
	}

	// Publish InvoiceCancelled event to Outbox
	payload := fmt.Sprintf(`{"invoice_id":"%s","encounter_no":"%s"}`, invoiceID, inv.EncounterNo)
	err = s.repo.CreateOutboxEvent(ctx, uuid.New().String(), "Invoice", "InvoiceCancelled", payload)
	if err != nil {
		slog.Warn("Failed to create outbox event for InvoiceCancelled", "error", err)
	}

	return inv.EncounterNo, nil
}
