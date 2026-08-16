package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests processed, partitioned by status code, method and HTTP path.",
		},
		[]string{"code", "method", "path"},
	)
	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Histogram of response latency (seconds) of HTTP requests.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
}

// PrometheusMiddleware collects metrics for HTTP requests.
func PrometheusMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Use chimiddleware.WrapResponseWriter to get the status code
		ww := chimiddleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		duration := time.Since(start).Seconds()

		// Try to get the route pattern (e.g. /users/{id}) instead of actual path
		// to avoid high cardinality. If not available, fallback to actual path.
		path := r.URL.Path
		routeContext := chi.RouteContext(r.Context())
		if routeContext != nil && routeContext.RoutePattern() != "" {
			path = routeContext.RoutePattern()
		}

		status := strconv.Itoa(ww.Status())

		httpRequestsTotal.WithLabelValues(status, r.Method, path).Inc()
		httpRequestDuration.WithLabelValues(r.Method, path).Observe(duration)
	})
}
