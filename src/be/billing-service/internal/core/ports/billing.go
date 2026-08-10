package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/domain"
)

type BillingRepository interface {
	GetInvoiceByEncounterNo(ctx context.Context, encounterNo string) (*domain.Invoice, error)
	GetInvoice(ctx context.Context, id string) (*domain.Invoice, error)
	CreateInvoice(ctx context.Context, invoice *domain.Invoice) error
	CreateInvoiceItem(ctx context.Context, item *domain.InvoiceItem) error
	UpdateInvoiceAmount(ctx context.Context, id string, amount float64) error
	UpdateInvoiceStatus(ctx context.Context, id, status string) error
	CreateOutboxEvent(ctx context.Context, eventID, aggregateType, eventType, payload string) error
}

type BillingService interface {
	AddActionItem(ctx context.Context, encounterNo, actionCode, description string, amount float64) error
	AddMedicineItem(ctx context.Context, encounterNo, prescriptionID string, amount float64) error
	
	GenerateInvoice(ctx context.Context, encounterNo string) (*domain.Invoice, error)
	PayInvoice(ctx context.Context, invoiceID string, amountPaid float64) error
}
