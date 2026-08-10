-- name: CreateInvoice :one
INSERT INTO invoices (id, encounter_no, related_id, amount, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, encounter_no, related_id, amount, status, created_at;

-- name: UpdateInvoiceStatus :one
UPDATE invoices
SET status = $2
WHERE id = $1
RETURNING id, encounter_no, related_id, amount, status, created_at;

-- name: GetInvoice :one
SELECT id, encounter_no, related_id, amount, status, created_at
FROM invoices
WHERE id = $1 LIMIT 1;
