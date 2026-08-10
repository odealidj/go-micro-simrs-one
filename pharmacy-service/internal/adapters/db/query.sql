-- name: GetInventoryItem :one
SELECT item_code, name, stock_quantity, price
FROM inventory
WHERE item_code = $1 LIMIT 1;

-- name: UpdateStock :exec
UPDATE inventory
SET stock_quantity = stock_quantity - $2
WHERE item_code = $1;

-- name: CreatePrescription :one
INSERT INTO prescriptions (id, encounter_no, item_code, quantity, status, amount)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, encounter_no, item_code, quantity, status, amount, created_at, updated_at;

-- name: UpdatePrescriptionStatus :one
UPDATE prescriptions
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, encounter_no, item_code, quantity, status, amount, created_at, updated_at;

-- name: GetPrescription :one
SELECT id, encounter_no, item_code, quantity, status, amount, created_at, updated_at
FROM prescriptions
WHERE id = $1 LIMIT 1;
