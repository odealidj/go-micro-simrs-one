package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/aliube/go-micro-simrs-one/registration-service/internal/adapters/db"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/domain"
	"github.com/aliube/go-micro-simrs-one/registration-service/internal/core/ports"
	"github.com/aliube/go-micro-simrs-one/shared/pkg/outbox"
)

type registrationRepoSqlc struct {
	q  *db.Queries
	db *sql.DB
}

func NewRegistrationRepository(d *sql.DB) ports.RegistrationRepository {
	return &registrationRepoSqlc{
		q:  db.New(d),
		db: d,
	}
}

func (r *registrationRepoSqlc) SaveEncounter(ctx context.Context, encounter *domain.Encounter) error {
	_, err := r.q.CreateEncounter(ctx, db.CreateEncounterParams{
		EncounterNo:    encounter.EncounterNo,
		Mrn:            encounter.MRN,
		DepartmentCode: encounter.DepartmentCode,
		DoctorID:       encounter.DoctorID,
		PerawatID:      sql.NullString{String: encounter.PerawatID, Valid: encounter.PerawatID != ""},
		Status:         encounter.Status,
	})
	return err
}

func (r *registrationRepoSqlc) SaveOutboxEvent(ctx context.Context, event *domain.OutboxEvent) error {
	_, err := r.q.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
		ID:            event.ID,
		AggregateType: event.Aggregate,
		EventType:     event.Type,
		Payload:       json.RawMessage(event.Payload),
		Status:        event.Status,
	})
	return err
}

func (r *registrationRepoSqlc) CountActiveEncountersByDept(ctx context.Context, departmentCode string) (int64, error) {
	now := time.Now()
	y, m, d := now.Date()
	startOfDay := time.Date(y, m, d, 0, 0, 0, 0, now.Location())
	startOfNextDay := startOfDay.AddDate(0, 0, 1)

	return r.q.CountActiveEncountersByDept(ctx, db.CountActiveEncountersByDeptParams{
		DepartmentCode: departmentCode,
		CreatedAt:      sql.NullTime{Time: startOfDay, Valid: true},
		CreatedAt_2:    sql.NullTime{Time: startOfNextDay, Valid: true},
	})
}

// --- outbox.Repository implementation (used by outbox.NewRelay) ---

func (r *registrationRepoSqlc) GetPendingOutboxEvents(ctx context.Context) ([]outbox.Event, error) {
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

func (r *registrationRepoSqlc) MarkEventAsPublished(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "PUBLISHED",
	})
}

func (r *registrationRepoSqlc) MarkEventAsFailed(ctx context.Context, id string) error {
	return r.q.UpdateOutboxEventStatus(ctx, db.UpdateOutboxEventStatusParams{
		ID:     id,
		Status: "FAILED",
	})
}

func (r *registrationRepoSqlc) GetTodayEncounters(ctx context.Context, startDate, endDate time.Time) ([]*domain.Encounter, error) {
	y1, m1, d1 := startDate.Date()
	startOfDay := time.Date(y1, m1, d1, 0, 0, 0, 0, startDate.Location())
	y2, m2, d2 := endDate.Date()
	startOfNextDay := time.Date(y2, m2, d2, 0, 0, 0, 0, endDate.Location()).AddDate(0, 0, 1)

	rows, err := r.q.GetTodayEncounters(ctx, db.GetTodayEncountersParams{
		CreatedAt:   sql.NullTime{Time: startOfDay, Valid: true},
		CreatedAt_2: sql.NullTime{Time: startOfNextDay, Valid: true},
	})
	if err != nil {
		return nil, err
	}
	var encounters []*domain.Encounter
	newPatientCache := make(map[string]bool)

	for _, row := range rows {
		enc := &domain.Encounter{
			EncounterNo:    row.EncounterNo,
			MRN:            row.Mrn,
			DepartmentCode: row.DepartmentCode,
			DoctorID:       row.DoctorID,
			PerawatID:      row.PerawatID.String,
			Status:         row.Status,
			CreatedAt:      row.CreatedAt.Time,
		}

		// Determine if the patient is new (<= 1 valid encounter) with memoization to avoid N+1 queries
		if isNew, ok := newPatientCache[row.Mrn]; ok {
			enc.IsNewPatient = isNew
		} else {
			var count int
			err := r.db.QueryRowContext(ctx, `
				SELECT COUNT(*)
				FROM encounters
				WHERE mrn = $1
				  AND deleted_dt IS NULL
				  AND status != 'CANCELLED'
				  AND ((guarantor = 'UMUM' AND payment_status = 'PAID') OR guarantor != 'UMUM')
			`, row.Mrn).Scan(&count)
			isNewPatient := err == nil && count <= 1
			newPatientCache[row.Mrn] = isNewPatient
			enc.IsNewPatient = isNewPatient
		}

		encounters = append(encounters, enc)
	}
	return encounters, nil
}

func (r *registrationRepoSqlc) UpdateEncounterStatus(ctx context.Context, encounterNo, status string) error {
	return r.q.UpdateEncounterStatus(ctx, db.UpdateEncounterStatusParams{
		EncounterNo: encounterNo,
		Status:      status,
	})
}

func (r *registrationRepoSqlc) GetMaxSequenceForMonth(ctx context.Context, prefix string) (int32, error) {
	return r.q.GetMaxSequenceForMonth(ctx, prefix+"%")
}

func (r *registrationRepoSqlc) GetDashboardMetrics(ctx context.Context, targetDate time.Time) (newPatients int32, oldPatients int32, waitTimes map[string]int32, weeklyVisits map[string]int32, err error) {
	y, m, d := targetDate.Date()
	startOfDay := time.Date(y, m, d, 0, 0, 0, 0, targetDate.Location())
	startOfNextDay := startOfDay.AddDate(0, 0, 1)

	// 1. Patient Status Counts
	patientCounts, err := r.q.GetPatientStatusCounts(ctx)
	if err != nil && err != sql.ErrNoRows {
		return 0, 0, nil, nil, err
	}
	newPatients = int32(patientCounts.NewPatients)
	oldPatients = int32(patientCounts.OldPatients)

	// 2. Average Wait Time Per Poli
	waitTimesDB, err := r.q.GetAverageWaitTimePerPoli(ctx, db.GetAverageWaitTimePerPoliParams{
		StartTime: sql.NullTime{Time: startOfDay, Valid: true},
		EndTime:   sql.NullTime{Time: startOfNextDay, Valid: true},
	})
	if err != nil && err != sql.ErrNoRows {
		return 0, 0, nil, nil, err
	}
	waitTimes = make(map[string]int32)
	for _, w := range waitTimesDB {
		waitTimes[w.DepartmentCode] = int32(w.AvgWaitMinutes)
	}

	// 3. Last 5 Days Visits
	startOfLast5Days := startOfDay.AddDate(0, 0, -4)
	weeklyVisitsDB, err := r.q.GetWeeklyVisits(ctx, db.GetWeeklyVisitsParams{
		StartTime: sql.NullTime{Time: startOfLast5Days, Valid: true},
		EndTime:   sql.NullTime{Time: startOfNextDay, Valid: true},
	})
	if err != nil && err != sql.ErrNoRows {
		return 0, 0, nil, nil, err
	}
	weeklyVisits = make(map[string]int32)
	for i := 4; i >= 0; i-- {
		dateStr := startOfDay.AddDate(0, 0, -i).Format("2006-01-02")
		weeklyVisits[dateStr] = 0
	}
	for _, wv := range weeklyVisitsDB {
		weeklyVisits[wv.VisitDate] = int32(wv.TotalVisits)
	}

	return newPatients, oldPatients, waitTimes, weeklyVisits, nil
}

func (r *registrationRepoSqlc) UpdatePaymentStatus(ctx context.Context, encounterNo, status string) error {
	return r.q.UpdatePaymentStatus(ctx, db.UpdatePaymentStatusParams{
		EncounterNo:   encounterNo,
		PaymentStatus: sql.NullString{String: status, Valid: true},
	})
}

func (r *registrationRepoSqlc) UpdateGuarantor(ctx context.Context, encounterNo, guarantor string) error {
	return r.q.UpdateGuarantor(ctx, db.UpdateGuarantorParams{
		EncounterNo: encounterNo,
		Guarantor:   sql.NullString{String: guarantor, Valid: true},
	})
}

func (r *registrationRepoSqlc) GetActivePerawatByPoli(ctx context.Context, poliCode string) (string, error) {
	// 1. Cek prioritas jadwal piket hari ini
	var perawatID string
	err := r.db.QueryRowContext(ctx, `
		SELECT perawat_id
		FROM auth.jadwal_piket_poli
		WHERE poli_code = $1
		  AND piket_date = CURRENT_DATE
		  AND perawat_id IS NOT NULL
		LIMIT 1
	`, poliCode).Scan(&perawatID)
	if err == nil && perawatID != "" {
		return perawatID, nil
	}

	// 2. Fallback ke jadwal reguler
	err = r.db.QueryRowContext(ctx, `
		SELECT perawat_id
		FROM auth.mapping_perawat_poli
		WHERE poli_code = $1
		  AND CURRENT_DATE BETWEEN start_date AND end_date
		  AND (EXTRACT(ISODOW FROM CURRENT_DATE)::int = ANY(days_of_week))
		  AND deleted_dt IS NULL
		ORDER BY start_date DESC
		LIMIT 1
	`, poliCode).Scan(&perawatID)
	if err != nil {
		return "", err
	}
	return perawatID, nil
}

func (r *registrationRepoSqlc) GetActiveDoctorByPoli(ctx context.Context, poliCode string) (string, error) {
	// 1. Cek prioritas jadwal piket hari ini
	var doctorID string
	err := r.db.QueryRowContext(ctx, `
		SELECT dokter_id
		FROM auth.jadwal_piket_poli
		WHERE poli_code = $1
		  AND piket_date = CURRENT_DATE
		LIMIT 1
	`, poliCode).Scan(&doctorID)
	if err == nil && doctorID != "" {
		return doctorID, nil
	}

	// 2. Fallback ke jadwal reguler
	err = r.db.QueryRowContext(ctx, `
		SELECT dokter_id
		FROM auth.mapping_dokter_poli
		WHERE poli_code = $1
		  AND CURRENT_DATE BETWEEN start_date AND end_date
		  AND (EXTRACT(ISODOW FROM CURRENT_DATE)::int = ANY(days_of_week))
		  AND deleted_dt IS NULL
		ORDER BY start_date DESC
		LIMIT 1
	`, poliCode).Scan(&doctorID)
	if err != nil {
		return "", err
	}
	return doctorID, nil
}

