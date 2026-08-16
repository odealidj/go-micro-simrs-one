-- name: CreateEncounter :one
INSERT INTO encounters (encounter_no, mrn, department, doctor_id, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING encounter_no, mrn, department, doctor_id, status, created_at;

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
  AND DATE(created_at) = CURRENT_DATE
  AND deleted_dt IS NULL;

-- name: GetTodayEncounters :many
SELECT encounter_no, mrn, department, doctor_id, status, created_at
FROM encounters
WHERE DATE(created_at) = $1
  AND deleted_dt IS NULL
ORDER BY created_at DESC;

-- name: UpdateEncounterStatus :exec
UPDATE encounters
SET status = $2
WHERE encounter_no = $1;
