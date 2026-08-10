package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/ports"
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
		Department:  encounter.DepartmentCode,
		DoctorID:    encounter.DoctorID,
		Status:      encounter.Status,
	})
	return err
}

func (r *registrationRepoSqlc) SaveOutboxEvent(ctx context.Context, event *domain.OutboxEvent) error {
	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		return err
	}
	_, err = r.q.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		ID:            event.ID,
		AggregateType: event.AggregateType,
		EventType:     event.EventType,
		Payload:       json.RawMessage(payloadBytes),
		Status:        event.Status,
	})
	return err
}
