package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/domain"
)

type BillingRepository interface {
	GetInvoiceByEncounterNo(ctx context.Context, encounterNo string) (*domain.Invoice, error)
	GetInvoicesByEncounterNo(ctx context.Context, encounterNo string) ([]*domain.Invoice, error)
	GetActiveUnpaidInvoiceByEncounterNo(ctx context.Context, encounterNo string) (*domain.Invoice, error)
	GetInvoiceItemByPattern(ctx context.Context, encounterNo, pattern string) (invoiceID string, invoiceStatus string, err error)
	GetInvoice(ctx context.Context, id string) (*domain.Invoice, error)
	CreateInvoice(ctx context.Context, invoice *domain.Invoice) error
	CreateInvoiceItem(ctx context.Context, item *domain.InvoiceItem) error
	UpdateInvoiceAmount(ctx context.Context, id string, amount float64) error
	UpdateInvoiceStatus(ctx context.Context, id, status string) error
	SoftDeleteInvoiceItemByPattern(ctx context.Context, invoiceID, pattern string) error
	RecalculateInvoiceTotal(ctx context.Context, invoiceID string) error
	CreateOutboxEvent(ctx context.Context, eventID, aggregateType, eventType, payload string) error
}

type BillingService interface {
	AddActionItem(ctx context.Context, encounterNo, actionCode, description string, amount float64) error
	RemoveActionItem(ctx context.Context, encounterNo, actionCode string) error
	AddMedicineItem(ctx context.Context, encounterNo, prescriptionID string, amount float64) error
	AddRegistrationFee(ctx context.Context, encounterNo, departmentCode string, amount float64) (string, error)
	
	GenerateInvoice(ctx context.Context, encounterNo string) (*domain.Invoice, error)
	GetInvoicesByEncounter(ctx context.Context, encounterNo string) ([]*domain.Invoice, error)
	GetActionPaymentStatus(ctx context.Context, encounterNo, actionCode string) (string, string, bool, error)
	PayInvoice(ctx context.Context, invoiceID string, amountPaid float64) (string, error)
	CancelInvoice(ctx context.Context, invoiceID string) (string, error)
}
