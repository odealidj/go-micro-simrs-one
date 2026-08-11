package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// SSEQueueEvent is the structured payload emitted to SSE clients.
// It enriches the raw Redis pub/sub message with an estimated wait time.
type SSEQueueEvent struct {
	EncounterNo          string `json:"encounter_no"`
	Status               string `json:"status"`
	Type                 string `json:"type"`
	EstimatedWaitMinutes int64  `json:"estimated_wait_minutes"`
}

// rawQueueEvent matches the JSON published by EMR/Pharmacy services to Redis pub/sub
type rawQueueEvent struct {
	EncounterNo string `json:"encounter_no"`
	Status      string `json:"status"`
	Type        string `json:"type"`
}

type SSEHandler struct {
	redisClient *redis.Client
}

func NewSSEHandler(rdb *redis.Client) *SSEHandler {
	return &SSEHandler{redisClient: rdb}
}

// countActive counts the number of patients currently in an active state
// for a given queue type by scanning a Redis sorted set / counter key.
// Fallback is 0 so we never block the SSE stream on Redis errors.
func (h *SSEHandler) countActiveClinic(ctx context.Context) int64 {
	// Key pattern used by EMR service when status = IN_PROGRESS
	n, err := h.redisClient.Get(ctx, "queue:clinic:active_count").Int64()
	if err != nil {
		return 0
	}
	return n
}

func (h *SSEHandler) countActivePharmacy(ctx context.Context) int64 {
	n, err := h.redisClient.Get(ctx, "queue:pharmacy:active_count").Int64()
	if err != nil {
		return 0
	}
	return n
}

// estimateWaitMinutes calculates a simple estimate:
//
//	estimated_wait = position * averageServiceTimeMinutes
//
// averageServiceTime is fetched from Redis (set by aggregator workers).
// Falls back to a sensible default if not available.
func estimateWaitMinutes(position int64, avgKey string, rdb *redis.Client, ctx context.Context, defaultAvgMinutes int64) int64 {
	if position <= 0 {
		return 0
	}
	avg, err := rdb.Get(ctx, avgKey).Int64()
	if err != nil || avg <= 0 {
		avg = defaultAvgMinutes
	}
	return position * avg
}

func (h *SSEHandler) StreamClinicQueue(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	pubsub := h.redisClient.Subscribe(r.Context(), "queue:clinic:stream")
	defer pubsub.Close()
	ch := pubsub.Channel()

	fmt.Fprintf(w, "event: connected\ndata: {\"message\": \"Connected to Clinic Queue Stream\"}\n\n")
	flusher.Flush()

	for {
		select {
		case msg := <-ch:
			var raw rawQueueEvent
			if err := json.Unmarshal([]byte(msg.Payload), &raw); err != nil {
				// Emit raw payload as-is if it cannot be parsed
				fmt.Fprintf(w, "event: update\ndata: %s\n\n", msg.Payload)
				flusher.Flush()
				continue
			}

			activeCount := h.countActiveClinic(r.Context())
			// avg service time key is set by EMR aggregator worker (global average)
			waitMin := estimateWaitMinutes(activeCount, "queue:clinic:avg_service_minutes", h.redisClient, r.Context(), 15)

			enriched := SSEQueueEvent{
				EncounterNo:          raw.EncounterNo,
				Status:               raw.Status,
				Type:                 raw.Type,
				EstimatedWaitMinutes: waitMin,
			}
			data, _ := json.Marshal(enriched)
			fmt.Fprintf(w, "event: update\ndata: %s\n\n", data)
			flusher.Flush()
			slog.Info("[SSE Clinic] Event sent", "encounter_no", raw.EncounterNo, "status", raw.Status, "est_wait_min", waitMin)

		case <-r.Context().Done():
			slog.Info("Client disconnected from Clinic Queue Stream")
			return
		}
	}
}

func (h *SSEHandler) StreamPharmacyQueue(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	pubsub := h.redisClient.Subscribe(r.Context(), "queue:pharmacy:stream")
	defer pubsub.Close()
	ch := pubsub.Channel()

	fmt.Fprintf(w, "event: connected\ndata: {\"message\": \"Connected to Pharmacy Queue Stream\"}\n\n")
	flusher.Flush()

	for {
		select {
		case msg := <-ch:
			var raw rawQueueEvent
			if err := json.Unmarshal([]byte(msg.Payload), &raw); err != nil {
				fmt.Fprintf(w, "event: update\ndata: %s\n\n", msg.Payload)
				flusher.Flush()
				continue
			}

			activeCount := h.countActivePharmacy(r.Context())
			// avg service time key is set by Pharmacy aggregator worker (global average)
			waitMin := estimateWaitMinutes(activeCount, "queue:pharmacy:avg_service_minutes", h.redisClient, r.Context(), 10)

			enriched := SSEQueueEvent{
				EncounterNo:          raw.EncounterNo,
				Status:               raw.Status,
				Type:                 raw.Type,
				EstimatedWaitMinutes: waitMin,
			}
			data, _ := json.Marshal(enriched)
			fmt.Fprintf(w, "event: update\ndata: %s\n\n", data)
			flusher.Flush()
			slog.Info("[SSE Pharmacy] Event sent", "encounter_no", raw.EncounterNo, "status", raw.Status, "est_wait_min", waitMin)

		case <-r.Context().Done():
			slog.Info("Client disconnected from Pharmacy Queue Stream")
			return
		}
	}
}

// HeartbeatSSE sends periodic ping events to prevent browser/proxy timeouts.
// Call as a goroutine alongside the event loop if needed.
func HeartbeatSSE(ctx context.Context, w http.ResponseWriter, flusher http.Flusher, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}
