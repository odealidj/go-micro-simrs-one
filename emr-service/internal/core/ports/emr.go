package ports

import (
	"context"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/domain"
)

type EMRRepository interface {
	CreateDraft(ctx context.Context, encounterNo, mrn string) error
	AddDiagnosis(ctx context.Context, encounterNo, icd10Code, notes string) error
	GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error)
}

type EMRService interface {
	CreateDraftMR(ctx context.Context, encounterNo, mrn string) error
	AddDiagnosis(ctx context.Context, encounterNo, icd10Code, notes string) error
	GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error)
}

// EventSubscriber interface to listen to outbox events
type EventSubscriber interface {
	StartListening(ctx context.Context, topic string) error
}
