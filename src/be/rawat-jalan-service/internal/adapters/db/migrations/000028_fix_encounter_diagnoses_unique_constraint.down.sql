DROP INDEX IF EXISTS idx_encounter_diagnoses_active_unique;
ALTER TABLE encounter_diagnoses 
    ADD CONSTRAINT encounter_diagnoses_encounter_no_icd10_code_diagnosis_type_key 
    UNIQUE (encounter_no, icd10_code, diagnosis_type);
