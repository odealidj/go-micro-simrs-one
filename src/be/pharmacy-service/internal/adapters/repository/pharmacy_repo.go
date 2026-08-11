package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/pharmacy-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
)

type pharmacyRepoSqlc struct {
	q  *db.Queries
	db *sql.DB
}

func NewPharmacyRepository(d *sql.DB) ports.PharmacyRepository {
	return &pharmacyRepoSqlc{
		q:  db.New(d),
		db: d,
	}
}

func (r *pharmacyRepoSqlc) CreatePrescription(ctx context.Context, prescription *domain.Prescription) error {
	var n sql.NullString
	if prescription.Notes != "" {
		n = sql.NullString{String: prescription.Notes, Valid: true}
	}
	var isC sql.NullBool
	isC = sql.NullBool{Bool: prescription.IsCompounded, Valid: true}

	var diagnosis, gender, ageBracket, docId, deptCode sql.NullString
	if prescription.Diagnosis != "" {
		diagnosis = sql.NullString{String: prescription.Diagnosis, Valid: true}
	}
	if prescription.Gender != "" {
		gender = sql.NullString{String: prescription.Gender, Valid: true}
	}
	if prescription.AgeBracket != "" {
		ageBracket = sql.NullString{String: prescription.AgeBracket, Valid: true}
	}
	if prescription.DoctorID != "" {
		docId = sql.NullString{String: prescription.DoctorID, Valid: true}
	}
	if prescription.DepartmentCode != "" {
		deptCode = sql.NullString{String: prescription.DepartmentCode, Valid: true}
	}

	_, err := r.q.CreatePrescription(ctx, db.CreatePrescriptionParams{
		ID:             prescription.ID,
		EncounterNo:    prescription.EncounterNo,
		Status:         prescription.Status,
		IsCompounded:   isC,
		Notes:          n,
		Diagnosis:      diagnosis,
		Gender:         gender,
		AgeBracket:     ageBracket,
		DoctorID:       docId,
		DepartmentCode: deptCode,
	})
	if err != nil {
		return err
	}

	for _, item := range prescription.Items {
		_, err := r.q.CreatePrescriptionItem(ctx, db.CreatePrescriptionItemParams{
			ID:             item.ID,
			PrescriptionID: prescription.ID,
			ItemCode:       item.ItemCode,
			Quantity:       item.Quantity,
			Price:          fmt.Sprintf("%.2f", item.Price),
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *pharmacyRepoSqlc) GetPrescription(ctx context.Context, id string) (*domain.Prescription, error) {
	p, err := r.q.GetPrescription(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("prescription not found")
		}
		return nil, err
	}

	itemsDb, err := r.q.GetPrescriptionItems(ctx, id)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	var items []domain.PrescriptionItem
	for _, it := range itemsDb {
		price, _ := strconv.ParseFloat(it.Price, 64)
		items = append(items, domain.PrescriptionItem{
			ID:             it.ID,
			PrescriptionID: it.PrescriptionID,
			ItemCode:       it.ItemCode,
			Quantity:       it.Quantity,
			Price:          price,
		})
	}

	return &domain.Prescription{
		ID:           p.ID,
		EncounterNo:  p.EncounterNo,
		Status:       p.Status,
		IsCompounded: p.IsCompounded.Bool,
		Notes:        p.Notes.String,
		Items:        items,
		CreatedAt:    p.CreatedAt.Time,
		UpdatedAt:    p.UpdatedAt.Time,
	}, nil
}

func (r *pharmacyRepoSqlc) UpdatePrescriptionStatus(ctx context.Context, id, status string) error {
	_, err := r.q.UpdatePrescriptionStatus(ctx, db.UpdatePrescriptionStatusParams{
		ID:     id,
		Status: status,
	})
	return err
}

func (r *pharmacyRepoSqlc) GetInventoryItemPrice(ctx context.Context, itemCode string) (float64, error) {
	item, err := r.q.GetInventoryItem(ctx, itemCode)
	if err != nil {
		return 0, err
	}
	price, _ := strconv.ParseFloat(item.Price, 64)
	return price, nil
}

func (r *pharmacyRepoSqlc) DeductStock(ctx context.Context, itemCode string, quantity int32) error {
	return r.q.UpdateStock(ctx, db.UpdateStockParams{
		ItemCode:      itemCode,
		StockQuantity: quantity,
	})
}

func (r *pharmacyRepoSqlc) DispensePrescription(ctx context.Context, prescriptionID string) error {
	prescription, err := r.GetPrescription(ctx, prescriptionID)
	if err != nil {
		return err
	}
	if prescription.Status == "DISPENSED" {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	qtx := r.q.WithTx(tx)

	// 1. Check and Deduct Stock
	for _, item := range prescription.Items {
		// Pessimistic Locking: Lock the row so concurrent dispenses wait
		invItem, err := qtx.GetInventoryItemForUpdate(ctx, item.ItemCode)
		if err != nil {
			return fmt.Errorf("failed to get inventory item %s: %w", item.ItemCode, err)
		}

		if invItem.StockQuantity < item.Quantity {
			return fmt.Errorf("insufficient stock for item %s. Requested: %d, Available: %d", item.ItemCode, item.Quantity, invItem.StockQuantity)
		}

		err = qtx.UpdateStock(ctx, db.UpdateStockParams{
			ItemCode:      item.ItemCode,
			StockQuantity: item.Quantity,
		})
		if err != nil {
			return err
		}
	}

	// 2. Update Status
	_, err = qtx.UpdatePrescriptionStatus(ctx, db.UpdatePrescriptionStatusParams{
		ID:     prescriptionID,
		Status: "DISPENSED",
	})
	if err != nil {
		return err
	}

	// 3. Total price computation for the event payload
	var totalPrice float64 = 0
	for _, item := range prescription.Items {
		totalPrice += item.Price * float64(item.Quantity)
	}

	// 4. Create Outbox Event
	payload := fmt.Sprintf(`{"encounter_no":"%s","prescription_id":"%s","price":%f}`, prescription.EncounterNo, prescriptionID, totalPrice)
	_, err = qtx.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		ID:            fmt.Sprintf("evt-rx-%d", time.Now().UnixNano()), // Will import time and github.com/google/uuid later or just use time.Now()
		AggregateType: "Prescription",
		EventType:     "PrescriptionDispensed",
		Payload:       []byte(payload),
		Status:        "PENDING",
	})
	if err != nil {
		return err
	}

	return tx.Commit()
}

// Outbox implementation
func (r *pharmacyRepoSqlc) GetPendingOutboxEvents(ctx context.Context) ([]outbox.Event, error) {
	dbEvents, err := r.q.GetPendingOutboxEvents(ctx)
	if err != nil {
		return nil, err
	}

	var events []outbox.Event
	for _, e := range dbEvents {
		events = append(events, outbox.Event{
			ID:            e.ID,
			AggregateType: e.AggregateType,
			EventType:     e.EventType,
			Payload:       e.Payload,
			Status:        e.Status,
			CreatedAt:     e.CreatedAt.Time,
		})
	}
	return events, nil
}

func (r *pharmacyRepoSqlc) MarkEventAsPublished(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "PUBLISHED",
	})
}

func (r *pharmacyRepoSqlc) MarkEventAsFailed(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "FAILED",
	})
}

func (r *pharmacyRepoSqlc) UpsertEncounterPayment(ctx context.Context, encounterNo, status string, paidAt *time.Time) error {
	var paidAtSql sql.NullTime
	if paidAt != nil {
		paidAtSql = sql.NullTime{Time: *paidAt, Valid: true}
	}
	
	return r.q.UpsertEncounterPayment(ctx, db.UpsertEncounterPaymentParams{
		EncounterNo: encounterNo,
		Status:      status,
		PaidAt:      paidAtSql,
	})
}

func (r *pharmacyRepoSqlc) GetEncounterPaymentStatus(ctx context.Context, encounterNo string) (string, error) {
	status, err := r.q.GetEncounterPayment(ctx, encounterNo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "UNPAID", nil // Assume unpaid if not found yet
		}
		return "", err
	}
	return status, nil
}

func (r *pharmacyRepoSqlc) EstimateWaitTime(ctx context.Context, doctorID, deptCode, gender, ageBracket string, isCompounded bool) (int64, error) {
	avg, err := r.q.GetPharmacyWaitAggregateWithoutDiagnosis(ctx, db.GetPharmacyWaitAggregateWithoutDiagnosisParams{
		DoctorID:       doctorID,
		DepartmentCode: deptCode,
		Gender:         gender,
		AgeBracket:     ageBracket,
		IsCompounded:   isCompounded,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 10, nil // Default
		}
		return 10, err
	}
	if avg == 0 {
		return 10, nil
	}
	return int64(avg), nil
}

