package queue

import (
	"context"
	"time"
)

// QueueEstimator is an interface for estimating wait times in a clinic queue.
type QueueEstimator interface {
	// EstimateWaitTime estimates the duration a patient will wait before being seen by a doctor.
	// This could consider the current queue length, average consultation time, etc.
	EstimateWaitTime(ctx context.Context, clinicID string, currentQueuePosition int) (time.Duration, error)
}
