-- name: CreateInvoice :one
INSERT INTO invoices (id, encounter_no, total_amount, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateInvoiceStatus :one
UPDATE invoices
SET status = $2, paid_at = $3
WHERE id = $1
RETURNING *;

-- name: GetInvoice :one
SELECT *
FROM invoices
WHERE id = $1 LIMIT 1;

-- name: GetInvoiceByEncounterNo :one
SELECT *
FROM invoices
WHERE encounter_no = $1 LIMIT 1;

-- name: UpdateInvoiceAmount :one
UPDATE invoices
SET total_amount = total_amount + $2
WHERE id = $1
RETURNING *;

-- name: CreateInvoiceItem :one
INSERT INTO invoice_items (id, invoice_id, item_type, description, amount)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetInvoiceItems :many
SELECT *
FROM invoice_items
WHERE invoice_id = $1
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
