package broker

import (
	"context"

	"github.com/redis/go-redis/v9"
)

type RedisPublisher struct {
	client *redis.Client
}

func NewRedisPublisher(client *redis.Client) *RedisPublisher {
	return &RedisPublisher{client: client}
}

// PublishEvent sends a message to Redis Stream
func (r *RedisPublisher) PublishEvent(ctx context.Context, topic string, payload []byte) error {
	// XAdd adds the specified stream entries to the stream at the specified key.
	err := r.client.XAdd(ctx, &redis.XAddArgs{
		Stream: topic,
		Values: map[string]interface{}{
			"payload": string(payload),
		},
	}).Err()
	return err
}
