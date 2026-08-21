package services

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/ports"
	"github.com/redis/go-redis/v9"
)

type RegistrationConsumer struct {
	registrationService ports.RegistrationService
}

func NewRegistrationConsumer(rs ports.RegistrationService) *RegistrationConsumer {
	return &RegistrationConsumer{
		registrationService: rs,
	}
}

func (c *RegistrationConsumer) HandleInvoiceEvent(ctx context.Context, msg redis.XMessage) error {
	eventType, ok := msg.Values["type"].(string)
	if !ok {
		slog.Warn("Received message without 'type' field", "msg_id", msg.ID)
		return nil // Not our problem, skip
	}

	payloadStr, ok := msg.Values["payload"].(string)
	if !ok {
		slog.Warn("Received message without 'payload' field", "msg_id", msg.ID)
		return nil
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
		slog.Error("Failed to unmarshal payload", "error", err, "payload", payloadStr)
		return err
	}

	encounterNo, ok := payload["encounter_no"].(string)
	if !ok {
		slog.Warn("Missing encounter_no in payload", "payload", payloadStr)
		return nil
	}

	switch eventType {
	case "InvoicePaid":
		slog.Info("Handling InvoicePaid event", "encounter_no", encounterNo)
		return c.registrationService.UpdatePaymentStatus(ctx, encounterNo, "PAID")
	
	case "InvoiceCancelled":
		slog.Info("Handling InvoiceCancelled event", "encounter_no", encounterNo)
		// Usually handled internally or we cancel the registration as well. The rule:
		// Pasien UMUM belum bayar jangan di hitung -> This means we can mark PaymentStatus as CANCELLED or just leave it.
		// For now we can update payment status to CANCELLED.
		return c.registrationService.UpdatePaymentStatus(ctx, encounterNo, "CANCELLED")

	default:
		slog.Debug("Unhandled event type", "type", eventType)
	}

	return nil
}
