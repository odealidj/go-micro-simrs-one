package outbox

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// MessageHandler is the function signature for handling a Redis Stream message
type MessageHandler func(ctx context.Context, msg redis.XMessage) error

// Consumer listens to a Redis Stream using a Consumer Group
type Consumer struct {
	redisClient *redis.Client
	streamName  string
	groupName   string
	consumerID  string
	handler     MessageHandler
}

// NewConsumer creates a new Redis Stream Consumer
func NewConsumer(redisClient *redis.Client, streamName, groupName, consumerID string, handler MessageHandler) *Consumer {
	return &Consumer{
		redisClient: redisClient,
		streamName:  streamName,
		groupName:   groupName,
		consumerID:  consumerID,
		handler:     handler,
	}
}

// Start initializes the consumer group and starts listening for messages
func (c *Consumer) Start(ctx context.Context) {
	// 1. Create Consumer Group (ignore error if it already exists)
	err := c.redisClient.XGroupCreateMkStream(ctx, c.streamName, c.groupName, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		log.Printf("[Redis Consumer] Warning creating group %s on stream %s: %v", c.groupName, c.streamName, err)
	}

	log.Printf("[Redis Consumer] Started listening to stream: %s, group: %s, consumer: %s", c.streamName, c.groupName, c.consumerID)

	// 2. Loop to read messages
	for {
		select {
		case <-ctx.Done():
			log.Printf("[Redis Consumer] Stopped listening to stream: %s", c.streamName)
			return
		default:
			// Read new messages for this consumer group (">")
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
					// Timeout block, continue
					continue
				}
				log.Printf("[Redis Consumer] Error reading from stream %s: %v", c.streamName, err)
				time.Sleep(1 * time.Second) // backoff
				continue
			}

			for _, stream := range streams {
				for _, msg := range stream.Messages {
					// Process the message
					err := c.handler(ctx, msg)
					if err != nil {
						log.Printf("[Redis Consumer] Error handling message %s: %v", msg.ID, err)
						// Decide whether to ACK or not on failure. For simplicity, we can not-ACK so it stays in PEL.
						// Or we can ACK and rely on Dead Letter Queue. Here we just log.
					} else {
						// ACK the message if successful
						c.redisClient.XAck(ctx, c.streamName, c.groupName, msg.ID)
						log.Printf("[Redis Consumer] Successfully processed and ACKed message %s", msg.ID)
					}
				}
			}
		}
	}
}
