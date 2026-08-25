-- name: CreateDraftMR :one
INSERT INTO medical_records (id, encounter_no, mrn)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddEncounterDiagnosis :one
INSERT INTO encounter_diagnoses (
    id, encounter_no, icd10_code, diagnosis_type, sequence, clinical_notes,
    severity_level, severity_set_by, severity_set_role,
    auto_kbm_code, auto_kbm_name, kbm_mapping_confidence, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) RETURNING *;

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

-- name: SearchICD10 :many
SELECT i.*, COALESCE(array_agg(m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM icd10_catalog i
LEFT JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code AND m.deleted_dt IS NULL
WHERE i.deleted_dt IS NULL
  AND (i.name_en ILIKE '%' || $1 || '%' OR i.name_id ILIKE '%' || $1 || '%' OR i.icd10_code ILIKE '%' || $2 || '%')
GROUP BY i.icd10_code
ORDER BY i.icd10_code ASC LIMIT $3 OFFSET $4;

-- name: GetKBMSuggestionsForICD10 :many
SELECT k.*, m.is_primary, m.mapping_confidence
FROM kbm_catalog k
JOIN kbm_icd10_mappings m ON k.kbm_code = m.kbm_code
WHERE m.icd10_code = $1 AND k.is_active = true AND k.deleted_dt IS NULL
ORDER BY m.is_primary DESC, m.mapping_confidence ASC;

-- name: GetEncounterDiagnoses :many
SELECT d.*, i.name_id as icd10_name
FROM encounter_diagnoses d
JOIN icd10_catalog i ON d.icd10_code = i.icd10_code
WHERE d.encounter_no = $1 AND d.deleted_dt IS NULL
ORDER BY d.sequence ASC, d.created_at ASC;

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
WHERE is_active = true AND deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR name ILIKE '%' || $1 || '%' OR code ILIKE '%' || $1 || '%')
ORDER BY code ASC LIMIT $2 OFFSET $3;

-- name: CountPolyclinics :one
SELECT COUNT(*) FROM polyclinics
WHERE is_active = true AND deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR name ILIKE '%' || $1 || '%' OR code ILIKE '%' || $1 || '%');

-- name: GetKBMs :many
SELECT c.*, COALESCE(array_agg(m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM kbm_catalog c
LEFT JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code AND m.deleted_dt IS NULL
WHERE c.is_active = true AND c.deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR c.kbm_name ILIKE '%' || $1 || '%' OR c.kbm_code ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR c.kbm_code ILIKE '%' || $2 || '%')
GROUP BY c.kbm_code
ORDER BY c.kbm_code ASC LIMIT $3 OFFSET $4;

-- name: CountKBMs :one
SELECT COUNT(*) FROM kbm_catalog
WHERE is_active = true AND deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR kbm_name ILIKE '%' || $1 || '%' OR kbm_code ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR kbm_code ILIKE '%' || $2 || '%');

-- name: GetKBMsByPolyclinic :many
SELECT c.*, COALESCE(array_agg(m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM kbm_catalog c
JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code
LEFT JOIN kbm_polyclinic_mappings m2 ON c.kbm_code = m2.kbm_code AND m2.deleted_dt IS NULL
WHERE c.is_active = true AND c.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND ($2::text IS NULL OR $2::text = '' OR c.kbm_name ILIKE '%' || $2 || '%' OR c.kbm_code ILIKE '%' || $2 || '%')
  AND ($3::text IS NULL OR $3::text = '' OR c.kbm_code ILIKE '%' || $3 || '%')
GROUP BY c.kbm_code
ORDER BY c.kbm_code ASC LIMIT $4 OFFSET $5;

-- name: CountKBMsByPolyclinic :one
SELECT COUNT(*) FROM kbm_catalog c
JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code
WHERE c.is_active = true AND c.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND ($2::text IS NULL OR $2::text = '' OR c.kbm_name ILIKE '%' || $2 || '%' OR c.kbm_code ILIKE '%' || $2 || '%')
  AND ($3::text IS NULL OR $3::text = '' OR c.kbm_code ILIKE '%' || $3 || '%');

-- name: GetTindakan :many
SELECT t.*, 
       COALESCE(array_agg(DISTINCT m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT map.icd9_code)::int AS icd9_count
FROM master_tindakan t
LEFT JOIN tindakan_polyclinic_mappings m ON t.kode_tindakan = m.kode_tindakan AND m.deleted_dt IS NULL
LEFT JOIN tindakan_icd9_mapping map ON t.kode_tindakan = map.kode_tindakan
WHERE t.is_active = true AND t.deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR t.nama_tindakan ILIKE '%' || $1 || '%' OR t.kode_tindakan ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR t.kode_tindakan ILIKE '%' || $2 || '%')
GROUP BY t.kode_tindakan
ORDER BY t.kode_tindakan ASC LIMIT $3 OFFSET $4;

-- name: CountTindakan :one
SELECT COUNT(*) FROM master_tindakan
WHERE is_active = true AND deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR nama_tindakan ILIKE '%' || $1 || '%' OR kode_tindakan ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR kode_tindakan ILIKE '%' || $2 || '%');

-- name: GetTindakanByPolyclinic :many
SELECT t.*, 
       COALESCE(array_agg(DISTINCT m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT map.icd9_code)::int AS icd9_count
FROM master_tindakan t
JOIN tindakan_polyclinic_mappings m ON t.kode_tindakan = m.kode_tindakan
LEFT JOIN tindakan_polyclinic_mappings m2 ON t.kode_tindakan = m2.kode_tindakan AND m2.deleted_dt IS NULL
LEFT JOIN tindakan_icd9_mapping map ON t.kode_tindakan = map.kode_tindakan
WHERE t.is_active = true AND t.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND ($2::text IS NULL OR $2::text = '' OR t.nama_tindakan ILIKE '%' || $2 || '%' OR t.kode_tindakan ILIKE '%' || $2 || '%')
  AND ($3::text IS NULL OR $3::text = '' OR t.kode_tindakan ILIKE '%' || $3 || '%')
GROUP BY t.kode_tindakan
ORDER BY t.kode_tindakan ASC LIMIT $4 OFFSET $5;

-- name: CountTindakanByPolyclinic :one
SELECT COUNT(*) FROM master_tindakan t
JOIN tindakan_polyclinic_mappings m ON t.kode_tindakan = m.kode_tindakan
WHERE t.is_active = true AND t.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND m.polyclinic_code = $1
  AND ($2::text IS NULL OR $2::text = '' OR t.nama_tindakan ILIKE '%' || $2 || '%' OR t.kode_tindakan ILIKE '%' || $2 || '%')
  AND ($3::text IS NULL OR $3::text = '' OR t.kode_tindakan ILIKE '%' || $3 || '%');

-- name: GetICD10 :many
SELECT i.*, 
       COALESCE(array_agg(DISTINCT m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT k.kbm_code)::int AS kbm_count
FROM icd10_catalog i
LEFT JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code AND m.deleted_dt IS NULL
LEFT JOIN kbm_icd10_mappings k ON i.icd10_code = k.icd10_code
WHERE i.deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR i.name_en ILIKE '%' || $1 || '%' OR i.name_id ILIKE '%' || $1 || '%' OR i.icd10_code ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR i.icd10_code ILIKE '%' || $2 || '%')
GROUP BY i.icd10_code
ORDER BY i.icd10_code ASC LIMIT $3 OFFSET $4;

-- name: CountICD10 :one
SELECT COUNT(*) FROM icd10_catalog
WHERE deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR name_en ILIKE '%' || $1 || '%' OR name_id ILIKE '%' || $1 || '%' OR icd10_code ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR icd10_code ILIKE '%' || $2 || '%');

-- name: GetICD10ByPolyclinic :many
SELECT i.*, 
       COALESCE(array_agg(DISTINCT m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT k.kbm_code)::int AS kbm_count
FROM icd10_catalog i
JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code
LEFT JOIN icd10_polyclinic_mappings m2 ON i.icd10_code = m2.icd10_code AND m2.deleted_dt IS NULL
LEFT JOIN kbm_icd10_mappings k ON i.icd10_code = k.icd10_code
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND ($2::text IS NULL OR $2::text = '' OR i.name_en ILIKE '%' || $2 || '%' OR i.name_id ILIKE '%' || $2 || '%' OR i.icd10_code ILIKE '%' || $2 || '%')
  AND ($3::text IS NULL OR $3::text = '' OR i.icd10_code ILIKE '%' || $3 || '%')
GROUP BY i.icd10_code
ORDER BY i.icd10_code ASC LIMIT $4 OFFSET $5;

-- name: CountICD10ByPolyclinic :one
SELECT COUNT(*) FROM icd10_catalog i
JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code
WHERE m.polyclinic_code = $1 AND i.deleted_dt IS NULL AND m.deleted_dt IS NULL
  AND ($2::text IS NULL OR $2::text = '' OR i.name_en ILIKE '%' || $2 || '%' OR i.name_id ILIKE '%' || $2 || '%' OR i.icd10_code ILIKE '%' || $2 || '%')
  AND ($3::text IS NULL OR $3::text = '' OR i.icd10_code ILIKE '%' || $3 || '%');

-- name: GetICD9 :many
SELECT * FROM icd9cm_catalog
WHERE deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR name_en ILIKE '%' || $1 || '%' OR name_id ILIKE '%' || $1 || '%' OR icd9_code ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR icd9_code ILIKE '%' || $2 || '%')
ORDER BY icd9_code ASC LIMIT $3 OFFSET $4;

-- name: CountICD9 :one
SELECT COUNT(*) FROM icd9cm_catalog
WHERE deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR name_en ILIKE '%' || $1 || '%' OR name_id ILIKE '%' || $1 || '%' OR icd9_code ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR icd9_code ILIKE '%' || $2 || '%');

-- name: GetICD9SuggestionsForTindakan :many
SELECT i.*, m.is_primary 
FROM icd9cm_catalog i
JOIN tindakan_icd9_mapping m ON i.icd9_code = m.icd9_code
WHERE m.kode_tindakan = $1 AND i.deleted_dt IS NULL
ORDER BY m.is_primary DESC, i.icd9_code ASC;


-- name: GetEncounterTindakan :many
SELECT t.*, m.nama_tindakan, m.internal_category
FROM encounter_tindakan t
JOIN master_tindakan m ON t.kode_tindakan = m.kode_tindakan
WHERE t.encounter_no = $1 AND t.deleted_dt IS NULL
ORDER BY t.created_at ASC;

-- name: GetEncounterResep :many
SELECT *
FROM encounter_resep
WHERE encounter_no = $1 AND deleted_dt IS NULL
ORDER BY created_at ASC;

-- name: CheckKarcisUnpaid :one
SELECT COUNT(*) > 0 AS has_unpaid_karcis
FROM encounter_tindakan t
JOIN master_tindakan m ON t.kode_tindakan = m.kode_tindakan
WHERE t.encounter_no = $1 AND t.deleted_dt IS NULL 
  AND m.internal_category = 'KARCIS' AND t.payment_status = 'UNPAID';

-- name: CheckKarcisPaid :one
SELECT COUNT(*) > 0 AS has_paid_karcis
FROM encounter_tindakan t
JOIN master_tindakan m ON t.kode_tindakan = m.kode_tindakan
WHERE t.encounter_no = $1 AND t.deleted_dt IS NULL 
  AND m.internal_category = 'KARCIS' AND t.payment_status = 'PAID';

-- name: AddEncounterTindakan :one
INSERT INTO encounter_tindakan (
    id, encounter_no, kode_tindakan, qty, price, total, payment_status, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;

-- name: AddEncounterResep :one
INSERT INTO encounter_resep (
    id, encounter_no, obat_id, obat_name, qty, dosis, instruksi, status, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetSNOMEDConcepts :many
SELECT c.*,
       COUNT(DISTINCT m10.icd10_code)::int AS icd10_count,
       COUNT(DISTINCT m9.icd9_code)::int AS icd9_count
FROM snomed_concepts c
LEFT JOIN snomed_icd10_mapping m10 ON c.concept_id = m10.snomed_concept_id
LEFT JOIN snomed_icd9_mapping m9 ON c.concept_id = m9.snomed_concept_id
WHERE c.deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR c.term_id ILIKE '%' || $1 || '%' OR c.fsn ILIKE '%' || $1 || '%' OR c.concept_id ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR c.semantic_tag = $2)
GROUP BY c.concept_id
ORDER BY c.concept_id ASC LIMIT $3 OFFSET $4;

-- name: CountSNOMEDConcepts :one
SELECT COUNT(*) FROM snomed_concepts
WHERE deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR term_id ILIKE '%' || $1 || '%' OR fsn ILIKE '%' || $1 || '%' OR concept_id ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR semantic_tag = $2);

-- name: GetSNOMEDICD10Mappings :many
SELECT m.*, i.name_id AS icd10_name_id, i.name_en AS icd10_name_en, i.chapter_code, i.block_code
FROM snomed_icd10_mapping m
JOIN icd10_catalog i ON m.icd10_code = i.icd10_code
WHERE m.snomed_concept_id = $1
ORDER BY m.is_primary DESC, m.map_priority ASC;

-- name: GetSNOMEDICD9Mappings :many
SELECT m.*, i.name_id AS icd9_name_id, i.name_en AS icd9_name_en, i.category
FROM snomed_icd9_mapping m
JOIN icd9cm_catalog i ON m.icd9_code = i.icd9_code
WHERE m.snomed_concept_id = $1
ORDER BY m.is_primary DESC;
