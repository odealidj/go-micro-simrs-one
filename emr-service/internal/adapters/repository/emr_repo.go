package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/ports"
	"github.com/google/uuid"
)

type emrRepoSqlc struct {
	q *db.Queries
}

func NewEMRRepository(d *sql.DB) ports.EMRRepository {
	return &emrRepoSqlc{
		q: db.New(d),
	}
}

func (r *emrRepoSqlc) CreateDraft(ctx context.Context, encounterNo, mrn string) error {
	id := uuid.New().String()
	_, err := r.q.CreateDraftMR(ctx, db.CreateDraftMRParams{
		ID:          id,
		EncounterNo: encounterNo,
		Mrn:         mrn,
	})
	return err
}

func (r *emrRepoSqlc) AddDiagnosis(ctx context.Context, encounterNo, icd10Code, notes string) error {
	var n sql.NullString
	if notes != "" {
		n = sql.NullString{String: notes, Valid: true}
	}
	_, err := r.q.AddDiagnosis(ctx, db.AddDiagnosisParams{
		EncounterNo: encounterNo,
		ArrayAppend: icd10Code, 
		Notes:       n,
	})
	return err
}

func (r *emrRepoSqlc) GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error) {
	mr, err := r.q.GetMRByEncounterNo(ctx, encounterNo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("medical record not found")
		}
		return nil, err
	}

	return &domain.MedicalRecord{
		ID:          mr.ID,
		EncounterNo: mr.EncounterNo,
		MRN:         mr.Mrn,
		ICD10Codes:  mr.Icd10Codes, 
		Notes:       mr.Notes.String,
		CreatedAt:   mr.CreatedAt.Time,
		UpdatedAt:   mr.UpdatedAt.Time,
	}, nil
}
