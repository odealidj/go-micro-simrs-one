package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
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
	var nullUserID uuid.NullUUID
	if patient.UserID != "" {
		parsed, err := uuid.Parse(patient.UserID)
		if err == nil {
			nullUserID = uuid.NullUUID{UUID: parsed, Valid: true}
		}
	}

	_, err := r.q.CreatePatient(ctx, db.CreatePatientParams{
		Mrn:    patient.MRN,
		Name:   patient.Name,
		Nik:    patient.NIK,
		Dob:    patient.DOB,
		UserID: nullUserID,
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
		UserID:    parseNullUUID(p.UserID),
		CreatedAt: p.CreatedAt.Time,
	}, nil
}

func (r *patientRepoSqlc) FindByNIK(ctx context.Context, nik string) (*domain.Patient, error) {
	p, err := r.q.GetPatientByNIK(ctx, nik)
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
		UserID:    parseNullUUID(p.UserID),
		CreatedAt: p.CreatedAt.Time,
	}, nil
}

func (r *patientRepoSqlc) UpdateUserID(ctx context.Context, mrn, userID string) error {
	parsed, err := uuid.Parse(userID)
	if err != nil {
		return err
	}
	return r.q.UpdatePatientUserID(ctx, db.UpdatePatientUserIDParams{
		Mrn:    mrn,
		UserID: uuid.NullUUID{UUID: parsed, Valid: true},
	})
}

func parseNullUUID(u uuid.NullUUID) string {
	if u.Valid {
		return u.UUID.String()
	}
	return ""
}
