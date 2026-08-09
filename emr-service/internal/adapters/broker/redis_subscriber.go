package broker

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type redisSubscriber struct {
	client     *redis.Client
	emrService ports.EMRService
}

func NewRedisSubscriber(client *redis.Client, emrService ports.EMRService) ports.EventSubscriber {
	return &redisSubscriber{
		client:     client,
		emrService: emrService,
	}
}

type RegistrationPayload struct {
	EncounterNo string `json:"encounter_no"`
	MRN         string `json:"mrn"`
}

func (r *redisSubscriber) StartListening(ctx context.Context, topic string) error {
	log.Printf("Starting Redis Subscriber on topic: %s", topic)

	// In production, we'd use XReadGroup for consumer groups.
	// For simplicity, we use XRead here reading from the end "$".
	lastID := "$"

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				streams, err := r.client.XRead(ctx, &redis.XReadArgs{
					Streams: []string{topic, lastID},
					Count:   10,
					Block:   0, // Block indefinitely
				}).Result()

				if err != nil {
					log.Printf("Error reading from redis stream: %v", err)
					time.Sleep(2 * time.Second)
					continue
				}

				for _, stream := range streams {
					for _, msg := range stream.Messages {
						lastID = msg.ID
						
						payloadStr, ok := msg.Values["payload"].(string)
						if !ok {
							log.Printf("Payload is not a string in msg ID %s", msg.ID)
							continue
						}

						var payload RegistrationPayload
						if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
							log.Printf("Error unmarshaling payload: %v", err)
							continue
						}

						// Process event
						err = r.emrService.CreateDraftMR(ctx, payload.EncounterNo, payload.MRN)
						if err != nil {
							log.Printf("Failed to process event for encounter %s: %v", payload.EncounterNo, err)
						}
					}
				}
			}
		}
	}()

	return nil
}
