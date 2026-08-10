package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/domain"
)

type PatientRepository interface {
	Save(ctx context.Context, patient *domain.Patient) error
	FindByMRN(ctx context.Context, mrn string) (*domain.Patient, error)
}

type PatientService interface {
	RegisterPatient(ctx context.Context, name, nik, dob string) (mrn string, err error)
	GetPatientByMRN(ctx context.Context, mrn string) (*domain.Patient, error)
}
