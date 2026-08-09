package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/domain"
)

type BillingRepository interface {
	SaveInvoice(ctx context.Context, invoice *domain.Invoice) error
}

type BillingService interface {
	CreateInvoice(ctx context.Context, encounterNo, relatedID string, amount float64) (*domain.Invoice, error)
}
