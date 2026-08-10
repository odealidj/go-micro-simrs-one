package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/aliube/go-micro-simrs-one/patient-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/patient-service/internal/core/ports"
)

type patientRepoSqlc struct {
	q *db.Queries
}

func NewPatientRepository(d *sql.DB) ports.PatientRepository {
	return &patientRepoSqlc{
		q: db.New(d),
	}
}

func (r *patientRepoSqlc) Save(ctx context.Context, patient *domain.Patient) error {
	_, err := r.q.CreatePatient(ctx, db.CreatePatientParams{
		Mrn:     patient.MRN,
		Name:    patient.Name,
		Nik:     patient.NIK,
		Dob:     patient.DOB,
	})
	return err
}

func (r *patientRepoSqlc) FindByMRN(ctx context.Context, mrn string) (*domain.Patient, error) {
	p, err := r.q.GetPatientByMRN(ctx, mrn)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("patient not found")
		}
		return nil, err
	}

	return &domain.Patient{
		MRN:       p.Mrn,
		Name:      p.Name,
		NIK:       p.Nik,
		DOB:       p.Dob,
		CreatedAt: p.CreatedAt.Time,
	}, nil
}
