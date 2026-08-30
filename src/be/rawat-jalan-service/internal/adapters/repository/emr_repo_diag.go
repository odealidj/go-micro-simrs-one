package repository

import (
	"context"
	"database/sql"

	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/domain"
	"github.com/google/uuid"
)

func (r *emrRepoSqlc) AddEncounterDiagnosis(ctx context.Context, encounterNo, icd10Code, diagType, notes, severity, doctorId, deptCode, gender, ageBracket string, sequence int32) (*domain.EncounterDiagnosis, error) {
	id := uuid.New().String()
	
	var n sql.NullString
	if notes != "" {
		n = sql.NullString{String: notes, Valid: true}
	}
	
	if severity == "" {
		severity = "RINGAN"
	}
	
	var doc sql.NullString
	if doctorId != "" {
		doc = sql.NullString{String: doctorId, Valid: true}
	}

	// If adding a PRIMARY diagnosis, demote any existing primary diagnoses first
	if diagType == "PRIMARY" {
		_ = r.q.DemotePrimaryDiagnoses(ctx, encounterNo)
	}

	// 1. Auto-lookup KBM suggestion
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
		if !kbmCode.Valid {
			kbmCode = sql.NullString{String: suggestions[0].KBMCode, Valid: true}
			kbmName = sql.NullString{String: suggestions[0].KBMName, Valid: true}
			kbmConf = sql.NullString{String: suggestions[0].MappingConfidence, Valid: true}
		}
	}

	// 2. Auto-lookup SNOMED concept
	var snomedConceptId sql.NullString
	snomedList, _ := r.q.GetSNOMEDForICD10(ctx, icd10Code)
	if len(snomedList) > 0 {
		snomedConceptId = sql.NullString{String: snomedList[0].ConceptID, Valid: true}
	}
	
	dbDiag, err := r.q.AddEncounterDiagnosis(ctx, db.AddEncounterDiagnosisParams{
		ID:                   uuid.MustParse(id),
		EncounterNo:         encounterNo,
		Icd10Code:           icd10Code,
		DiagnosisType:       diagType,
		Sequence:            sequence,
		ClinicalNotes:       n,
		SeverityLevel:       severity,
		SeveritySetBy:       doc,
		SeveritySetRole:     sql.NullString{String: "DOKTER", Valid: true},
		AutoKbmCode:         kbmCode,
		AutoKbmName:         kbmName,
		KbmMappingConfidence: kbmConf,
		SnomedConceptID:     snomedConceptId,
		CreatedBy:           doc,
	})
	
	if err != nil {
		return nil, err
	}
	
	return &domain.EncounterDiagnosis{
		ID:                   dbDiag.ID.String(),
		ICD10Code:            dbDiag.Icd10Code,
		DiagnosisType:        dbDiag.DiagnosisType,
		Sequence:             dbDiag.Sequence,
		ClinicalNotes:        dbDiag.ClinicalNotes.String,
		SeverityLevel:        dbDiag.SeverityLevel,
		AutoKBMCode:          dbDiag.AutoKbmCode.String,
		AutoKBMName:          dbDiag.AutoKbmName.String,
		KBMMappingConfidence: dbDiag.KbmMappingConfidence.String,
		SNOMEDConceptID:      dbDiag.SnomedConceptID.String,
	}, nil
}

func (r *emrRepoSqlc) UpdateEncounterDiagnosis(ctx context.Context, id, diagType, notes, severity string, sequence int32) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	var n sql.NullString
	if notes != "" {
		n = sql.NullString{String: notes, Valid: true}
	}

	if severity == "" {
		severity = "RINGAN"
	}

	return r.q.UpdateEncounterDiagnosis(ctx, db.UpdateEncounterDiagnosisParams{
		ID:            uid,
		DiagnosisType: diagType,
		Sequence:      sequence,
		ClinicalNotes: n,
		SeverityLevel: severity,
	})
}

func (r *emrRepoSqlc) RemoveEncounterDiagnosis(ctx context.Context, id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	// Fetch diagnosis to get encounter_no
	dbDiag, err := r.q.GetEncounterDiagnosisByID(ctx, uid)
	if err != nil {
		return r.q.RemoveEncounterDiagnosis(ctx, uid)
	}

	if err := r.q.RemoveEncounterDiagnosis(ctx, uid); err != nil {
		return err
	}

	// Automatically reset encounter severity if all active diagnoses for this encounter are now deleted
	_ = r.q.ResetEncounterSeverityIfNoDiagnoses(ctx, dbDiag.EncounterNo)
	return nil
}

func (r *emrRepoSqlc) PromoteDiagnosisToPrimary(ctx context.Context, encounterNo, diagnosisId string) error {
	uid, err := uuid.Parse(diagnosisId)
	if err != nil {
		return err
	}
	// Demote existing primary first
	if err := r.q.DemotePrimaryDiagnoses(ctx, encounterNo); err != nil {
		return err
	}
	// Promote target diagnosis to primary
	return r.q.PromoteDiagnosisToPrimary(ctx, uid)
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
	return []*domain.PendingVerification{}, 0, nil
}

func (r *emrRepoSqlc) VerifyKBMMapping(ctx context.Context, id, kbmCode, userId string) error {
	return nil
}

func (r *emrRepoSqlc) FinalizeSeverity(ctx context.Context, encounterNo, severityLevel, userId string) error {
	var uid sql.NullString
	if userId != "" {
		uid = sql.NullString{String: userId, Valid: true}
	}
	return r.q.FinalizeSeverity(ctx, db.FinalizeSeverityParams{
		EncounterNo:            encounterNo,
		EncounterSeverityLevel: sql.NullString{String: severityLevel, Valid: true},
		SeverityFinalizedBy:    uid,
	})
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
			ID:                   d.ID.String(),
			ICD10Code:            d.Icd10Code,
			ICD10Name:            d.Icd10Name,
			DiagnosisType:        d.DiagnosisType,
			Sequence:             d.Sequence,
			ClinicalNotes:        d.ClinicalNotes.String,
			SeverityLevel:        d.SeverityLevel,
			SeveritySetRole:      d.SeveritySetRole.String,
			AutoKBMCode:          d.AutoKbmCode.String,
			AutoKBMName:          d.AutoKbmName.String,
			KBMMappingConfidence: d.KbmMappingConfidence.String,
			SNOMEDConceptID:      d.SnomedConceptID.String,
			SNOMEDName:           d.SnomedName.String,
			IsVerifiedByRM:       d.IsVerifiedByRm,
			VerifiedBy:           d.VerifiedBy.String,
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

