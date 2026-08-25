-- 000025_create_snomed_ct_repository.down.sql
ALTER TABLE encounter_tindakan DROP COLUMN IF EXISTS snomed_concept_id;
ALTER TABLE encounter_diagnoses DROP COLUMN IF EXISTS snomed_concept_id;
DROP TABLE IF EXISTS snomed_icd9_mapping;
DROP TABLE IF EXISTS snomed_icd10_mapping;
DROP TABLE IF EXISTS snomed_concepts;
