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
	dbConn *sql.DB
	q      *db.Queries
}

func NewPatientRepository(d *sql.DB) ports.PatientRepository {
	return &patientRepoSqlc{
		dbConn: d,
		q:      db.New(d),
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
		Mrn:        patient.MRN,
		Name:       patient.Name,
		Nik:        patient.NIK,
		Dob:        patient.DOB,
		UserID:     nullUserID,
		Gender:     toNullString(patient.Gender),
		BirthPlace: toNullString(patient.BirthPlace),
		Address:    toNullString(patient.Address),
		PhotoUrl:   toNullString(patient.PhotoURL),
		Email:      toNullString(patient.Email),
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
	return mapDBPatientToDomain(p), nil
}

func (r *patientRepoSqlc) FindByNIK(ctx context.Context, nik string) (*domain.Patient, error) {
	p, err := r.q.GetPatientByNIK(ctx, nik)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("patient not found")
		}
		return nil, err
	}
	return mapDBPatientToDomain(p), nil
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

func (r *patientRepoSqlc) ListPatients(ctx context.Context, limit, offset int, search string) ([]*domain.Patient, int, error) {
	searchQuery := "%" + search + "%"
	
	count, err := r.q.CountPatients(ctx, searchQuery)
	if err != nil {
		return nil, 0, err
	}

	rows, err := r.q.ListPatients(ctx, db.ListPatientsParams{
		Name:   searchQuery,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	var patients []*domain.Patient
	for _, row := range rows {
		patients = append(patients, &domain.Patient{
			MRN:        row.Mrn,
			Name:       row.Name,
			NIK:        row.Nik,
			DOB:        row.Dob,
			UserID:     parseNullUUID(row.UserID),
			Gender:     parseNullString(row.Gender),
			BirthPlace: parseNullString(row.BirthPlace),
			Address:    parseNullString(row.Address),
			PhotoURL:   parseNullString(row.PhotoUrl),
			Email:      parseNullString(row.Email),
			CreatedAt:  row.CreatedAt.Time,
		})
	}
	return patients, int(count), nil
}

func (r *patientRepoSqlc) DeletePatient(ctx context.Context, mrn string) error {
	// Execute hard delete for compensation flow
	_, err := r.dbConn.ExecContext(ctx, "DELETE FROM patient.patients WHERE mrn = $1", mrn)
	return err
}

func mapDBPatientToDomain(p interface{}) *domain.Patient {
	// Need to handle GetPatientByMRNRow and GetPatientByNIKRow
	switch v := p.(type) {
	case db.GetPatientByMRNRow:
		return &domain.Patient{
			MRN:        v.Mrn,
			Name:       v.Name,
			NIK:        v.Nik,
			DOB:        v.Dob,
			UserID:     parseNullUUID(v.UserID),
			Gender:     parseNullString(v.Gender),
			BirthPlace: parseNullString(v.BirthPlace),
			Address:    parseNullString(v.Address),
			PhotoURL:   parseNullString(v.PhotoUrl),
			Email:      parseNullString(v.Email),
			CreatedAt:  v.CreatedAt.Time,
		}
	case db.GetPatientByNIKRow:
		return &domain.Patient{
			MRN:        v.Mrn,
			Name:       v.Name,
			NIK:        v.Nik,
			DOB:        v.Dob,
			UserID:     parseNullUUID(v.UserID),
			Gender:     parseNullString(v.Gender),
			BirthPlace: parseNullString(v.BirthPlace),
			Address:    parseNullString(v.Address),
			PhotoURL:   parseNullString(v.PhotoUrl),
			Email:      parseNullString(v.Email),
			CreatedAt:  v.CreatedAt.Time,
		}
	}
	return nil
}

func parseNullUUID(u uuid.NullUUID) string {
	if u.Valid {
		return u.UUID.String()
	}
	return ""
}

func toNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func parseNullString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}
