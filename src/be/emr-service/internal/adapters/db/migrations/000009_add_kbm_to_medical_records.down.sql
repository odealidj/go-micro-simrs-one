ALTER TABLE medical_records
    DROP COLUMN IF EXISTS kbm_code,
    DROP COLUMN IF EXISTS kbm_name,
    DROP COLUMN IF EXISTS icd10_mapping_status;
