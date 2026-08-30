package ports

import (
	"context"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/domain"
)

type EMRRepository interface {
	CreateDraft(ctx context.Context, encounterNo, mrn string) error
	StartEncounter(ctx context.Context, encounterNo string) error
	UpsertTriage(ctx context.Context, encounterNo, mrn string, triage domain.TriageData) error
	AddMedicalAction(ctx context.Context, encounterNo, recordID, actionCode, actionName string, price float64, notes string) error
	RemoveMedicalAction(ctx context.Context, id string) error
	GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error)
	EstimateWaitTime(ctx context.Context, doctorID, deptCode, gender, ageBracket string) (int64, error)

	// KBM
	SearchKBM(ctx context.Context, deptCode, query string, limit, offset int32) ([]*domain.KBMItem, int32, error)
	GetKBMDetail(ctx context.Context, kbmCode string) (*domain.KBMItem, error)
	// ICD-10 First Diagnosis Flow
	AddEncounterDiagnosis(ctx context.Context, encounterNo, icd10Code, diagType, notes, severity, doctorId, deptCode, gender, ageBracket string, sequence int32) (*domain.EncounterDiagnosis, error)
	UpdateEncounterDiagnosis(ctx context.Context, id, diagType, notes, severity string, sequence int32) error
	RemoveEncounterDiagnosis(ctx context.Context, id string) error
	PromoteDiagnosisToPrimary(ctx context.Context, encounterNo, diagnosisId string) error
	GetKBMSuggestionsForICD10(ctx context.Context, icd10Code string) ([]*domain.KBMSuggestion, error)

	// Verification by Rekam Medis
	ListPendingKBMVerifications(ctx context.Context, limit, offset int32) ([]*domain.PendingVerification, int32, error)
	VerifyKBMMapping(ctx context.Context, id, kbmCode, userId string) error
	FinalizeSeverity(ctx context.Context, encounterNo, severityLevel, userId string) error
	CompleteEncounter(ctx context.Context, encounterNo string) error
	
	// Validation helpers
	GetEncounterDiagnoses(ctx context.Context, encounterNo string) ([]*domain.EncounterDiagnosis, error)
	GetEncounterResepCount(ctx context.Context, encounterNo string) (int, error)
	CheckKarcisUnpaid(ctx context.Context, encounterNo string) (bool, error)
	CheckKarcisPaid(ctx context.Context, encounterNo string) (bool, error)
	GetEncounterTindakanCount(ctx context.Context, encounterNo string) (int, error)
}

type EMRService interface {
	CreateDraftMR(ctx context.Context, encounterNo, mrn string) error
	StartEncounter(ctx context.Context, encounterNo string) error
	SubmitTriage(ctx context.Context, encounterNo, mrn string, triage domain.TriageData) error
	AddMedicalAction(ctx context.Context, encounterNo, actionCode, actionName string, price float64, notes string) error
	RemoveMedicalAction(ctx context.Context, id string) error
	GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error)
	EstimateWaitTime(ctx context.Context, doctorID, deptCode, gender, ageBracket string) (int64, error)

	// KBM
	SearchKBM(ctx context.Context, deptCode, query string, limit, offset int32) ([]*domain.KBMItem, int32, error)
	GetKBMDetail(ctx context.Context, kbmCode string) (*domain.KBMItem, error)
	
	// ICD-10 First Diagnosis Flow
	AddEncounterDiagnosis(ctx context.Context, encounterNo, icd10Code, diagType, notes, severity, doctorId, deptCode, gender, ageBracket string, sequence int32) (*domain.EncounterDiagnosis, error)
	UpdateEncounterDiagnosis(ctx context.Context, id, diagType, notes, severity string, sequence int32) error
	RemoveEncounterDiagnosis(ctx context.Context, id string) error
	PromoteDiagnosisToPrimary(ctx context.Context, encounterNo, diagnosisId string) error
	GetKBMSuggestionsForICD10(ctx context.Context, icd10Code string) ([]*domain.KBMSuggestion, error)

	// Verification by Rekam Medis
	ListPendingKBMVerifications(ctx context.Context, limit, offset int32) ([]*domain.PendingVerification, int32, error)
	VerifyKBMMapping(ctx context.Context, id, kbmCode, userId string) error
	FinalizeSeverity(ctx context.Context, encounterNo, severityLevel, userId string) error
	CompleteEncounter(ctx context.Context, encounterNo string) error
	FinalizeMedicalRecord(ctx context.Context, encounterNo, doctorId string) ([]string, error)
}

// EventSubscriber interface to listen to outbox events
type EventSubscriber interface {
	StartListening(ctx context.Context, topic string) error
}
