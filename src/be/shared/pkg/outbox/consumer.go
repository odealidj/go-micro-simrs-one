package outbox

import (
	"context"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// MessageHandler is the function signature for handling a Redis Stream message.
type MessageHandler func(ctx context.Context, msg redis.XMessage) error

// Consumer listens to a Redis Stream using a Consumer Group with PEL retry support.
type Consumer struct {
	redisClient    *redis.Client
	streamName     string
	groupName      string
	consumerID     string
	handler        MessageHandler
	maxRetries     int64
	pelIdleTimeout time.Duration
}

// NewConsumer creates a new Redis Stream Consumer.
// pelIdleTimeout: duration after which a pending (unACKed) message is reclaimed for retry.
// maxRetries: after this many retries, the message is logged as dead-lettered and ACKed.
func NewConsumer(redisClient *redis.Client, streamName, groupName, consumerID string, handler MessageHandler) *Consumer {
	return &Consumer{
		redisClient:    redisClient,
		streamName:     streamName,
		groupName:      groupName,
		consumerID:     consumerID,
		handler:        handler,
		maxRetries:     5,
		pelIdleTimeout: 30 * time.Second,
	}
}

// Start initializes the consumer group and starts listening for messages.
// It also starts a background goroutine to retry messages stuck in the PEL.
func (c *Consumer) Start(ctx context.Context) {
	// 1. Create Consumer Group (ignore error if it already exists)
	err := c.redisClient.XGroupCreateMkStream(ctx, c.streamName, c.groupName, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		slog.Warn("[Consumer] Warning creating group", "group", c.groupName, "stream", c.streamName, "error", err)
	}

	slog.Info("[Consumer] Started listening", "stream", c.streamName, "group", c.groupName, "consumer", c.consumerID)

	// 2. Start PEL retry goroutine
	go c.recoverPendingMessages(ctx)

	// 3. Loop to read new messages
	for {
		select {
		case <-ctx.Done():
			slog.Info("[Consumer] Stopped listening", "stream", c.streamName)
			return
		default:
			args := &redis.XReadGroupArgs{
				Group:    c.groupName,
				Consumer: c.consumerID,
				Streams:  []string{c.streamName, ">"},
				Count:    10,
				Block:    2 * time.Second,
			}

			streams, err := c.redisClient.XReadGroup(ctx, args).Result()
			if err != nil {
				if err == redis.Nil {
					continue
				}
				slog.Error("[Consumer] Error reading from stream", "stream", c.streamName, "error", err)
				time.Sleep(1 * time.Second)
				continue
			}

			for _, stream := range streams {
				for _, msg := range stream.Messages {
					c.processMessage(ctx, msg)
				}
			}
		}
	}
}

// processMessage handles a single message: calls the handler and ACKs on success.
func (c *Consumer) processMessage(ctx context.Context, msg redis.XMessage) {
	if err := c.handler(ctx, msg); err != nil {
		slog.Error("[Consumer] Error handling message", "id", msg.ID, "error", err)
		// Do NOT ACK — message stays in PEL to be retried by recoverPendingMessages
	} else {
		c.redisClient.XAck(ctx, c.streamName, c.groupName, msg.ID)
		slog.Info("[Consumer] ACKed message", "id", msg.ID)
	}
}

// recoverPendingMessages periodically checks the Pending Entry List (PEL) for
// messages that have been idle for too long and reclaims them for retry.
func (c *Consumer) recoverPendingMessages(ctx context.Context) {
	ticker := time.NewTicker(c.pelIdleTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.claimStalePending(ctx)
		}
	}
}

// claimStalePending uses XAUTOCLAIM to reclaim messages idle longer than pelIdleTimeout.
func (c *Consumer) claimStalePending(ctx context.Context) {
	idleMs := c.pelIdleTimeout.Milliseconds()

	// XAUTOCLAIM reclaims idle messages from ANY consumer in the group back to this consumer
	result, _, err := c.redisClient.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream:   c.streamName,
		Group:    c.groupName,
		Consumer: c.consumerID,
		MinIdle:  time.Duration(idleMs) * time.Millisecond,
		Start:    "0-0",
		Count:    10,
	}).Result()

	if err != nil {
		slog.Warn("[Consumer] XAutoClaim error", "stream", c.streamName, "error", err)
		return
	}

	for _, msg := range result {
		// Check delivery count to detect poison-pill messages
		pendingInfo, err := c.redisClient.XPendingExt(ctx, &redis.XPendingExtArgs{
			Stream:   c.streamName,
			Group:    c.groupName,
			Start:    msg.ID,
			End:      "+",
			Count:    1,
			Consumer: c.consumerID,
		}).Result()

		if err == nil && len(pendingInfo) > 0 && pendingInfo[0].RetryCount >= c.maxRetries {
			// Dead-letter: log and ACK so it doesn't block the queue forever
			slog.Error("[Consumer] DEAD LETTER: message exceeded max retries, discarding",
				"id", msg.ID, "retries", pendingInfo[0].RetryCount, "stream", c.streamName)
			c.redisClient.XAck(ctx, c.streamName, c.groupName, msg.ID)
			continue
		}

		slog.Warn("[Consumer] Reclaiming stale pending message", "id", msg.ID)
		c.processMessage(ctx, msg)
	}
}
