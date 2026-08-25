package repository

import (
	"context"
	"database/sql"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/domain"
	"github.com/google/uuid"
)

func (r *emrRepoSqlc) AddEncounterDiagnosis(ctx context.Context, encounterNo, icd10Code, diagType, notes, severity, doctorId, deptCode, gender, ageBracket string, sequence int32) (*domain.EncounterDiagnosis, error) {
	id := uuid.New().String()
	
	var n sql.NullString
	if notes != "" {
		n = sql.NullString{String: notes, Valid: true}
	}
	
	// Default to RINGAN if not provided
	if severity == "" {
		severity = "RINGAN"
	}
	
	var doc sql.NullString
	if doctorId != "" {
		doc = sql.NullString{String: doctorId, Valid: true}
	}

	// For MVP, we aren't doing the auto-mapping lookup here to keep it simple,
	// but we could call GetKBMSuggestionsForICD10 and pick the primary one.
	suggestions, _ := r.GetKBMSuggestionsForICD10(ctx, icd10Code)
	var kbmCode, kbmName, kbmConf sql.NullString
	if len(suggestions) > 0 {
		for _, s := range suggestions {
			if s.IsPrimary {
				kbmCode = sql.NullString{String: s.KBMCode, Valid: true}
				kbmName = sql.NullString{String: s.KBMName, Valid: true}
				kbmConf = sql.NullString{String: s.MappingConfidence, Valid: true}
				break
			}
		}
		// fallback to first if no primary
		if !kbmCode.Valid {
			kbmCode = sql.NullString{String: suggestions[0].KBMCode, Valid: true}
			kbmName = sql.NullString{String: suggestions[0].KBMName, Valid: true}
			kbmConf = sql.NullString{String: suggestions[0].MappingConfidence, Valid: true}
		}
	}
	
	dbDiag, err := r.q.AddEncounterDiagnosis(ctx, db.AddEncounterDiagnosisParams{
		ID:              uuid.MustParse(id),
		EncounterNo:     encounterNo,
		Icd10Code:       icd10Code,
		DiagnosisType:   diagType,
		Sequence:        sequence,
		ClinicalNotes:   n,
		SeverityLevel:   severity,
		SeveritySetBy:   doc,
		SeveritySetRole: sql.NullString{String: "DOKTER", Valid: true},
		AutoKbmCode:     kbmCode,
		AutoKbmName:     kbmName,
		KbmMappingConfidence: kbmConf,
		CreatedBy:       doc,
	})
	
	if err != nil {
		return nil, err
	}
	
	return &domain.EncounterDiagnosis{
		ID:            dbDiag.ID.String(),
		ICD10Code:     dbDiag.Icd10Code,
		DiagnosisType: dbDiag.DiagnosisType,
		Sequence:      dbDiag.Sequence,
		ClinicalNotes: dbDiag.ClinicalNotes.String,
		SeverityLevel: dbDiag.SeverityLevel,
	}, nil
}

func (r *emrRepoSqlc) UpdateEncounterDiagnosis(ctx context.Context, id, diagType, notes, severity string, sequence int32) error {
	// Not implemented in MVP SQLC yet, returning nil
	return nil
}

func (r *emrRepoSqlc) RemoveEncounterDiagnosis(ctx context.Context, id string) error {
	// Not implemented in MVP SQLC yet, returning nil
	return nil
}

func (r *emrRepoSqlc) GetKBMSuggestionsForICD10(ctx context.Context, icd10Code string) ([]*domain.KBMSuggestion, error) {
	dbItems, err := r.q.GetKBMSuggestionsForICD10(ctx, icd10Code)
	if err != nil {
		return nil, err
	}
	
	var items []*domain.KBMSuggestion
	for _, item := range dbItems {
		items = append(items, &domain.KBMSuggestion{
			KBMCode:           item.KbmCode,
			KBMName:           item.KbmName,
			IsPrimary:         item.IsPrimary.Bool,
			MappingConfidence: item.MappingConfidence.String,
		})
	}
	return items, nil
}

func (r *emrRepoSqlc) ListPendingKBMVerifications(ctx context.Context, limit, offset int32) ([]*domain.PendingVerification, int32, error) {
	// Not fully implemented for MVP
	return []*domain.PendingVerification{}, 0, nil
}

func (r *emrRepoSqlc) VerifyKBMMapping(ctx context.Context, id, kbmCode, userId string) error {
	return nil
}

func (r *emrRepoSqlc) FinalizeSeverity(ctx context.Context, encounterNo, severityLevel, userId string) error {
	return nil
}

// Validation helpers
func (r *emrRepoSqlc) GetEncounterDiagnoses(ctx context.Context, encounterNo string) ([]*domain.EncounterDiagnosis, error) {
	dbDiags, err := r.q.GetEncounterDiagnoses(ctx, encounterNo)
	if err != nil {
		return nil, err
	}
	var diags []*domain.EncounterDiagnosis
	for _, d := range dbDiags {
		diags = append(diags, &domain.EncounterDiagnosis{
			ID:            d.ID.String(),
			ICD10Code:     d.Icd10Code,
			DiagnosisType: d.DiagnosisType,
			Sequence:      d.Sequence,
			ClinicalNotes: d.ClinicalNotes.String,
			SeverityLevel: d.SeverityLevel,
		})
	}
	return diags, nil
}

func (r *emrRepoSqlc) GetEncounterResepCount(ctx context.Context, encounterNo string) (int, error) {
	reseps, err := r.q.GetEncounterResep(ctx, encounterNo)
	if err != nil {
		return 0, err
	}
	return len(reseps), nil
}

func (r *emrRepoSqlc) CheckKarcisUnpaid(ctx context.Context, encounterNo string) (bool, error) {
	return r.q.CheckKarcisUnpaid(ctx, encounterNo)
}

func (r *emrRepoSqlc) CheckKarcisPaid(ctx context.Context, encounterNo string) (bool, error) {
	return r.q.CheckKarcisPaid(ctx, encounterNo)
}

func (r *emrRepoSqlc) GetEncounterTindakanCount(ctx context.Context, encounterNo string) (int, error) {
	tindakans, err := r.q.GetEncounterTindakan(ctx, encounterNo)
	if err != nil {
		return 0, err
	}
	return len(tindakans), nil
}

