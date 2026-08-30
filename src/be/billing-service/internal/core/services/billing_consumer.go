package services

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/aliube/go-micro-simrs-one/billing-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/redis/go-redis/v9"
)

type MedicalActionAddedPayload struct {
	EncounterNo string  `json:"encounter_no"`
	ActionCode  string  `json:"action_code"`
	ActionName  string  `json:"action_name"`
	Price       float64 `json:"price"`
}

type PrescriptionDispensedPayload struct {
	EncounterNo    string  `json:"encounter_no"`
	PrescriptionID string  `json:"prescription_id"`
	Price          float64 `json:"price"`
}

func StartBillingConsumers(ctx context.Context, rdb *redis.Client, billingService ports.BillingService) {
	// 1. Consumer for Rawat Jalan Stream (MedicalActionAdded from Polyclinics)
	actionHandler := func(ctx context.Context, msg redis.XMessage) error {
		eventType, ok := msg.Values["event_type"].(string)
		if !ok || (eventType != "MedicalActionAdded" && eventType != "MedicalActionRemoved") {
			return nil // ignore other events
		}

		payloadStr, ok := msg.Values["payload"].(string)
		if !ok {
			return nil
		}

		var payload MedicalActionAddedPayload
		if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
			return err
		}

		if eventType == "MedicalActionAdded" {
			return billingService.AddActionItem(ctx, payload.EncounterNo, payload.ActionCode, payload.ActionName, payload.Price)
		} else if eventType == "MedicalActionRemoved" {
			return billingService.RemoveActionItem(ctx, payload.EncounterNo, payload.ActionCode)
		}

		return nil
	}

	rawatJalanConsumer := outbox.NewConsumer(rdb, "rawat_jalan_stream", "billing_group", "billing_worker_rawat_jalan", actionHandler)
	go rawatJalanConsumer.Start(ctx)

	// Fallback consumer for legacy emr_stream
	emrConsumer := outbox.NewConsumer(rdb, "emr_stream", "billing_group", "billing_worker_emr", actionHandler)
	go emrConsumer.Start(ctx)

	// 2. Consumer for Pharmacy Stream
	pharmacyHandler := func(ctx context.Context, msg redis.XMessage) error {
		eventType, ok := msg.Values["event_type"].(string)
		if !ok || eventType != "PrescriptionDispensed" {
			return nil
		}

		payloadStr, ok := msg.Values["payload"].(string)
		if !ok {
			return nil
		}

		var payload PrescriptionDispensedPayload
		if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
			return err
		}

		return billingService.AddMedicineItem(ctx, payload.EncounterNo, payload.PrescriptionID, payload.Price)
	}

	pharmacyConsumer := outbox.NewConsumer(rdb, "pharmacy_stream", "billing_group", "billing_worker_1", pharmacyHandler)
	go pharmacyConsumer.Start(ctx)
	
	slog.Info("[Billing Consumers] Started listening to emr_stream and pharmacy_stream")
}
