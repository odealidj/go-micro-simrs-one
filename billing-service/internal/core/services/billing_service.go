package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/ports"
)

type billingServiceImpl struct {
	repo ports.BillingRepository
}

func NewBillingService(repo ports.BillingRepository) ports.BillingService {
	return &billingServiceImpl{repo: repo}
}

func (s *billingServiceImpl) CreateInvoice(ctx context.Context, encounterNo, relatedID string, amount float64) (*domain.Invoice, error) {
	invoice := &domain.Invoice{
		ID:          fmt.Sprintf("INV-%d", time.Now().UnixNano()),
		EncounterNo: encounterNo,
		RelatedID:   relatedID,
		Amount:      amount,
		Status:      "UNPAID",
		CreatedAt:   time.Now(),
	}

	if s.repo != nil {
		err := s.repo.SaveInvoice(ctx, invoice)
		if err != nil {
			return nil, err
		}
	}

	return invoice, nil
}
