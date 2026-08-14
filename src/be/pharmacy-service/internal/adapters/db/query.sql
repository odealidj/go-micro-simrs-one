-- name: GetInventoryItem :one
SELECT item_code, name, stock_quantity, price
FROM inventory
WHERE item_code = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: GetInventoryItemForUpdate :one
SELECT item_code, name, stock_quantity, price
FROM inventory
WHERE item_code = $1 AND deleted_dt IS NULL LIMIT 1 FOR UPDATE;

-- name: UpdateStock :exec
UPDATE inventory
SET stock_quantity = stock_quantity - $2
WHERE item_code = $1 AND deleted_dt IS NULL;

-- name: CreatePrescription :one
INSERT INTO prescriptions (id, encounter_no, status, is_compounded, notes, diagnosis, gender, age_bracket, doctor_id, department_code)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: CreatePrescriptionItem :one
INSERT INTO prescription_items (id, prescription_id, item_code, quantity, price)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdatePrescriptionStatus :one
UPDATE prescriptions
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_dt IS NULL
RETURNING *;

-- name: GetPrescription :one
SELECT *
FROM prescriptions
WHERE id = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: GetPrescriptionItems :many
SELECT *
FROM prescription_items
WHERE prescription_id = $1 AND deleted_dt IS NULL;

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

-- name: UpsertEncounterPayment :exec
INSERT INTO encounter_payments (encounter_no, status, paid_at, updated_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
ON CONFLICT (encounter_no)
DO UPDATE SET status = EXCLUDED.status, paid_at = EXCLUDED.paid_at, updated_at = CURRENT_TIMESTAMP;

-- name: GetEncounterPayment :one
SELECT status
FROM encounter_payments
WHERE encounter_no = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: UpsertPharmacyWaitAggregate :exec
INSERT INTO pharmacy_wait_time_aggregates (diagnosis, doctor_id, department_code, gender, age_bracket, is_compounded, average_wait_minutes, sample_count)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (diagnosis, doctor_id, department_code, gender, age_bracket, is_compounded) 
DO UPDATE SET 
    average_wait_minutes = EXCLUDED.average_wait_minutes,
    sample_count = EXCLUDED.sample_count,
    updated_at = CURRENT_TIMESTAMP;

-- name: GetPharmacyWaitAggregate :one
SELECT average_wait_minutes, sample_count
FROM pharmacy_wait_time_aggregates
WHERE diagnosis = $1 AND doctor_id = $2 AND department_code = $3 AND gender = $4 AND age_bracket = $5 AND is_compounded = $6;

-- name: GetPharmacyWaitAggregateWithoutDiagnosis :one
SELECT COALESCE(AVG(average_wait_minutes), 0)::float8 AS avg_wait_minutes
FROM pharmacy_wait_time_aggregates
WHERE doctor_id = $1 AND department_code = $2 AND gender = $3 AND age_bracket = $4 AND is_compounded = $5;

-- Master Data Queries
-- name: GetObat :many
SELECT i.*, 
       COALESCE(array_agg(m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM inventory i
LEFT JOIN inventory_polyclinic_mappings m ON m.item_code = i.item_code AND m.deleted_dt IS NULL
WHERE i.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $1 || '%' OR i.item_code ILIKE '%' || $2 || '%')
GROUP BY i.item_code
ORDER BY i.item_code ASC LIMIT $3 OFFSET $4;

-- name: CountObat :one
SELECT COUNT(*) FROM inventory
WHERE deleted_dt IS NULL
  AND (name ILIKE '%' || $1 || '%' OR item_code ILIKE '%' || $2 || '%');

-- name: GetObatByPolyclinic :many
SELECT i.*, 
       COALESCE(array_agg(m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM inventory i
JOIN inventory_polyclinic_mappings m ON i.item_code = m.item_code
LEFT JOIN inventory_polyclinic_mappings m2 ON m2.item_code = i.item_code AND m2.deleted_dt IS NULL
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $2 || '%' OR i.item_code ILIKE '%' || $3 || '%')
GROUP BY i.item_code
ORDER BY i.item_code ASC LIMIT $4 OFFSET $5;

-- name: CountObatByPolyclinic :one
SELECT COUNT(*) FROM inventory i
JOIN inventory_polyclinic_mappings m ON i.item_code = m.item_code
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $2 || '%' OR i.item_code ILIKE '%' || $3 || '%');

