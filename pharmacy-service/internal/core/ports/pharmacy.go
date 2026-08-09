package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
)

type PharmacyRepository interface {
	ReserveStock(ctx context.Context, itemCode string, quantity int32) error
	ReleaseStock(ctx context.Context, itemCode string, quantity int32) error
	SavePrescription(ctx context.Context, prescription *domain.Prescription) error
	GetPrescription(ctx context.Context, id string) (*domain.Prescription, error)
	UpdatePrescriptionStatus(ctx context.Context, id, status string) error
}

type PharmacyService interface {
	Prescribe(ctx context.Context, encounterNo, itemCode string, quantity int32) (*domain.Prescription, error)
	RollbackPrescription(ctx context.Context, prescriptionID string) error
}
