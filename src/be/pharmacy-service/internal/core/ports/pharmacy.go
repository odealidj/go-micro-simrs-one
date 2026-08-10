package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
)

type PharmacyRepository interface {
	CreatePrescription(ctx context.Context, prescription *domain.Prescription) error
	GetPrescription(ctx context.Context, id string) (*domain.Prescription, error)
	UpdatePrescriptionStatus(ctx context.Context, id, status string) error
	GetInventoryItemPrice(ctx context.Context, itemCode string) (float64, error)
	DeductStock(ctx context.Context, itemCode string, quantity int32) error
	DispensePrescription(ctx context.Context, prescriptionID string) error
}

type PharmacyService interface {
	CreatePrescription(ctx context.Context, encounterNo string, isCompounded bool, notes string, items []domain.PrescriptionItem) (string, error)
	DispensePrescription(ctx context.Context, prescriptionID string) error
	RollbackPrescription(ctx context.Context, prescriptionID string) error
}
