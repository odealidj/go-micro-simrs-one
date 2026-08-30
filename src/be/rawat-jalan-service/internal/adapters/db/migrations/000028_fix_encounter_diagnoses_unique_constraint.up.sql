-- Drop the unconditional table-level UNIQUE constraint that conflicts with soft-deleted rows
ALTER TABLE encounter_diagnoses 
    DROP CONSTRAINT IF EXISTS encounter_diagnoses_encounter_no_icd10_code_diagnosis_type_key;

-- Create partial unique index that only enforces uniqueness among active (non-deleted) diagnoses
DROP INDEX IF EXISTS idx_encounter_diagnoses_active_unique;
CREATE UNIQUE INDEX idx_encounter_diagnoses_active_unique 
    ON encounter_diagnoses (encounter_no, icd10_code, diagnosis_type) 
    WHERE deleted_dt IS NULL;
