package ports

import (
	"context"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/domain"
)

type RegistrationRepository interface {
	SaveEncounter(ctx context.Context, encounter *domain.Encounter) error
	SaveOutboxEvent(ctx context.Context, event *domain.OutboxEvent) error
}

type EventPublisher interface {
	PublishEvent(ctx context.Context, topic string, payload []byte) error
}

type RegistrationService interface {
	RegisterEncounter(ctx context.Context, mrn, departmentCode, doctorID string) (string, int32, error)
}
