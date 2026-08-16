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
	ListPatients(ctx context.Context, limit, offset int, search string) ([]*domain.Patient, int, error)
	DeletePatient(ctx context.Context, mrn string) error
}

type PatientService interface {
	RegisterPatient(ctx context.Context, name, nik, dob, gender, birthPlace, address, photoURL, email, userID string) (mrn string, err error)
	GetPatientByMRN(ctx context.Context, mrn string) (*domain.Patient, error)
	SearchPatients(ctx context.Context, page, pageSize int, search string) ([]*domain.Patient, int, error)
	DeletePatient(ctx context.Context, mrn string) error
}
