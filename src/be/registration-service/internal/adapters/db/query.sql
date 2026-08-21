-- name: CreateEncounter :one
INSERT INTO encounters (encounter_no, mrn, department, doctor_id, guarantor, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING encounter_no, mrn, department, doctor_id, guarantor, payment_status, status, created_at;

-- name: CreateOutboxEvent :one
INSERT INTO outbox_events (id, aggregate_type, event_type, payload, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, aggregate_type, event_type, payload, status, created_at;

-- name: GetPendingOutboxEvents :many
SELECT id, aggregate_type, event_type, payload, status, created_at
FROM outbox_events
WHERE status = 'PENDING'
ORDER BY created_at ASC;

-- name: UpdateOutboxEventStatus :exec
UPDATE outbox_events
SET status = $2
WHERE id = $1;

-- name: CountActiveEncountersByDept :one
SELECT COUNT(*) FROM encounters
WHERE department = $1
  AND status = 'REGISTERED'
  AND created_at >= $2 AND created_at < $3
  AND deleted_dt IS NULL;

-- name: GetTodayEncounters :many
SELECT encounter_no, mrn, department, doctor_id, guarantor, payment_status, status, created_at
FROM encounters
WHERE created_at >= $1 AND created_at < $2
  AND deleted_dt IS NULL
ORDER BY created_at DESC;

-- name: UpdateEncounterStatus :exec
UPDATE encounters
SET status = $2
WHERE encounter_no = $1;

-- name: UpdatePaymentStatus :exec
UPDATE encounters
SET payment_status = $2
WHERE encounter_no = $1;

-- name: UpdateGuarantor :exec
UPDATE encounters
SET guarantor = $2
WHERE encounter_no = $1;

-- name: GetMaxSequenceForMonth :one
SELECT COALESCE(MAX(CAST(RIGHT(encounter_no, 4) AS INTEGER)), 0)::INT
FROM encounters
WHERE encounter_no LIKE $1;

-- name: GetPatientStatusCounts :one
WITH ValidEncounters AS (
    SELECT mrn
    FROM encounters
    WHERE deleted_dt IS NULL
      AND status != 'CANCELLED'
      AND ((guarantor = 'UMUM' AND payment_status = 'PAID') OR guarantor != 'UMUM')
),
PatientStats AS (
    SELECT 
        COUNT(*) as total_valid_encounters,
        COUNT(DISTINCT mrn) as total_unique_patients
    FROM ValidEncounters
)
SELECT 
    COALESCE(total_unique_patients, 0)::INT AS new_patients,
    COALESCE((total_valid_encounters - total_unique_patients), 0)::INT AS old_patients
FROM PatientStats;

-- name: GetAverageWaitTimePerPoli :many
SELECT department AS poli_code, 
       COALESCE(AVG(EXTRACT(EPOCH FROM (consultation_start_time - created_at))/60), 0)::INT as avg_wait_minutes
FROM encounters
WHERE deleted_dt IS NULL
  AND consultation_start_time IS NOT NULL
  AND status != 'CANCELLED'
  AND ((guarantor = 'UMUM' AND payment_status = 'PAID') OR guarantor != 'UMUM')
  AND created_at >= sqlc.arg(start_time) AND created_at < sqlc.arg(end_time)
GROUP BY department;

-- name: GetWeeklyVisits :many
SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS visit_date, COUNT(*)::INT as total_visits
FROM encounters
WHERE deleted_dt IS NULL
  AND status != 'CANCELLED'
  AND ((guarantor = 'UMUM' AND payment_status = 'PAID') OR guarantor != 'UMUM')
  AND created_at >= sqlc.arg(start_time) AND created_at < sqlc.arg(end_time)
GROUP BY visit_date
ORDER BY visit_date;
