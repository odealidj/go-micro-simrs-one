// Package circuitbreaker provides gRPC-aware circuit breaker helpers
// using the Sony gobreaker library.
//
// Usage:
//
//	cb := circuitbreaker.NewGRPCBreaker("auth-service")
//	res, err := cb.Execute(func() (interface{}, error) {
//	    return authClient.Login(ctx, req)
//	})
package circuitbreaker

import (
	"log/slog"
	"time"

	"github.com/sony/gobreaker"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// NewGRPCBreaker returns a CircuitBreaker pre-configured for gRPC service calls.
//   - Opens after 5 consecutive failures
//   - Stays open for 30 seconds before trying again (half-open)
//   - Closes again after 2 successful calls in half-open state
func NewGRPCBreaker(serviceName string) *gobreaker.CircuitBreaker {
	settings := gobreaker.Settings{
		Name:        serviceName,
		MaxRequests: 2, // allow 2 requests in half-open state
		Interval:    60 * time.Second,
		Timeout:     30 * time.Second, // stay open for 30s before retrying
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			// Open after 5 consecutive failures OR > 60% failure rate with at least 10 requests
			if counts.ConsecutiveFailures >= 5 {
				return true
			}
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 10 && failureRatio >= 0.6
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			slog.Warn("[CircuitBreaker] State changed",
				"service", name,
				"from", from.String(),
				"to", to.String(),
			)
		},
		IsSuccessful: func(err error) bool {
			if err == nil {
				return true
			}
			st, ok := status.FromError(err)
			if ok {
				switch st.Code() {
				case codes.NotFound,
					codes.InvalidArgument,
					codes.AlreadyExists,
					codes.PermissionDenied,
					codes.Unauthenticated,
					codes.FailedPrecondition,
					codes.OutOfRange,
					codes.Canceled:
					// Business or client validation errors, NOT downstream service outages.
					return true
				default:
					return false
				}
			}
			return false
		},
	}
	return gobreaker.NewCircuitBreaker(settings)
}

// CallGRPC wraps a gRPC call with the circuit breaker.
// Returns a gRPC Unavailable status error when the circuit is open,
// so callers get a proper HTTP 503 via existing error handling.
func CallGRPC[T any](cb *gobreaker.CircuitBreaker, fn func() (T, error)) (T, error) {
	result, err := cb.Execute(func() (interface{}, error) {
		return fn()
	})

	if err != nil {
		var zero T
		// Convert gobreaker ErrOpenState to a gRPC-compatible error
		if err == gobreaker.ErrOpenState || err == gobreaker.ErrTooManyRequests {
			return zero, status.Errorf(codes.Unavailable,
				"service %s is temporarily unavailable (circuit open): %v", cb.Name(), err)
		}
		return zero, err
	}

	return result.(T), nil
}
