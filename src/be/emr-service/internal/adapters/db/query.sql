-- name: CreateDraftMR :one
INSERT INTO medical_records (id, encounter_no, mrn)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddDiagnosisKBM :one
UPDATE medical_records
SET kbm_code = $2,
    kbm_name = $3,
    icd10_mapping_status = 'AUTO_MAPPED',
    notes = $4,
    updated_at = CURRENT_TIMESTAMP,
    doctor_id = $5,
    department_code = $6,
    gender = $7,
    age_bracket = $8
WHERE encounter_no = $1
RETURNING *;

-- name: CompleteEncounter :exec
UPDATE medical_records
SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1;

-- name: SearchKBM :many
SELECT * FROM kbm_catalog
WHERE is_active = true AND deleted_dt IS NULL
  AND kbm_name ILIKE '%' || $1 || '%'
ORDER BY kbm_name ASC
LIMIT $2 OFFSET $3;

-- name: SearchKBMByPolyclinic :many
SELECT c.* 
FROM kbm_catalog c
JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code
WHERE c.is_active = true AND c.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND c.kbm_name ILIKE '%' || $2 || '%'
ORDER BY c.kbm_name ASC
LIMIT $3 OFFSET $4;

-- name: GetKBMByCode :one
SELECT * FROM kbm_catalog
WHERE kbm_code = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: VerifyICD10Mapping :one
UPDATE medical_records
SET icd10_codes = $2,
    icd10_mapping_status = 'VERIFIED',
    notes = CASE WHEN $3::text != '' THEN notes || E'\nCatatan RM: ' || $3::text ELSE notes END,
    updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1
RETURNING *;

-- name: GetICD10MappingsByKBM :many
SELECT icd10_code, is_primary
FROM kbm_icd10_mappings
WHERE kbm_code = $1 AND deleted_dt IS NULL
ORDER BY is_primary DESC, icd10_code ASC;

-- name: ListPendingICD10Verifications :many
SELECT encounter_no, mrn, kbm_code, kbm_name, icd10_mapping_status, created_at
FROM medical_records
WHERE icd10_mapping_status IN ('PENDING_REVIEW', 'AUTO_MAPPED') AND deleted_dt IS NULL
ORDER BY created_at ASC
LIMIT $1 OFFSET $2;

-- name: StartEncounter :exec
UPDATE medical_records
SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1;

-- name: GetMRByEncounterNo :one
SELECT *
FROM medical_records
WHERE encounter_no = $1 AND deleted_dt IS NULL LIMIT 1;

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
WHERE medical_record_id = $1 AND deleted_dt IS NULL
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

-- name: UpsertClinicWaitAggregate :exec
INSERT INTO clinic_wait_time_aggregates (kbm_code, doctor_id, department_code, gender, age_bracket, average_wait_minutes, sample_count)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (kbm_code, doctor_id, department_code, gender, age_bracket) 
DO UPDATE SET 
    average_wait_minutes = EXCLUDED.average_wait_minutes,
    sample_count = EXCLUDED.sample_count,
    updated_at = CURRENT_TIMESTAMP;

-- name: GetClinicWaitAggregate :one
SELECT average_wait_minutes, sample_count
FROM clinic_wait_time_aggregates
WHERE kbm_code = $1 AND doctor_id = $2 AND department_code = $3 AND gender = $4 AND age_bracket = $5;

-- name: GetClinicWaitAggregateWithoutDiagnosis :one
SELECT COALESCE(AVG(average_wait_minutes), 0)::float8 AS avg_wait_minutes
FROM clinic_wait_time_aggregates
WHERE doctor_id = $1 AND department_code = $2 AND gender = $3 AND age_bracket = $4;

-- Master Data Queries
-- name: GetPolyclinics :many
SELECT * FROM polyclinics
WHERE is_active = true AND deleted_dt IS NULL AND name ILIKE '%' || $1 || '%'
ORDER BY code ASC LIMIT $2 OFFSET $3;

-- name: CountPolyclinics :one
SELECT COUNT(*) FROM polyclinics
WHERE is_active = true AND deleted_dt IS NULL AND name ILIKE '%' || $1 || '%';

-- name: GetKBMs :many
SELECT c.*, COALESCE(array_agg(m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM kbm_catalog c
LEFT JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code AND m.deleted_dt IS NULL
WHERE c.is_active = true AND c.deleted_dt IS NULL
  AND (c.kbm_name ILIKE '%' || $1 || '%' OR c.kbm_code ILIKE '%' || $2 || '%')
GROUP BY c.kbm_code
ORDER BY c.kbm_code ASC LIMIT $3 OFFSET $4;

-- name: CountKBMs :one
SELECT COUNT(*) FROM kbm_catalog
WHERE is_active = true AND deleted_dt IS NULL
  AND (kbm_name ILIKE '%' || $1 || '%' OR kbm_code ILIKE '%' || $2 || '%');

-- name: GetKBMsByPolyclinic :many
SELECT c.*, COALESCE(array_agg(m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM kbm_catalog c
JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code
LEFT JOIN kbm_polyclinic_mappings m2 ON c.kbm_code = m2.kbm_code AND m2.deleted_dt IS NULL
WHERE c.is_active = true AND c.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND c.kbm_name ILIKE '%' || $2 || '%'
  AND c.kbm_code ILIKE '%' || $3 || '%'
GROUP BY c.kbm_code
ORDER BY c.kbm_code ASC LIMIT $4 OFFSET $5;

-- name: CountKBMsByPolyclinic :one
SELECT COUNT(*) FROM kbm_catalog c
JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code
WHERE c.is_active = true AND c.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND c.kbm_name ILIKE '%' || $2 || '%'
  AND c.kbm_code ILIKE '%' || $3 || '%';

-- name: GetTindakan :many
SELECT t.*, COALESCE(array_agg(m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM master_tindakan t
LEFT JOIN tindakan_polyclinic_mappings m ON t.kode_tindakan = m.kode_tindakan AND m.deleted_dt IS NULL
WHERE t.is_active = true AND t.deleted_dt IS NULL
  AND (t.nama_tindakan ILIKE '%' || $1 || '%' OR t.kode_tindakan ILIKE '%' || $2 || '%')
GROUP BY t.kode_tindakan
ORDER BY t.kode_tindakan ASC LIMIT $3 OFFSET $4;

-- name: CountTindakan :one
SELECT COUNT(*) FROM master_tindakan
WHERE is_active = true AND deleted_dt IS NULL
  AND (nama_tindakan ILIKE '%' || $1 || '%' OR kode_tindakan ILIKE '%' || $2 || '%');

-- name: GetTindakanByPolyclinic :many
SELECT t.*, COALESCE(array_agg(m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM master_tindakan t
JOIN tindakan_polyclinic_mappings m ON t.kode_tindakan = m.kode_tindakan
LEFT JOIN tindakan_polyclinic_mappings m2 ON t.kode_tindakan = m2.kode_tindakan AND m2.deleted_dt IS NULL
WHERE t.is_active = true AND t.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND t.nama_tindakan ILIKE '%' || $2 || '%'
  AND t.kode_tindakan ILIKE '%' || $3 || '%'
GROUP BY t.kode_tindakan
ORDER BY t.kode_tindakan ASC LIMIT $4 OFFSET $5;

-- name: CountTindakanByPolyclinic :one
SELECT COUNT(*) FROM master_tindakan t
JOIN tindakan_polyclinic_mappings m ON t.kode_tindakan = m.kode_tindakan
WHERE t.is_active = true AND t.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND t.nama_tindakan ILIKE '%' || $2 || '%'
  AND t.kode_tindakan ILIKE '%' || $3 || '%';

-- name: GetICD10 :many
SELECT i.*, COALESCE(array_agg(m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM icd10_catalog i
LEFT JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code AND m.deleted_dt IS NULL
WHERE i.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $1 || '%' OR i.icd10_code ILIKE '%' || $2 || '%')
GROUP BY i.icd10_code
ORDER BY i.icd10_code ASC LIMIT $3 OFFSET $4;

-- name: CountICD10 :one
SELECT COUNT(*) FROM icd10_catalog
WHERE deleted_dt IS NULL
  AND (name ILIKE '%' || $1 || '%' OR icd10_code ILIKE '%' || $2 || '%');

-- name: GetICD10ByPolyclinic :many
SELECT i.*, COALESCE(array_agg(m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM icd10_catalog i
JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code
LEFT JOIN icd10_polyclinic_mappings m2 ON i.icd10_code = m2.icd10_code AND m2.deleted_dt IS NULL
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $2 || '%' OR i.icd10_code ILIKE '%' || $3 || '%')
GROUP BY i.icd10_code
ORDER BY i.icd10_code ASC LIMIT $4 OFFSET $5;

-- name: CountICD10ByPolyclinic :one
SELECT COUNT(*) FROM icd10_catalog i
JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND (i.name ILIKE '%' || $2 || '%' OR i.icd10_code ILIKE '%' || $3 || '%');
