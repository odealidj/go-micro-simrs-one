package queue

import (
	"context"
	"time"
)

// StatisticalQueueEstimator provides a simple average-based estimation.
type StatisticalQueueEstimator struct {
	// Average duration per patient consultation.
	averageConsultationTime time.Duration
}

func NewStatisticalQueueEstimator(avgTime time.Duration) *StatisticalQueueEstimator {
	return &StatisticalQueueEstimator{
		averageConsultationTime: avgTime,
	}
}

// EstimateWaitTime estimates the wait time based on average consultation time and position in queue.
func (e *StatisticalQueueEstimator) EstimateWaitTime(ctx context.Context, clinicID string, currentQueuePosition int) (time.Duration, error) {
	// simple estimation: currentQueuePosition * averageConsultationTime
	if currentQueuePosition <= 0 {
		return 0, nil
	}
	
	// E.g., if you are 3rd in queue (position=3), and average time is 15 mins, wait time is 45 mins.
	// We might subtract the time the current patient has already spent in consultation,
	// but a simple statistical estimator just uses the average.
	estimatedWait := time.Duration(currentQueuePosition) * e.averageConsultationTime
	return estimatedWait, nil
}
