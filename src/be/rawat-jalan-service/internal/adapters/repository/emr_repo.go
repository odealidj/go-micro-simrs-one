package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"

	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/rawat-jalan-service/internal/core/ports"
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

func (r *emrRepoSqlc) StartEncounter(ctx context.Context, encounterNo string) error {
	return r.q.StartEncounter(ctx, encounterNo)
}

func (r *emrRepoSqlc) CompleteEncounter(ctx context.Context, encounterNo string) error {
	return r.q.CompleteEncounter(ctx, encounterNo)
}



func (r *emrRepoSqlc) SearchKBM(ctx context.Context, deptCode, query string, limit, offset int32) ([]*domain.KBMItem, int32, error) {
	var dbItems []db.KbmCatalog
	var err error

	if deptCode != "" {
		// Use polyclinic specific search
		mappedItems, errQ := r.q.SearchKBMByPolyclinic(ctx, db.SearchKBMByPolyclinicParams{
			PolyclinicCode: deptCode,
			Column2:        sql.NullString{String: query, Valid: true},
			Limit:          limit,
			Offset:         offset,
		})
		err = errQ
		for _, i := range mappedItems {
			// Cast db.SearchKBMByPolyclinicRow to db.KbmCatalog if needed, but sqlc generates a struct.
			// Let's copy it field by field or cast it based on what sqlc generated.
			dbItems = append(dbItems, db.KbmCatalog{
				KbmCode:     i.KbmCode,
				KbmName:     i.KbmName,
				Description: i.Description,
				BodySystem:  i.BodySystem,
			})
		}
	} else {
		// Global search
		dbItems, err = r.q.SearchKBM(ctx, db.SearchKBMParams{
			Column1: sql.NullString{String: query, Valid: true},
			Limit:   limit,
			Offset:  offset,
		})
	}

	if err != nil {
		return nil, 0, err
	}

	var items []*domain.KBMItem
	for _, i := range dbItems {
		items = append(items, &domain.KBMItem{
			KBMCode:     i.KbmCode,
			KBMName:     i.KbmName,
			Description: i.Description.String,
			BodySystem:  i.BodySystem.String,
		})
	}
	return items, int32(len(dbItems)), nil
}

func (r *emrRepoSqlc) GetKBMDetail(ctx context.Context, kbmCode string) (*domain.KBMItem, error) {
	i, err := r.q.GetKBMByCode(ctx, kbmCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("kbm not found")
		}
		return nil, err
	}
	return &domain.KBMItem{
		KBMCode:     i.KbmCode,
		KBMName:     i.KbmName,
		Description: i.Description.String,
		BodySystem:  i.BodySystem.String,
	}, nil
}



func (r *emrRepoSqlc) UpsertTriage(ctx context.Context, encounterNo, mrn string, triage domain.TriageData) error {
	var n sql.NullString
	if triage.Notes != "" {
		n = sql.NullString{String: triage.Notes, Valid: true}
	}

	var sys, dia, hr, resp, spo2 sql.NullInt32
	var tm, h, w, bmi, alg sql.NullString

	if triage.BloodPressureSystolic != nil { sys = sql.NullInt32{Int32: *triage.BloodPressureSystolic, Valid: true} }
	if triage.BloodPressureDiastolic != nil { dia = sql.NullInt32{Int32: *triage.BloodPressureDiastolic, Valid: true} }
	if triage.HeartRate != nil { hr = sql.NullInt32{Int32: *triage.HeartRate, Valid: true} }
	if triage.RespiratoryRate != nil { resp = sql.NullInt32{Int32: *triage.RespiratoryRate, Valid: true} }
	if triage.OxygenSaturation != nil { spo2 = sql.NullInt32{Int32: *triage.OxygenSaturation, Valid: true} }

	if triage.Temperature != nil { tm = sql.NullString{String: fmt.Sprintf("%.2f", *triage.Temperature), Valid: true} }
	if triage.Height != nil { h = sql.NullString{String: fmt.Sprintf("%.2f", *triage.Height), Valid: true} }
	if triage.Weight != nil { w = sql.NullString{String: fmt.Sprintf("%.2f", *triage.Weight), Valid: true} }
	if triage.BMI != nil { bmi = sql.NullString{String: fmt.Sprintf("%.1f", *triage.BMI), Valid: true} }
	if triage.Allergies != "" { alg = sql.NullString{String: triage.Allergies, Valid: true} }

	id := uuid.New().String()
	_, err := r.q.UpsertTriage(ctx, db.UpsertTriageParams{
		ID:                     id,
		EncounterNo:            encounterNo,
		Mrn:                    mrn,
		BloodPressureSystolic:  sys,
		BloodPressureDiastolic: dia,
		Temperature:            tm,
		HeartRate:              hr,
		RespiratoryRate:        resp,
		OxygenSaturation:       spo2,
		Height:                 h,
		Weight:                 w,
		Bmi:                    bmi,
		Allergies:              alg,
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

	var sys, dia, hr, resp, spo2 *int32
	if mr.BloodPressureSystolic.Valid { sys = &mr.BloodPressureSystolic.Int32 }
	if mr.BloodPressureDiastolic.Valid { dia = &mr.BloodPressureDiastolic.Int32 }
	if mr.HeartRate.Valid { hr = &mr.HeartRate.Int32 }
	if mr.RespiratoryRate.Valid { resp = &mr.RespiratoryRate.Int32 }
	if mr.OxygenSaturation.Valid { spo2 = &mr.OxygenSaturation.Int32 }
	
	var tm, h, w, bmi *float64
	if mr.Temperature.Valid {
		if val, err := strconv.ParseFloat(mr.Temperature.String, 64); err == nil {
			tm = &val
		}
	}
	if mr.Height.Valid {
		if val, err := strconv.ParseFloat(mr.Height.String, 64); err == nil {
			h = &val
		}
	}
	if mr.Weight.Valid {
		if val, err := strconv.ParseFloat(mr.Weight.String, 64); err == nil {
			w = &val
		}
	}
	if mr.Bmi.Valid {
		if val, err := strconv.ParseFloat(mr.Bmi.String, 64); err == nil {
			bmi = &val
		}
	}

	record := &domain.MedicalRecord{
		ID:                     mr.ID,
		EncounterNo:            mr.EncounterNo,
		MRN:                    mr.Mrn,
		Notes:                  mr.Notes.String,
		Status:                 mr.Status.String,
		EncounterSeverityLevel: mr.EncounterSeverityLevel.String,
		Triage: domain.TriageData{
			BloodPressureSystolic:  sys,
			BloodPressureDiastolic: dia,
			Temperature:            tm,
			HeartRate:              hr,
			RespiratoryRate:        resp,
			OxygenSaturation:       spo2,
			Height:                 h,
			Weight:                 w,
			BMI:                    bmi,
			Allergies:              mr.Allergies.String,
			Notes:                  mr.Notes.String,
		},
		CreatedAt: mr.CreatedAt.Time,
		UpdatedAt: mr.UpdatedAt.Time,
	}

	// Fetch Diagnoses
	dbDiagnoses, err := r.q.GetEncounterDiagnoses(ctx, mr.EncounterNo)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	var diagnoses []domain.EncounterDiagnosis
	for _, d := range dbDiagnoses {
		diagnoses = append(diagnoses, domain.EncounterDiagnosis{
			ID:                   d.ID.String(),
			ICD10Code:            d.Icd10Code,
			ICD10Name:            d.Icd10Name,
			DiagnosisType:        d.DiagnosisType,
			Sequence:             d.Sequence,
			ClinicalNotes:        d.ClinicalNotes.String,
			SeverityLevel:        d.SeverityLevel,
			SeveritySetRole:      d.SeveritySetRole.String,
			AutoKBMCode:          d.AutoKbmCode.String,
			AutoKBMName:          d.AutoKbmName.String,
			KBMMappingConfidence: d.KbmMappingConfidence.String,
			SNOMEDConceptID:      d.SnomedConceptID.String,
			SNOMEDName:           d.SnomedName.String,
			IsVerifiedByRM:       d.IsVerifiedByRm,
			VerifiedBy:           d.VerifiedBy.String,
		})
	}
	record.Diagnoses = diagnoses


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

	// Calculate Clinical Checklist & Readiness
	triageCompleted := mr.BloodPressureSystolic.Valid && mr.BloodPressureDiastolic.Valid && mr.Temperature.Valid && mr.HeartRate.Valid
	diagnosisCompleted := len(diagnoses) > 0
	actionsCompleted := len(actions) > 0

	var missing []string
	if !triageCompleted {
		missing = append(missing, "Asesmen Triage / Tanda Vital")
	}
	if !diagnosisCompleted {
		missing = append(missing, "Diagnosa Medis Utama")
	}

	record.Checklist = domain.ClinicalChecklist{
		TriageCompleted:        triageCompleted,
		DiagnosisCompleted:     diagnosisCompleted,
		ActionsCompleted:       actionsCompleted,
		ActionsCount:           int32(len(actions)),
		PrescriptionCompleted:  false,
		PrescriptionCount:      0,
		IsReadyToComplete:      triageCompleted && diagnosisCompleted,
		MissingMandatoryFields: missing,
		BaseConsultationFee:    "Pemeriksaan Dokter (Include saat Registrasi)",
	}

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

func (r *emrRepoSqlc) EstimateWaitTime(ctx context.Context, doctorID, deptCode, gender, ageBracket string) (int64, error) {
	// Use Option A: without diagnosis
	avg, err := r.q.GetClinicWaitAggregateWithoutDiagnosis(ctx, db.GetClinicWaitAggregateWithoutDiagnosisParams{
		DoctorID:       doctorID,
		DepartmentCode: deptCode,
		Gender:         gender,
		AgeBracket:     ageBracket,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 15, nil // Default fallback wait time
		}
		return 15, err
	}
	
	if avg == 0 {
		return 15, nil
	}
	return int64(avg), nil
}



