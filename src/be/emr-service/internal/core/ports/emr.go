package ports

import (
	"context"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/domain"
)

type EMRRepository interface {
	CreateDraft(ctx context.Context, encounterNo, mrn string) error
	StartEncounter(ctx context.Context, encounterNo string) error
	UpdateTriage(ctx context.Context, encounterNo string, systolic, diastolic *int32, temp *float64, heartRate *int32, notes string) error
	AddMedicalAction(ctx context.Context, encounterNo, recordID, actionCode, actionName string, price float64, notes string) error
	GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error)
	EstimateWaitTime(ctx context.Context, doctorID, deptCode, gender, ageBracket string) (int64, error)

	// KBM
	SearchKBM(ctx context.Context, deptCode, query string, limit, offset int32) ([]*domain.KBMItem, int32, error)
	GetKBMDetail(ctx context.Context, kbmCode string) (*domain.KBMItem, error)
	GetICD10SuggestionsForKBM(ctx context.Context, kbmCode string) ([]*domain.ICD10Suggestion, error)
	AddDiagnosisKBM(ctx context.Context, encounterNo, kbmCode, kbmName, notes, doctorId, deptCode, gender, ageBracket string) error
	VerifyICD10Mapping(ctx context.Context, encounterNo string, icd10Codes []string, notes string) error
	ListPendingICD10Verifications(ctx context.Context, limit, offset int32) ([]*domain.PendingVerification, int32, error)
	CompleteEncounter(ctx context.Context, encounterNo string) error
}

type EMRService interface {
	CreateDraftMR(ctx context.Context, encounterNo, mrn string) error
	StartEncounter(ctx context.Context, encounterNo string) error
	SubmitTriage(ctx context.Context, encounterNo string, systolic, diastolic *int32, temp *float64, heartRate *int32, notes string) error
	AddMedicalAction(ctx context.Context, encounterNo, actionCode, actionName string, price float64, notes string) error
	GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error)
	EstimateWaitTime(ctx context.Context, doctorID, deptCode, gender, ageBracket string) (int64, error)

	// KBM
	SearchKBM(ctx context.Context, deptCode, query string, limit, offset int32) ([]*domain.KBMItem, int32, error)
	GetKBMDetail(ctx context.Context, kbmCode string) (*domain.KBMItem, error)
	GetICD10SuggestionsForKBM(ctx context.Context, kbmCode string) ([]*domain.ICD10Suggestion, error)
	AddDiagnosisKBM(ctx context.Context, encounterNo, kbmCode, notes, doctorId, deptCode, gender, ageBracket string) error
	VerifyICD10Mapping(ctx context.Context, encounterNo string, icd10Codes []string, notes string) error
	ListPendingICD10Verifications(ctx context.Context, limit, offset int32) ([]*domain.PendingVerification, int32, error)
	CompleteEncounter(ctx context.Context, encounterNo string) error
}

// EventSubscriber interface to listen to outbox events
type EventSubscriber interface {
	StartListening(ctx context.Context, topic string) error
}
