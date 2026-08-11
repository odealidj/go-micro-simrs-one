package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
)

type registrationRepoSqlc struct {
	q *db.Queries
}

func NewRegistrationRepository(d *sql.DB) ports.RegistrationRepository {
	return &registrationRepoSqlc{
		q: db.New(d),
	}
}

func (r *registrationRepoSqlc) SaveEncounter(ctx context.Context, encounter *domain.Encounter) error {
	_, err := r.q.CreateEncounter(ctx, db.CreateEncounterParams{
		EncounterNo: encounter.EncounterNo,
		Mrn:         encounter.MRN,
		Department:  encounter.Department,
		DoctorID:    encounter.DoctorID,
		Status:      encounter.Status,
	})
	return err
}

func (r *registrationRepoSqlc) SaveOutboxEvent(ctx context.Context, event *domain.OutboxEvent) error {
	_, err := r.q.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		ID:            event.ID,
		AggregateType: event.Aggregate,
		EventType:     event.Type,
		Payload:       json.RawMessage(event.Payload),
		Status:        event.Status,
	})
	return err
}

func (r *registrationRepoSqlc) CountActiveEncountersByDept(ctx context.Context, department string) (int64, error) {
	return r.q.CountActiveEncountersByDept(ctx, department)
}

// --- outbox.Repository implementation (used by outbox.NewRelay) ---

func (r *registrationRepoSqlc) GetPendingOutboxEvents(ctx context.Context) ([]outbox.Event, error) {
	dbEvents, err := r.q.GetPendingOutboxEvents(ctx)
	if err != nil {
		return nil, err
	}
	var events []outbox.Event
	for _, e := range dbEvents {
		events = append(events, outbox.Event{
			ID:            e.ID,
			AggregateType: e.AggregateType,
			EventType:     e.EventType,
			Payload:       e.Payload,
			Status:        e.Status,
			CreatedAt:     e.CreatedAt.Time,
		})
	}
	return events, nil
}

func (r *registrationRepoSqlc) MarkEventAsPublished(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "PUBLISHED",
	})
}

func (r *registrationRepoSqlc) MarkEventAsFailed(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "FAILED",
	})
}
