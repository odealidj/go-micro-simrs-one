package outbox

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// Relay polls the local outbox table and publishes events to Redis Streams
type Relay struct {
	repo        Repository
	redisClient *redis.Client
	streamName  string
	interval    time.Duration
}

// NewRelay creates a new Outbox Relay
func NewRelay(repo Repository, redisClient *redis.Client, streamName string, interval time.Duration) *Relay {
	return &Relay{
		repo:        repo,
		redisClient: redisClient,
		streamName:  streamName,
		interval:    interval,
	}
}

// Start runs the relay in a blocking manner. Usually called in a goroutine.
func (r *Relay) Start(ctx context.Context) {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	log.Printf("[Outbox Relay] Started for stream: %s, interval: %s", r.streamName, r.interval)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Outbox Relay] Stopped for stream: %s", r.streamName)
			return
		case <-ticker.C:
			r.processEvents(ctx)
		}
	}
}

func (r *Relay) processEvents(ctx context.Context) {
	// 1. Get pending events
	events, err := r.repo.GetPendingOutboxEvents(ctx)
	if err != nil {
		log.Printf("[Outbox Relay] Error fetching pending events: %v", err)
		return
	}

	if len(events) == 0 {
		return
	}

	// 2. Publish and update status
	for _, event := range events {
		// Prepare Redis XADD args
		args := &redis.XAddArgs{
			Stream: r.streamName,
			Values: map[string]interface{}{
				"id":             event.ID,
				"aggregate_type": event.AggregateType,
				"event_type":     event.EventType,
				"payload":        event.Payload,
				"created_at":     event.CreatedAt.Format(time.RFC3339),
			},
		}

		// Push to Redis Stream
		_, err := r.redisClient.XAdd(ctx, args).Result()
		if err != nil {
			log.Printf("[Outbox Relay] Failed to publish event %s: %v", event.ID, err)
			_ = r.repo.MarkEventAsFailed(ctx, event.ID)
			continue
		}

		// Mark as published in DB
		err = r.repo.MarkEventAsPublished(ctx, event.ID)
		if err != nil {
			log.Printf("[Outbox Relay] Published event %s but failed to update status in DB: %v", event.ID, err)
		} else {
			log.Printf("[Outbox Relay] Successfully published event %s (Type: %s) to %s", event.ID, event.EventType, r.streamName)
		}
	}
}
