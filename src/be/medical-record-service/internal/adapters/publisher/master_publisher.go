package publisher

import (
	"context"
	"encoding/json"

	"github.com/aliube/go-micro-simrs-one/medical-record-service/internal/adapters/db"
	"github.com/google/uuid"
)

// ClinicalMasterSyncPayload defines the event structure for master data updates
type ClinicalMasterSyncPayload struct {
	EntityType string          `json:"entity_type"` // "ICD10", "KBM", "Tindakan"
	Action     string          `json:"action"`      // "UPSERT", "DELETE"
	Data       json.RawMessage `json:"data"`
}

// PublishMasterEvent inserts an outbox event in the medical_record outbox_events table
// with AggregateType="ClinicalMaster". The Outbox Relay will automatically route it to
// "clinical_master_stream" in Redis, allowing rawat-jalan-service to replicate the update locally.
func PublishMasterEvent(ctx context.Context, q *db.Queries, entityType, action string, data interface{}) error {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	payloadBytes, err := json.Marshal(ClinicalMasterSyncPayload{
		EntityType: entityType,
		Action:     action,
		Data:       dataBytes,
	})
	if err != nil {
		return err
	}

	_, err = q.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		ID:            uuid.New().String(),
		AggregateType: "ClinicalMaster",
		EventType:     "ClinicalMasterUpdated",
		Payload:       payloadBytes,
		Status:        "PENDING",
	})
	return err
}
