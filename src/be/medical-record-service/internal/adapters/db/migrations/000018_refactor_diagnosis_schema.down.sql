DROP TABLE IF EXISTS encounter_diagnoses;

ALTER TABLE kbm_icd10_mappings 
    DROP CONSTRAINT IF EXISTS fk_kbm_icd10_mappings_icd10,
    DROP COLUMN IF EXISTS mapping_confidence;

ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS icd10_codes TEXT[],
    ADD COLUMN IF NOT EXISTS kbm_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS kbm_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS icd10_mapping_status VARCHAR(20) DEFAULT 'PENDING_REVIEW',
    DROP COLUMN IF EXISTS encounter_severity_level,
    DROP COLUMN IF EXISTS severity_finalized_by,
    DROP COLUMN IF EXISTS severity_finalized_at;
