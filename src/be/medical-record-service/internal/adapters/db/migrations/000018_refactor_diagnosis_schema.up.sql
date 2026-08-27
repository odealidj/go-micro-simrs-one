-- Hapus kolom lama dari medical_records
ALTER TABLE medical_records 
    DROP COLUMN IF EXISTS icd10_codes,
    DROP COLUMN IF EXISTS kbm_code,
    DROP COLUMN IF EXISTS kbm_name,
    DROP COLUMN IF EXISTS icd10_mapping_status;

-- Tambah severity_level pada medical_records (encounter level)
ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS encounter_severity_level VARCHAR(10) DEFAULT 'RINGAN',
    ADD COLUMN IF NOT EXISTS severity_finalized_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS severity_finalized_at TIMESTAMP WITH TIME ZONE;

-- Pastikan FK di kbm_icd10_mappings aktif
ALTER TABLE kbm_icd10_mappings
    ADD COLUMN IF NOT EXISTS mapping_confidence VARCHAR(10) DEFAULT 'HIGH';

-- Hapus constraint lama jika ada dan buat yang baru
ALTER TABLE kbm_icd10_mappings DROP CONSTRAINT IF EXISTS fk_kbm_icd10_mappings_icd10;
ALTER TABLE kbm_icd10_mappings
    ADD CONSTRAINT fk_kbm_icd10_mappings_icd10 FOREIGN KEY (icd10_code) REFERENCES icd10_catalog(icd10_code) ON DELETE CASCADE;

-- Buat tabel encounter_diagnoses
CREATE TABLE IF NOT EXISTS encounter_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_no VARCHAR(255) NOT NULL REFERENCES medical_records(encounter_no) ON DELETE CASCADE,
    icd10_code VARCHAR(20) NOT NULL REFERENCES icd10_catalog(icd10_code),
    diagnosis_type VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    sequence INT NOT NULL DEFAULT 1,
    clinical_notes TEXT,
    severity_level VARCHAR(10) NOT NULL DEFAULT 'RINGAN',
    severity_set_by VARCHAR(100),
    severity_set_role VARCHAR(20),
    auto_kbm_code VARCHAR(50) REFERENCES kbm_catalog(kbm_code),
    auto_kbm_name VARCHAR(255),
    kbm_mapping_confidence VARCHAR(10),
    is_verified_by_rm BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_dt TIMESTAMP WITH TIME ZONE,
    UNIQUE (encounter_no, icd10_code, diagnosis_type)
);

CREATE INDEX IF NOT EXISTS idx_enc_diag_encounter ON encounter_diagnoses (encounter_no);
CREATE INDEX IF NOT EXISTS idx_enc_diag_type      ON encounter_diagnoses (encounter_no, diagnosis_type);
CREATE INDEX IF NOT EXISTS idx_enc_diag_severity  ON encounter_diagnoses (encounter_no, severity_level);
