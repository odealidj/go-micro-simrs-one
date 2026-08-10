package services

import (
	"context"
	"fmt"
	"log"
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

func (s *billingServiceImpl) getOrCreateInvoice(ctx context.Context, encounterNo string) (*domain.Invoice, error) {
	inv, err := s.repo.GetInvoiceByEncounterNo(ctx, encounterNo)
	if err == nil {
		return inv, nil // exists
	}

	// Create new
	inv = &domain.Invoice{
		ID:          fmt.Sprintf("INV-%d", time.Now().UnixNano()),
		EncounterNo: encounterNo,
		TotalAmount: 0,
		Status:      "UNPAID",
	}
	err = s.repo.CreateInvoice(ctx, inv)
	if err != nil {
		return nil, err
	}
	return inv, nil
}

func (s *billingServiceImpl) AddActionItem(ctx context.Context, encounterNo, actionCode, description string, amount float64) error {
	inv, err := s.getOrCreateInvoice(ctx, encounterNo)
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

	return s.repo.UpdateInvoiceAmount(ctx, inv.ID, amount)
}

func (s *billingServiceImpl) AddMedicineItem(ctx context.Context, encounterNo, prescriptionID string, amount float64) error {
	inv, err := s.getOrCreateInvoice(ctx, encounterNo)
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

	return s.repo.UpdateInvoiceAmount(ctx, inv.ID, amount)
}

func (s *billingServiceImpl) GenerateInvoice(ctx context.Context, encounterNo string) (*domain.Invoice, error) {
	// Simple fetch, since items are appended asynchronously by the consumer
	inv, err := s.repo.GetInvoiceByEncounterNo(ctx, encounterNo)
	if err != nil {
		return nil, fmt.Errorf("no invoice found for encounter: %s", encounterNo)
	}
	return inv, nil
}

func (s *billingServiceImpl) PayInvoice(ctx context.Context, invoiceID string, amountPaid float64) error {
	inv, err := s.repo.GetInvoice(ctx, invoiceID)
	if err != nil {
		return err
	}
	
	if inv.Status == "PAID" {
		return fmt.Errorf("invoice is already paid")
	}

	if amountPaid < inv.TotalAmount {
		return fmt.Errorf("insufficient amount. Total is %.2f", inv.TotalAmount)
	}

	err = s.repo.UpdateInvoiceStatus(ctx, invoiceID, "PAID")
	if err != nil {
		return err
	}

	// Publish InvoicePaid event to Outbox
	payload := fmt.Sprintf(`{"invoice_id":"%s","encounter_no":"%s","amount_paid":%f}`, invoiceID, inv.EncounterNo, amountPaid)
	err = s.repo.CreateOutboxEvent(ctx, uuid.New().String(), "Invoice", "InvoicePaid", payload)
	if err != nil {
		log.Printf("Warning: Failed to create outbox event for InvoicePaid: %v", err)
	}

	return nil
}
