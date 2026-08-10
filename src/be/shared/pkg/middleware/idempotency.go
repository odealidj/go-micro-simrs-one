package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
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

			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				// If no request_id is provided, proceed normally 
				// (Or return Error if we want to enforce strict idempotency)
				next.ServeHTTP(w, r)
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, RequestIDKey, requestID)
			r = r.WithContext(ctx)

			cacheKey := "idempotency:" + requestID
			
			// SETNX (Set if Not eXists) ensures atomicity across concurrent duplicate requests
			success, err := redisClient.SetNX(ctx, cacheKey, "PROCESSING", expiration).Result()
			if err != nil {
				http.Error(w, `{"success":false,"message":"Internal idempotency error"}`, http.StatusInternalServerError)
				return
			}

			if !success {
				// Request already processed or currently in progress
				http.Error(w, `{"success":false,"message":"Duplicate request detected"}`, http.StatusConflict)
				return
			}

			// In a robust implementation, we would cache the actual response body after completion.
			// For simplicity, we just lock the RequestID to block duplicate executions.
			next.ServeHTTP(w, r)
		})
	}
}
