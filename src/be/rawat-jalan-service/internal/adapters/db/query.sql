-- name: CreateDraftMR :one
INSERT INTO medical_records (id, encounter_no, mrn)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddEncounterDiagnosis :one
INSERT INTO encounter_diagnoses (
    id, encounter_no, icd10_code, diagnosis_type, sequence, clinical_notes,
    severity_level, severity_set_by, severity_set_role,
    auto_kbm_code, auto_kbm_name, kbm_mapping_confidence, snomed_concept_id, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
) RETURNING *;

-- name: UpdateEncounterDiagnosis :exec
UPDATE encounter_diagnoses
SET diagnosis_type = $2,
    sequence = $3,
    clinical_notes = $4,
    severity_level = $5,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_dt IS NULL;

-- name: GetEncounterDiagnosisByID :one
SELECT * FROM encounter_diagnoses
WHERE id = $1;

-- name: RemoveEncounterDiagnosis :exec
UPDATE encounter_diagnoses
SET deleted_dt = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: ResetEncounterSeverityIfNoDiagnoses :exec
UPDATE medical_records
SET encounter_severity_level = NULL,
    severity_finalized_by = NULL,
    severity_finalized_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE medical_records.encounter_no = $1
  AND NOT EXISTS (
      SELECT 1 FROM encounter_diagnoses ed
      WHERE ed.encounter_no = medical_records.encounter_no AND ed.deleted_dt IS NULL
  );

-- name: DemotePrimaryDiagnoses :exec
UPDATE encounter_diagnoses
SET diagnosis_type = 'SECONDARY', sequence = 2, updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1 AND diagnosis_type = 'PRIMARY' AND deleted_dt IS NULL;

-- name: PromoteDiagnosisToPrimary :exec
UPDATE encounter_diagnoses
SET diagnosis_type = 'PRIMARY', sequence = 1, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_dt IS NULL;

-- name: FinalizeSeverity :exec
UPDATE medical_records
SET encounter_severity_level = $2,
    severity_finalized_by = $3,
    severity_finalized_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1;

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
SELECT d.*, i.name_id as icd10_name, s.term_id as snomed_name, s.fsn as snomed_fsn
FROM encounter_diagnoses d
JOIN icd10_catalog i ON d.icd10_code = i.icd10_code
LEFT JOIN snomed_concepts s ON d.snomed_concept_id = s.concept_id
WHERE d.encounter_no = $1 AND d.deleted_dt IS NULL
ORDER BY CASE WHEN d.diagnosis_type = 'PRIMARY' THEN 0 ELSE 1 END, d.sequence ASC, d.created_at ASC;

-- name: StartEncounter :exec
UPDATE medical_records
SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1;

-- name: GetMRByEncounterNo :one
SELECT *
FROM medical_records
WHERE encounter_no = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: UpsertTriage :one
INSERT INTO medical_records (
    id, encounter_no, mrn,
    blood_pressure_systolic, blood_pressure_diastolic, temperature, heart_rate,
    respiratory_rate, oxygen_saturation, height, weight, bmi, allergies, notes,
    status, started_at, updated_at
) VALUES (
    $1, $2, $3,
    $4, $5, $6, $7,
    $8, $9, $10, $11, $12, $13, $14,
    'IN_PROGRESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (encounter_no) DO UPDATE SET
    blood_pressure_systolic = COALESCE(EXCLUDED.blood_pressure_systolic, medical_records.blood_pressure_systolic),
    blood_pressure_diastolic = COALESCE(EXCLUDED.blood_pressure_diastolic, medical_records.blood_pressure_diastolic),
    temperature = COALESCE(EXCLUDED.temperature, medical_records.temperature),
    heart_rate = COALESCE(EXCLUDED.heart_rate, medical_records.heart_rate),
    respiratory_rate = COALESCE(EXCLUDED.respiratory_rate, medical_records.respiratory_rate),
    oxygen_saturation = COALESCE(EXCLUDED.oxygen_saturation, medical_records.oxygen_saturation),
    height = COALESCE(EXCLUDED.height, medical_records.height),
    weight = COALESCE(EXCLUDED.weight, medical_records.weight),
    bmi = COALESCE(EXCLUDED.bmi, medical_records.bmi),
    allergies = COALESCE(EXCLUDED.allergies, medical_records.allergies),
    notes = COALESCE(EXCLUDED.notes, medical_records.notes),
    status = CASE 
        WHEN medical_records.status IN ('COMPLETED', 'BATAL', 'CANCELLED') THEN medical_records.status 
        ELSE 'IN_PROGRESS' 
    END,
    started_at = COALESCE(medical_records.started_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
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

-- name: RemoveMedicalAction :exec
UPDATE medical_actions
SET deleted_dt = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_dt IS NULL;

-- name: GetMedicalActionByID :one
SELECT ma.*, mr.encounter_no
FROM medical_actions ma
JOIN medical_records mr ON ma.medical_record_id = mr.id
WHERE ma.id = $1 AND ma.deleted_dt IS NULL;

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
SELECT c.*, 
       COALESCE(array_agg(DISTINCT m.polyclinic_code) FILTER (WHERE m.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT k.icd10_code)::int AS icd10_count
FROM kbm_catalog c
LEFT JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code AND m.deleted_dt IS NULL
LEFT JOIN kbm_icd10_mappings k ON c.kbm_code = k.kbm_code
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
SELECT c.*, 
       COALESCE(array_agg(DISTINCT m2.polyclinic_code) FILTER (WHERE m2.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics,
       COUNT(DISTINCT k.icd10_code)::int AS icd10_count
FROM kbm_catalog c
JOIN kbm_polyclinic_mappings m ON c.kbm_code = m.kbm_code
LEFT JOIN kbm_polyclinic_mappings m2 ON c.kbm_code = m2.kbm_code AND m2.deleted_dt IS NULL
LEFT JOIN kbm_icd10_mappings k ON c.kbm_code = k.kbm_code
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
       COUNT(DISTINCT k.kbm_code)::int AS kbm_count,
       COUNT(DISTINCT s.snomed_concept_id)::int AS snomed_count
FROM icd10_catalog i
LEFT JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code AND m.deleted_dt IS NULL
LEFT JOIN kbm_icd10_mappings k ON i.icd10_code = k.icd10_code
LEFT JOIN snomed_icd10_mapping s ON i.icd10_code = s.icd10_code
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
       COUNT(DISTINCT k.kbm_code)::int AS kbm_count,
       COUNT(DISTINCT s.snomed_concept_id)::int AS snomed_count
FROM icd10_catalog i
JOIN icd10_polyclinic_mappings m ON i.icd10_code = m.icd10_code
LEFT JOIN icd10_polyclinic_mappings m2 ON i.icd10_code = m2.icd10_code AND m2.deleted_dt IS NULL
LEFT JOIN kbm_icd10_mappings k ON i.icd10_code = k.icd10_code
LEFT JOIN snomed_icd10_mapping s ON i.icd10_code = s.icd10_code
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
SELECT i.*,
       COUNT(DISTINCT s.snomed_concept_id)::int AS snomed_count,
       COUNT(DISTINCT t.kode_tindakan)::int AS tindakan_count,
       COALESCE(array_agg(DISTINCT p.polyclinic_code) FILTER (WHERE p.polyclinic_code IS NOT NULL), '{}')::varchar[] AS polyclinics
FROM icd9cm_catalog i
LEFT JOIN snomed_icd9_mapping s ON i.icd9_code = s.icd9_code
LEFT JOIN tindakan_icd9_mapping t ON i.icd9_code = t.icd9_code
LEFT JOIN tindakan_polyclinic_mappings p ON t.kode_tindakan = p.kode_tindakan AND p.deleted_dt IS NULL
WHERE i.deleted_dt IS NULL
  AND ($1::text IS NULL OR $1::text = '' OR i.name_en ILIKE '%' || $1 || '%' OR i.name_id ILIKE '%' || $1 || '%' OR i.icd9_code ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR $2::text = '' OR i.icd9_code ILIKE '%' || $2 || '%')
GROUP BY i.icd9_code
ORDER BY i.icd9_code ASC LIMIT $3 OFFSET $4;

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

-- name: GetICD10SuggestionsForKBM :many
SELECT i.icd10_code, i.name_id, i.name_en, i.chapter_code, i.block_code, m.is_primary, m.mapping_confidence
FROM icd10_catalog i
JOIN kbm_icd10_mappings m ON i.icd10_code = m.icd10_code
WHERE m.kbm_code = $1 AND i.is_active = true AND i.deleted_dt IS NULL
ORDER BY m.is_primary DESC, m.mapping_confidence DESC;

-- name: GetSNOMEDForICD10 :many
SELECT s.concept_id, s.fsn, s.term_id, s.semantic_tag, s.is_active, m.is_primary, m.map_advice
FROM snomed_concepts s
JOIN snomed_icd10_mapping m ON s.concept_id = m.snomed_concept_id
WHERE m.icd10_code = $1 AND s.is_active = true AND s.deleted_dt IS NULL
ORDER BY m.is_primary DESC;

-- name: GetSNOMEDForICD9 :many
SELECT s.concept_id, s.fsn, s.term_id, s.semantic_tag, s.is_active, m.is_primary
FROM snomed_concepts s
JOIN snomed_icd9_mapping m ON s.concept_id = m.snomed_concept_id
WHERE m.icd9_code = $1 AND s.is_active = true AND s.deleted_dt IS NULL
ORDER BY m.is_primary DESC;

-- name: GetTindakanForICD9 :many
SELECT t.kode_tindakan, t.nama_tindakan, t.base_price, m.is_primary
FROM master_tindakan t
JOIN tindakan_icd9_mapping m ON t.kode_tindakan = m.kode_tindakan
WHERE m.icd9_code = $1 AND t.is_active = true AND t.deleted_dt IS NULL
ORDER BY m.is_primary DESC;

-- name: GetPolyclinicsForICD9 :many
SELECT DISTINCT p.code, p.name
FROM polyclinics p
JOIN tindakan_polyclinic_mappings m ON p.code = m.polyclinic_code
JOIN tindakan_icd9_mapping map ON m.kode_tindakan = map.kode_tindakan
WHERE map.icd9_code = $1 AND p.deleted_dt IS NULL AND m.deleted_dt IS NULL
ORDER BY p.code ASC;

-- name: GetPolyclinicsForICD10 :many
SELECT p.code, p.name
FROM polyclinics p
JOIN icd10_polyclinic_mappings m ON p.code = m.polyclinic_code
WHERE m.icd10_code = $1 AND p.deleted_dt IS NULL AND m.deleted_dt IS NULL
ORDER BY p.code ASC;

-- name: GetPolyclinicsForTindakan :many
SELECT p.code, p.name
FROM polyclinics p
JOIN tindakan_polyclinic_mappings m ON p.code = m.polyclinic_code
WHERE m.kode_tindakan = $1 AND p.deleted_dt IS NULL AND m.deleted_dt IS NULL
ORDER BY p.code ASC;

-- name: GetPolyclinicsForKBM :many
SELECT p.code, p.name
FROM polyclinics p
JOIN kbm_polyclinic_mappings m ON p.code = m.polyclinic_code
WHERE m.kbm_code = $1 AND p.deleted_dt IS NULL AND m.deleted_dt IS NULL
ORDER BY p.code ASC;


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

-- name: UpsertICD10Replica :exec
INSERT INTO icd10_catalog (icd10_code, name_en, name_id, chapter_code, block_code, is_active, coding_rule, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
ON CONFLICT (icd10_code) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_id = EXCLUDED.name_id,
    chapter_code = EXCLUDED.chapter_code,
    block_code = EXCLUDED.block_code,
    is_active = EXCLUDED.is_active,
    coding_rule = EXCLUDED.coding_rule,
    updated_at = CURRENT_TIMESTAMP;

-- name: SoftDeleteICD10Replica :exec
UPDATE icd10_catalog SET deleted_dt = CURRENT_TIMESTAMP WHERE icd10_code = $1;

-- name: UpsertKBMReplica :exec
INSERT INTO kbm_catalog (kbm_code, kbm_name, description, body_system, is_active, updated_at)
VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
ON CONFLICT (kbm_code) DO UPDATE
SET kbm_name = EXCLUDED.kbm_name,
    description = EXCLUDED.description,
    body_system = EXCLUDED.body_system,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- name: SoftDeleteKBMReplica :exec
UPDATE kbm_catalog SET deleted_dt = CURRENT_TIMESTAMP WHERE kbm_code = $1;

-- name: UpsertTindakanReplica :exec
INSERT INTO master_tindakan (kode_tindakan, nama_tindakan, base_price, is_active, internal_category, updated_at)
VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
ON CONFLICT (kode_tindakan) DO UPDATE
SET nama_tindakan = EXCLUDED.nama_tindakan,
    base_price = EXCLUDED.base_price,
    is_active = EXCLUDED.is_active,
    internal_category = EXCLUDED.internal_category,
    updated_at = CURRENT_TIMESTAMP;

-- name: SoftDeleteTindakanReplica :exec
UPDATE master_tindakan SET deleted_dt = CURRENT_TIMESTAMP WHERE kode_tindakan = $1;
