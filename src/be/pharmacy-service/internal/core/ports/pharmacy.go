package ports

import (
	"context"
	"time"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
)

type PharmacyRepository interface {
	CreatePrescription(ctx context.Context, prescription *domain.Prescription) error
	GetPrescription(ctx context.Context, id string) (*domain.Prescription, error)
	UpdatePrescriptionStatus(ctx context.Context, id, status string) error
	GetInventoryItemPrice(ctx context.Context, itemCode string) (float64, error)
	DeductStock(ctx context.Context, itemCode string, quantity int32) error
	DispensePrescription(ctx context.Context, prescriptionID string) error
	UpsertEncounterPayment(ctx context.Context, encounterNo, status string, paidAt *time.Time) error
	GetEncounterPaymentStatus(ctx context.Context, encounterNo string) (string, error)
	EstimateWaitTime(ctx context.Context, doctorID, departmentCode, gender, ageBracket string, isCompounded bool) (int64, error)
}

type PharmacyService interface {
	CreatePrescription(ctx context.Context, encounterNo string, isCompounded bool, notes string, diagnosis, gender, ageBracket, doctorID, departmentCode string, items []domain.PrescriptionItem) (string, error)
	DispensePrescription(ctx context.Context, prescriptionID string) error
	RollbackPrescription(ctx context.Context, prescriptionID string) error
	EstimateWaitTime(ctx context.Context, doctorID, departmentCode, gender, ageBracket string, isCompounded bool) (int64, error)
}
