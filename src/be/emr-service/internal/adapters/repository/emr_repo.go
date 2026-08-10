package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"

	"github.com/aliube/go-micro-simrs-one/emr-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/emr-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
	"github.com/google/uuid"
)

type emrRepoSqlc struct {
	q  *db.Queries
	db *sql.DB
}

func NewEMRRepository(d *sql.DB) ports.EMRRepository {
	return &emrRepoSqlc{
		q:  db.New(d),
		db: d,
	}
}

func (r *emrRepoSqlc) CreateDraft(ctx context.Context, encounterNo, mrn string) error {
	id := uuid.New().String()
	_, err := r.q.CreateDraftMR(ctx, db.CreateDraftMRParams{
		ID:          id,
		EncounterNo: encounterNo,
		Mrn:         mrn,
	})
	return err
}

func (r *emrRepoSqlc) AddDiagnosis(ctx context.Context, encounterNo, icd10Code, notes string) error {
	var n sql.NullString
	if notes != "" {
		n = sql.NullString{String: notes, Valid: true}
	}
	_, err := r.q.AddDiagnosis(ctx, db.AddDiagnosisParams{
		EncounterNo: encounterNo,
		ArrayAppend: icd10Code, 
		Notes:       n,
	})
	return err
}

func (r *emrRepoSqlc) UpdateTriage(ctx context.Context, encounterNo string, systolic, diastolic *int32, temp *float64, heartRate *int32, notes string) error {
	var n sql.NullString
	if notes != "" {
		n = sql.NullString{String: notes, Valid: true}
	}

	var sys, dia, hr sql.NullInt32
	var tm sql.NullString
	
	if systolic != nil { sys = sql.NullInt32{Int32: *systolic, Valid: true} }
	if diastolic != nil { dia = sql.NullInt32{Int32: *diastolic, Valid: true} }
	if heartRate != nil { hr = sql.NullInt32{Int32: *heartRate, Valid: true} }
	if temp != nil { tm = sql.NullString{String: fmt.Sprintf("%.2f", *temp), Valid: true} }

	_, err := r.q.UpdateTriage(ctx, db.UpdateTriageParams{
		EncounterNo:            encounterNo,
		BloodPressureSystolic:  sys,
		BloodPressureDiastolic: dia,
		Temperature:            tm,
		HeartRate:              hr,
		Notes:                  n,
	})
	return err
}

func (r *emrRepoSqlc) AddMedicalAction(ctx context.Context, encounterNo, recordID, actionCode, actionName string, price float64, notes string) error {
	id := uuid.New().String()
	var n sql.NullString
	if notes != "" {
		n = sql.NullString{String: notes, Valid: true}
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	qtx := r.q.WithTx(tx)

	_, err = qtx.AddMedicalAction(ctx, db.AddMedicalActionParams{
		ID:              id,
		MedicalRecordID: recordID,
		ActionCode:      actionCode,
		ActionName:      actionName,
		Price:           fmt.Sprintf("%.2f", price),
		Notes:           n,
	})
	if err != nil {
		return err
	}

	// Create Outbox Event
	payload := fmt.Sprintf(`{"encounter_no":"%s","action_code":"%s","action_name":"%s","price":%f}`, encounterNo, actionCode, actionName, price)
	
	_, err = qtx.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		ID:            uuid.New().String(),
		AggregateType: "MedicalRecord",
		EventType:     "MedicalActionAdded",
		Payload:       []byte(payload),
		Status:        "PENDING",
	})
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *emrRepoSqlc) GetMedicalRecord(ctx context.Context, encounterNo string) (*domain.MedicalRecord, error) {
	mr, err := r.q.GetMRByEncounterNo(ctx, encounterNo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("medical record not found")
		}
		return nil, err
	}

	var sys, dia, hr *int32
	if mr.BloodPressureSystolic.Valid { sys = &mr.BloodPressureSystolic.Int32 }
	if mr.BloodPressureDiastolic.Valid { dia = &mr.BloodPressureDiastolic.Int32 }
	if mr.HeartRate.Valid { hr = &mr.HeartRate.Int32 }
	
	var tm *float64
	if mr.Temperature.Valid {
		if val, err := strconv.ParseFloat(mr.Temperature.String, 64); err == nil {
			tm = &val
		}
	}

	record := &domain.MedicalRecord{
		ID:          mr.ID,
		EncounterNo: mr.EncounterNo,
		MRN:         mr.Mrn,
		ICD10Codes:  mr.Icd10Codes,
		Notes:       mr.Notes.String,
		Triage: domain.TriageData{
			BloodPressureSystolic:  sys,
			BloodPressureDiastolic: dia,
			Temperature:            tm,
			HeartRate:              hr,
		},
		CreatedAt: mr.CreatedAt.Time,
		UpdatedAt: mr.UpdatedAt.Time,
	}

	// Fetch medical actions
	dbActions, err := r.q.GetMedicalActionsByRecordID(ctx, mr.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	var actions []domain.MedicalAction
	for _, act := range dbActions {
		price, _ := strconv.ParseFloat(act.Price, 64)
		actions = append(actions, domain.MedicalAction{
			ID:              act.ID,
			MedicalRecordID: act.MedicalRecordID,
			ActionCode:      act.ActionCode,
			ActionName:      act.ActionName,
			Price:           price,
			Notes:           act.Notes.String,
			CreatedAt:       act.CreatedAt.Time,
		})
	}
	record.Actions = actions

	return record, nil
}

// Outbox implementation
func (r *emrRepoSqlc) GetPendingOutboxEvents(ctx context.Context) ([]outbox.Event, error) {
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

func (r *emrRepoSqlc) MarkEventAsPublished(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "PUBLISHED",
	})
}

func (r *emrRepoSqlc) MarkEventAsFailed(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "FAILED",
	})
}


