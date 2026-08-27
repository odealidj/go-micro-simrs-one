-- 000025_create_snomed_ct_repository.up.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS snomed_concepts (
    concept_id VARCHAR(30) PRIMARY KEY,
    fsn TEXT NOT NULL,
    term_id TEXT NOT NULL,
    semantic_tag VARCHAR(50) NOT NULL DEFAULT 'disorder',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_dt TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

CREATE INDEX IF NOT EXISTS idx_snomed_concepts_term_trgm ON snomed_concepts USING gin (term_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_snomed_concepts_fsn_trgm ON snomed_concepts USING gin (fsn gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_snomed_concepts_tag ON snomed_concepts (semantic_tag);

CREATE TABLE IF NOT EXISTS snomed_icd10_mapping (
    snomed_concept_id VARCHAR(30) NOT NULL REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE,
    icd10_code VARCHAR(20) NOT NULL REFERENCES icd10_catalog(icd10_code) ON DELETE CASCADE,
    map_group INT NOT NULL DEFAULT 1,
    map_priority INT NOT NULL DEFAULT 1,
    map_rule TEXT NOT NULL DEFAULT 'TRUE',
    map_advice TEXT NOT NULL DEFAULT 'ALWAYS',
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (snomed_concept_id, icd10_code)
);

CREATE TABLE IF NOT EXISTS snomed_icd9_mapping (
    snomed_concept_id VARCHAR(30) NOT NULL REFERENCES snomed_concepts(concept_id) ON DELETE CASCADE,
    icd9_code VARCHAR(20) NOT NULL REFERENCES icd9cm_catalog(icd9_code) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (snomed_concept_id, icd9_code)
);

ALTER TABLE encounter_diagnoses ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(30);
ALTER TABLE encounter_tindakan ADD COLUMN IF NOT EXISTS snomed_concept_id VARCHAR(30);
