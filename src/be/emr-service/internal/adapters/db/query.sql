-- name: CreateDraftMR :one
INSERT INTO medical_records (id, encounter_no, mrn)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddDiagnosis :one
UPDATE medical_records
SET icd10_codes = array_append(COALESCE(icd10_codes, ARRAY[]::TEXT[]), $2), notes = $3, updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1
RETURNING *;

-- name: GetMRByEncounterNo :one
SELECT *
FROM medical_records
WHERE encounter_no = $1 LIMIT 1;

-- name: UpdateTriage :one
UPDATE medical_records
SET blood_pressure_systolic = $2, blood_pressure_diastolic = $3, temperature = $4, heart_rate = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1
RETURNING *;

-- name: AddMedicalAction :one
INSERT INTO medical_actions (id, medical_record_id, action_code, action_name, price, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetMedicalActionsByRecordID :many
SELECT *
FROM medical_actions
WHERE medical_record_id = $1
ORDER BY created_at ASC;

-- name: CreateOutboxEvent :one
INSERT INTO outbox_events (id, aggregate_type, event_type, payload, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetPendingOutboxEvents :many
SELECT *
FROM outbox_events
WHERE status = 'PENDING'
ORDER BY created_at ASC LIMIT 100;

-- name: UpdateOutboxEventStatus :exec
UPDATE outbox_events
SET status = $2
WHERE id = $1;
