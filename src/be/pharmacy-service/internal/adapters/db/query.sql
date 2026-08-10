-- name: GetInventoryItem :one
SELECT item_code, name, stock_quantity, price
FROM inventory
WHERE item_code = $1 LIMIT 1;

-- name: UpdateStock :exec
UPDATE inventory
SET stock_quantity = stock_quantity - $2
WHERE item_code = $1;

-- name: CreatePrescription :one
INSERT INTO prescriptions (id, encounter_no, status, is_compounded, notes)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: CreatePrescriptionItem :one
INSERT INTO prescription_items (id, prescription_id, item_code, quantity, price)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdatePrescriptionStatus :one
UPDATE prescriptions
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;

-- name: GetPrescription :one
SELECT *
FROM prescriptions
WHERE id = $1 LIMIT 1;

-- name: GetPrescriptionItems :many
SELECT *
FROM prescription_items
WHERE prescription_id = $1;

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
INSERT INTO encounter_payments (encounter_no, status, updated_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
ON CONFLICT (encounter_no)
DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP;

-- name: GetEncounterPayment :one
SELECT status
FROM encounter_payments
WHERE encounter_no = $1 LIMIT 1;
