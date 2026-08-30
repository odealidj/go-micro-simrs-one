-- name: CreateInvoice :one
INSERT INTO invoices (id, encounter_no, total_amount, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateInvoiceStatus :one
UPDATE invoices
SET status = $2, paid_at = $3
WHERE id = $1 AND deleted_dt IS NULL
RETURNING *;

-- name: GetInvoice :one
SELECT *
FROM invoices
WHERE id = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: GetInvoiceByEncounterNo :one
SELECT *
FROM invoices
WHERE encounter_no = $1 AND deleted_dt IS NULL 
ORDER BY created_at DESC LIMIT 1;

-- name: GetInvoicesByEncounterNo :many
SELECT *
FROM invoices
WHERE encounter_no = $1 AND deleted_dt IS NULL
ORDER BY created_at ASC;

-- name: GetActiveUnpaidInvoiceByEncounterNo :one
SELECT *
FROM invoices
WHERE encounter_no = $1 AND status = 'UNPAID' AND deleted_dt IS NULL
ORDER BY created_at DESC LIMIT 1;

-- name: GetInvoiceItemByPattern :one
SELECT it.id, it.invoice_id, it.item_type, it.description, it.amount, it.created_at, it.deleted_dt, it.deleted_by, i.status as invoice_status
FROM invoice_items it
JOIN invoices i ON i.id = it.invoice_id
WHERE i.encounter_no = $1 AND it.description LIKE $2 AND it.deleted_dt IS NULL AND i.deleted_dt IS NULL
LIMIT 1;

-- name: UpdateInvoiceAmount :one
UPDATE invoices
SET total_amount = total_amount + $2
WHERE id = $1 AND deleted_dt IS NULL
RETURNING *;

-- name: CreateInvoiceItem :one
INSERT INTO invoice_items (id, invoice_id, item_type, description, amount)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetInvoiceItems :many
SELECT *
FROM invoice_items
WHERE invoice_id = $1 AND deleted_dt IS NULL
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

-- name: SoftDeleteInvoiceItemByPattern :exec
UPDATE invoice_items
SET deleted_dt = CURRENT_TIMESTAMP
WHERE invoice_id = $1 AND description LIKE $2 AND deleted_dt IS NULL;

-- name: RecalculateInvoiceTotal :one
UPDATE invoices
SET total_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM invoice_items
    WHERE invoice_id = $1 AND deleted_dt IS NULL
)
WHERE id = $1 AND deleted_dt IS NULL
RETURNING *;
