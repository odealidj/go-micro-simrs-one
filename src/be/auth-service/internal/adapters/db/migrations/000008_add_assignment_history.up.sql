-- Drop existing primary keys
ALTER TABLE mapping_dokter_poli DROP CONSTRAINT mapping_dokter_poli_pkey;
ALTER TABLE mapping_perawat_poli DROP CONSTRAINT mapping_perawat_poli_pkey;

-- Add surrogate UUID PK
ALTER TABLE mapping_dokter_poli ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE mapping_perawat_poli ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- Add start and end dates
ALTER TABLE mapping_dokter_poli ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE mapping_dokter_poli ADD COLUMN end_date DATE;

ALTER TABLE mapping_perawat_poli ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE mapping_perawat_poli ADD COLUMN end_date DATE;

-- Create unique indexes to enforce 1 active polyclinic rule
CREATE UNIQUE INDEX idx_mapping_dokter_active ON mapping_dokter_poli (dokter_id) WHERE end_date IS NULL AND deleted_dt IS NULL;
CREATE UNIQUE INDEX idx_mapping_perawat_active ON mapping_perawat_poli (perawat_id) WHERE end_date IS NULL AND deleted_dt IS NULL;
