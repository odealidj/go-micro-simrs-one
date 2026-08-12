package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/domain"
)

type PatientRepository interface {
	Save(ctx context.Context, patient *domain.Patient) error
	FindByMRN(ctx context.Context, mrn string) (*domain.Patient, error)
	FindByNIK(ctx context.Context, nik string) (*domain.Patient, error)
	UpdateUserID(ctx context.Context, mrn, userID string) error
}

type PatientService interface {
	RegisterPatient(ctx context.Context, name, nik, dob, userID string) (mrn string, err error)
	GetPatientByMRN(ctx context.Context, mrn string) (*domain.Patient, error)
}
