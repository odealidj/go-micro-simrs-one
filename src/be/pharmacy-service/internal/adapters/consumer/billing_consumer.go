package consumer

import (
	"context"
	"encoding/json"
	"log"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/redis/go-redis/v9"
)

type BillingConsumer struct {
	repo ports.PharmacyRepository
}

func NewBillingConsumer(repo ports.PharmacyRepository) *BillingConsumer {
	return &BillingConsumer{repo: repo}
}

func (c *BillingConsumer) HandleBillingEvent(ctx context.Context, msg redis.XMessage) error {
	payloadStr, ok := msg.Values["payload"].(string)
	if !ok {
		log.Printf("[BillingConsumer] Invalid payload format: %v", msg.Values)
		return nil // Return nil so it ACKs and doesn't block
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
		log.Printf("[BillingConsumer] Failed to unmarshal payload: %v", err)
		return nil
	}

	eventType, ok := msg.Values["event_type"].(string)
	if !ok {
		// Sometimes event_type might be in the payload, but typically in outbox relay we put it in stream keys
		// Let's assume outbox relay puts event_type in stream keys
		log.Printf("[BillingConsumer] Warning: event_type not found in stream keys. payload: %v", payloadStr)
		// return nil
	}

	if eventType == "InvoicePaid" {
		encounterNo, _ := payload["encounter_no"].(string)
		if encounterNo != "" {
			err := c.repo.UpsertEncounterPayment(ctx, encounterNo, "PAID")
			if err != nil {
				log.Printf("[BillingConsumer] Failed to upsert payment for encounter %s: %v", encounterNo, err)
				return err // Return err so it retries later
			}
			log.Printf("[BillingConsumer] Successfully updated encounter %s to PAID", encounterNo)
		}
	}

	return nil
}

func StartBillingConsumer(ctx context.Context, rdb *redis.Client, repo ports.PharmacyRepository) {
	c := NewBillingConsumer(repo)
	consumer := outbox.NewConsumer(
		rdb,
		"billing_stream", // Stream name published by billing service outbox
		"pharmacy_group",
		"pharmacy_consumer_1",
		c.HandleBillingEvent,
	)
	go consumer.Start(ctx)
}
