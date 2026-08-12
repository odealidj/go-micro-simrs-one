ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS kbm_code             VARCHAR(50),
    ADD COLUMN IF NOT EXISTS kbm_name             VARCHAR(255),
    ADD COLUMN IF NOT EXISTS icd10_mapping_status VARCHAR(20) DEFAULT 'PENDING_REVIEW';
-- icd10_mapping_status values: PENDING_REVIEW | VERIFIED | MANUAL
