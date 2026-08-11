package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
)

// IdempotencyMiddleware ensures that requests with the same X-Request-ID are not processed multiple times.
// Very useful to prevent double-charging or double-stock deductions.
func IdempotencyMiddleware(redisClient *redis.Client, expiration time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Idempotency usually only matters for state-changing operations
			if r.Method == http.MethodGet || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			traceID := r.Header.Get("X-Trace-ID")
			requestID := r.Header.Get("X-Request-ID")

			if requestID == "" {
				// Strict idempotency: Enforce clients to always send X-Request-ID for state-changing operations
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
					RequestID: requestID,
					TraceID:   traceID,
					Success:   false,
					Message:   "X-Request-ID header is required for this operation",
				})
				return
			}

			// Validate if requestID is a valid GUID (UUID)
			if err := uuid.Validate(requestID); err != nil {
				response.JSON(w, http.StatusBadRequest, response.ErrorResponse{
					RequestID: requestID,
					TraceID:   traceID,
					Success:   false,
					Message:   "X-Request-ID must be a valid GUID/UUID",
				})
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, RequestIDKey, requestID)
			r = r.WithContext(ctx)

			cacheKey := "idempotency:" + requestID
			
			// SETNX (Set if Not eXists) ensures atomicity across concurrent duplicate requests
			success, err := redisClient.SetNX(ctx, cacheKey, "PROCESSING", expiration).Result()
			if err != nil {
				response.JSON(w, http.StatusInternalServerError, response.ErrorResponse{
					RequestID: requestID,
					TraceID:   traceID,
					Success:   false,
					Message:   "Internal idempotency error",
				})
				return
			}

			if !success {
				// Request already processed or currently in progress
				response.JSON(w, http.StatusConflict, response.ErrorResponse{
					RequestID: requestID,
					TraceID:   traceID,
					Success:   false,
					Message:   "Duplicate request detected",
				})
				return
			}

			// In a robust implementation, we would cache the actual response body after completion.
			// For simplicity, we just lock the RequestID to block duplicate executions.
			next.ServeHTTP(w, r)
		})
	}
}
