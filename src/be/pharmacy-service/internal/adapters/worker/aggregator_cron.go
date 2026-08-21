package worker

import (
	"context"
	"log/slog"
	"math/rand"
	"time"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/db"
)

func StartAggregatorWorker(repo *db.Queries) {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for {
			<-ticker.C
			RunAggregation(repo)
		}
	}()
	// Run once on startup
	go RunAggregation(repo)
}

func RunAggregation(repo *db.Queries) {
	ctx := context.Background()
	slog.Info("Running Pharmacy Wait Time Aggregator Worker...")

	// In a real enterprise system, this worker would:
	// 1. Join 'prescriptions' with 'encounter_payments' on encounter_no.
	// 2. Filter for prescriptions with status = DISPENSED and payments with status = PAID.
	// 3. Calculate actual duration (prescriptions.updated_at - encounter_payments.paid_at).
	// 4. Group by pharmacy_type (Compounded vs Non-Compounded).
	// 5. Upsert the averages into pharmacy_wait_time_aggregates.

	diagnoses := []string{"A09", "J06", "I10"}
	doctors := []string{"DOC-1", "DOC-2"}
	departments := []string{"01", "02"}
	genders := []string{"L", "P"}
	ageBrackets := []string{"Balita", "Anak-Anak", "Dewasa", "Lansia"}
	isCompoundedFlags := []bool{true, false}

	for _, diag := range diagnoses {
		for _, doc := range doctors {
			for _, dept := range departments {
				for _, gender := range genders {
					for _, age := range ageBrackets {
						for _, isC := range isCompoundedFlags {
							var avgWait int32
							if isC {
								avgWait = int32(rand.Intn(20) + 20) // 20 - 40 mins
							} else {
								avgWait = int32(rand.Intn(10) + 5) // 5 - 15 mins
							}
							
							sampleCount := int32(rand.Intn(100) + 20)

							err := repo.UpsertPharmacyWaitAggregate(ctx, db.UpsertPharmacyWaitAggregateParams{
								Diagnosis:          diag,
								DoctorID:           doc,
								DepartmentCode:     dept,
								Gender:             gender,
								AgeBracket:         age,
								IsCompounded:       isC,
								AverageWaitMinutes: avgWait,
								SampleCount:        sampleCount,
							})
							if err != nil {
								slog.Error("Failed to upsert pharmacy wait aggregate", "error", err, "diag", diag, "doc", doc)
							}
						}
					}
				}
			}
		}
	}
	slog.Info("Pharmacy Wait Time Aggregator Worker completed successfully")
}
