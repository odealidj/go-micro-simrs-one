package broker

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/redis/go-redis/v9"
)

// RegistrationPayload matches the JSON published by Registration Service Outbox Relay
type RegistrationPayload struct {
	EncounterNo string `json:"encounter_no"`
	MRN         string `json:"mrn"`
}

// NewRegistrationEventConsumer creates an outbox.Consumer (Consumer Group) that
// listens on the "registration.events" Redis Stream. Using a Consumer Group
// guarantees that events are NOT lost when the EMR Service restarts — unACKed
// messages stay in the Pending Entry List (PEL) and are redelivered automatically.
func NewRegistrationEventConsumer(
	client *redis.Client,
	emrService ports.EMRService,
) *outbox.Consumer {
	handler := func(ctx context.Context, msg redis.XMessage) error {
		payloadStr, ok := msg.Values["payload"].(string)
		if !ok {
			slog.Warn("[EMR Consumer] payload field missing or not a string", "msg_id", msg.ID)
			// ACK to avoid infinite retry on bad message format
			return nil
		}

		var payload RegistrationPayload
		if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
			slog.Error("[EMR Consumer] Failed to unmarshal payload", "msg_id", msg.ID, "error", err)
			// ACK to avoid infinite retry on permanently-bad messages
			return nil
		}

		slog.Info("[EMR Consumer] Creating Draft MR",
			"encounter_no", payload.EncounterNo,
			"mrn", payload.MRN,
		)
		if err := emrService.CreateDraftMR(ctx, payload.EncounterNo, payload.MRN); err != nil {
			// Return error so the message stays in PEL and is retried
			slog.Error("[EMR Consumer] Failed to create Draft MR", "encounter_no", payload.EncounterNo, "error", err)
			return err
		}
		return nil
	}

	return outbox.NewConsumer(
		client,
		"registration.events", // stream name (must match Registration Relay)
		"emr-service",          // consumer group name
		"emr-instance-1",       // consumer ID (unique per replica)
		handler,
	)
}
