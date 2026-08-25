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
SELECT i.item_code, i.name, i.stock_quantity, i.price, i.deleted_dt, i.deleted_by,
       COALESCE(array_agg(DISTINCT m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT map.kfa_code)::int AS kfa_count,
       COUNT(DISTINCT map.dpho_code)::int AS dpho_count,
       COALESCE(BOOL_OR(d.is_fornas), false)::bool AS is_fornas,
       COALESCE(BOOL_OR(d.is_prb), false)::bool AS is_prb,
       COALESCE(MAX(CASE WHEN map.is_primary THEN map.kfa_code ELSE NULL END), MAX(map.kfa_code), '')::varchar AS kfa_code,
       COALESCE(MAX(CASE WHEN map.is_primary THEN map.dpho_code ELSE NULL END), MAX(map.dpho_code), '')::varchar AS bpjs_dpho_code,
       COALESCE(MAX(d.restriction), '')::varchar AS restriction
FROM inventory i
LEFT JOIN inventory_polyclinic_mappings m ON m.item_code = i.item_code AND m.deleted_dt IS NULL
LEFT JOIN inventory_kfa_mapping map ON map.item_code = i.item_code AND map.deleted_dt IS NULL
LEFT JOIN bpjs_dpho_catalog d ON d.dpho_code = map.dpho_code AND d.deleted_dt IS NULL
WHERE i.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $1 || '%' OR i.item_code ILIKE '%' || $2 || '%')
GROUP BY i.item_code
ORDER BY i.item_code ASC LIMIT $3 OFFSET $4;

-- name: CountObat :one
SELECT COUNT(*) FROM inventory
WHERE deleted_dt IS NULL
  AND (name ILIKE '%' || $1 || '%' OR item_code ILIKE '%' || $2 || '%');

-- name: GetObatByPolyclinic :many
SELECT i.item_code, i.name, i.stock_quantity, i.price, i.deleted_dt, i.deleted_by,
       COALESCE(array_agg(DISTINCT m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT map.kfa_code)::int AS kfa_count,
       COUNT(DISTINCT map.dpho_code)::int AS dpho_count,
       COALESCE(BOOL_OR(d.is_fornas), false)::bool AS is_fornas,
       COALESCE(BOOL_OR(d.is_prb), false)::bool AS is_prb,
       COALESCE(MAX(CASE WHEN map.is_primary THEN map.kfa_code ELSE NULL END), MAX(map.kfa_code), '')::varchar AS kfa_code,
       COALESCE(MAX(CASE WHEN map.is_primary THEN map.dpho_code ELSE NULL END), MAX(map.dpho_code), '')::varchar AS bpjs_dpho_code,
       COALESCE(MAX(d.restriction), '')::varchar AS restriction
FROM inventory i
JOIN inventory_polyclinic_mappings m ON i.item_code = m.item_code
LEFT JOIN inventory_polyclinic_mappings m2 ON m2.item_code = i.item_code AND m2.deleted_dt IS NULL
LEFT JOIN inventory_kfa_mapping map ON map.item_code = i.item_code AND map.deleted_dt IS NULL
LEFT JOIN bpjs_dpho_catalog d ON d.dpho_code = map.dpho_code AND d.deleted_dt IS NULL
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $2 || '%' OR i.item_code ILIKE '%' || $3 || '%')
GROUP BY i.item_code
ORDER BY i.item_code ASC LIMIT $4 OFFSET $5;

-- name: CountObatByPolyclinic :one
SELECT COUNT(*) FROM inventory i
JOIN inventory_polyclinic_mappings m ON i.item_code = m.item_code
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $2 || '%' OR i.item_code ILIKE '%' || $3 || '%');

-- name: GetKFA :many
SELECT k.kfa_code, k.name, k.active_substance, k.dosage_form, k.strength, k.bpom_nie, k.atc_code, k.snomed_concept_id, k.is_active,
       COUNT(DISTINCT map.item_code)::int AS mapped_item_count
FROM kfa_catalog k
LEFT JOIN inventory_kfa_mapping map ON k.kfa_code = map.kfa_code AND map.deleted_dt IS NULL
WHERE k.deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR k.name ILIKE '%' || $1 || '%' OR k.kfa_code ILIKE '%' || $1 || '%' OR k.active_substance ILIKE '%' || $1 || '%')
GROUP BY k.kfa_code
ORDER BY k.kfa_code ASC LIMIT $2 OFFSET $3;

-- name: CountKFA :one
SELECT COUNT(*) FROM kfa_catalog
WHERE deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR name ILIKE '%' || $1 || '%' OR kfa_code ILIKE '%' || $1 || '%' OR active_substance ILIKE '%' || $1 || '%');

-- name: GetDPHO :many
SELECT d.dpho_code, d.dpho_name, d.is_fornas, d.is_prb, d.restriction, d.max_qty_per_claim, d.is_active,
       COUNT(DISTINCT map.item_code)::int AS mapped_item_count
FROM bpjs_dpho_catalog d
LEFT JOIN inventory_kfa_mapping map ON d.dpho_code = map.dpho_code AND map.deleted_dt IS NULL
WHERE d.deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR d.dpho_name ILIKE '%' || $1 || '%' OR d.dpho_code ILIKE '%' || $1 || '%')
  AND (sqlc.narg('is_fornas')::bool IS NULL OR d.is_fornas = sqlc.narg('is_fornas'))
  AND (sqlc.narg('is_prb')::bool IS NULL OR d.is_prb = sqlc.narg('is_prb'))
GROUP BY d.dpho_code
ORDER BY d.dpho_code ASC LIMIT $2 OFFSET $3;

-- name: CountDPHO :one
SELECT COUNT(*) FROM bpjs_dpho_catalog
WHERE deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR dpho_name ILIKE '%' || $1 || '%' OR dpho_code ILIKE '%' || $1 || '%')
  AND (sqlc.narg('is_fornas')::bool IS NULL OR is_fornas = sqlc.narg('is_fornas'))
  AND (sqlc.narg('is_prb')::bool IS NULL OR is_prb = sqlc.narg('is_prb'));

-- name: GetKFAMappingsForObat :many
SELECT k.kfa_code, k.name, k.active_substance, k.dosage_form, k.strength, k.bpom_nie, k.atc_code, k.snomed_concept_id,
       map.is_primary, map.mapping_confidence
FROM kfa_catalog k
JOIN inventory_kfa_mapping map ON k.kfa_code = map.kfa_code
WHERE map.item_code = $1 AND k.deleted_dt IS NULL AND map.deleted_dt IS NULL
ORDER BY map.is_primary DESC;

-- name: GetDPHOMappingsForObat :many
SELECT d.dpho_code, d.dpho_name, d.is_fornas, d.is_prb, d.restriction, d.max_qty_per_claim
FROM bpjs_dpho_catalog d
JOIN inventory_kfa_mapping map ON d.dpho_code = map.dpho_code
WHERE map.item_code = $1 AND d.deleted_dt IS NULL AND map.deleted_dt IS NULL
ORDER BY map.is_primary DESC;

-- name: GetPolyclinicsForObat :many
SELECT DISTINCT polyclinic_code
FROM inventory_polyclinic_mappings
WHERE item_code = $1 AND deleted_dt IS NULL
ORDER BY polyclinic_code ASC;


