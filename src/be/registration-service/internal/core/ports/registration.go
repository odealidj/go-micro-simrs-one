package ports

import (
	"context"
	"time"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
)

type RegistrationRepository interface {
	SaveEncounter(ctx context.Context, encounter *domain.Encounter) error
	SaveOutboxEvent(ctx context.Context, event *domain.OutboxEvent) error
	CountActiveEncountersByDept(ctx context.Context, department string) (int64, error)
	// Implements outbox.Repository so this repo can be passed directly to outbox.NewRelay
	GetPendingOutboxEvents(ctx context.Context) ([]outbox.Event, error)
	MarkEventAsPublished(ctx context.Context, id string) error
	MarkEventAsFailed(ctx context.Context, id string) error
	GetTodayEncounters(ctx context.Context, startDate, endDate time.Time) ([]*domain.Encounter, error)
	UpdateEncounterStatus(ctx context.Context, encounterNo, status string) error
	GetMaxSequenceForMonth(ctx context.Context, prefix string) (int32, error)
	GetDashboardMetrics(ctx context.Context, targetDate time.Time) (newPatients int32, oldPatients int32, waitTimes map[string]int32, weeklyVisits map[string]int32, err error)
	UpdatePaymentStatus(ctx context.Context, encounterNo, status string) error
	UpdateGuarantor(ctx context.Context, encounterNo, guarantor string) error
	GetActivePerawatByPoli(ctx context.Context, poliCode string) (string, error)
	GetActiveDoctorByPoli(ctx context.Context, poliCode string) (string, error)
}

type EventPublisher interface {
	PublishEvent(ctx context.Context, topic string, payload []byte) error
}

type RegistrationService interface {
	RegisterEncounter(ctx context.Context, mrn, departmentCode, doctorID, perawatID, guarantor string) (string, error)
	GetTodayEncounters(ctx context.Context, startDate, endDate time.Time) ([]*domain.Encounter, error)
	CancelEncounter(ctx context.Context, encounterNo, reason string) error
	UpdateEncounterStatus(ctx context.Context, encounterNo, status string) error
	UpdateEncounterGuarantor(ctx context.Context, encounterNo, guarantor string) error
	GetDashboardMetrics(ctx context.Context, targetDate time.Time) (newPatients int32, oldPatients int32, waitTimes map[string]int32, weeklyVisits map[string]int32, err error)
	UpdatePaymentStatus(ctx context.Context, encounterNo, status string) error
}
