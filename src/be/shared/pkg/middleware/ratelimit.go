// Package middleware provides HTTP middleware utilities for the SIMRS API Gateway.
package middleware

import (
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/aliube/go-micro-simrs-one/shared/pkg/response"
)

// ipLimiter holds a rate limiter per IP address.
type ipLimiter struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	mu         sync.Mutex
}

func newIPLimiter(rps float64, burst float64) *ipLimiter {
	return &ipLimiter{
		tokens:     burst,
		maxTokens:  burst,
		refillRate: rps,
		lastRefill: time.Now(),
	}
}

func (l *ipLimiter) allow() bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(l.lastRefill).Seconds()
	l.tokens += elapsed * l.refillRate
	if l.tokens > l.maxTokens {
		l.tokens = l.maxTokens
	}
	l.lastRefill = now

	if l.tokens >= 1 {
		l.tokens--
		return true
	}
	return false
}

// RateLimiter is an in-memory token bucket rate limiter middleware.
type RateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
	rps      float64
	burst    float64
	cleanup  time.Duration
	lastSeen map[string]time.Time
}

// NewRateLimiter creates a new rate limiter.
// rps: requests per second allowed per IP.
// burst: maximum burst size.
func NewRateLimiter(rps float64, burst float64) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*ipLimiter),
		lastSeen: make(map[string]time.Time),
		rps:      rps,
		burst:    burst,
		cleanup:  10 * time.Minute,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) getLimiter(ip string) *ipLimiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.lastSeen[ip] = time.Now()
	if lim, exists := rl.limiters[ip]; exists {
		return lim
	}
	lim := newIPLimiter(rl.rps, rl.burst)
	rl.limiters[ip] = lim
	return lim
}

// cleanupLoop removes stale IP entries to prevent memory leak.
func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		for ip, t := range rl.lastSeen {
			if time.Since(t) > rl.cleanup {
				delete(rl.limiters, ip)
				delete(rl.lastSeen, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Middleware returns an HTTP middleware that limits requests per IP.
func (rl *RateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			// Use X-Real-IP if behind a proxy
			if xip := r.Header.Get("X-Real-IP"); xip != "" {
				ip = xip
			} else if xfwd := r.Header.Get("X-Forwarded-For"); xfwd != "" {
				ip = xfwd
			}

			if !rl.getLimiter(ip).allow() {
				slog.Warn("[RateLimiter] Rate limit exceeded", "ip", ip, "path", r.URL.Path)
				response.JSON(w, http.StatusTooManyRequests, response.ErrorResponse{
					Success: false,
					Message: "Too many requests. Please slow down.",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
