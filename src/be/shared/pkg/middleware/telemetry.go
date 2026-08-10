package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

type contextKey string

const (
	TraceIDKey   contextKey = "trace_id"
	RequestIDKey contextKey = "request_id"
)

// TraceIDMiddleware extracts or generates a trace_id for every incoming HTTP request.
// It injects it into the context so it can be propagated to logs and downstream gRPC calls.
func TraceIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			// Generate a new trace ID if the client didn't provide one
			traceID = uuid.NewString()
		}

		// Inject traceID into the request context
		ctx := context.WithValue(r.Context(), TraceIDKey, traceID)
		
		// Set it back to the response header so the client knows it
		w.Header().Set("X-Trace-ID", traceID)
		
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
