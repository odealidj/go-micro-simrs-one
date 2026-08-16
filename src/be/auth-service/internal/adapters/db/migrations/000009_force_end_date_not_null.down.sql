ALTER TABLE mapping_dokter_poli ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE mapping_perawat_poli ALTER COLUMN end_date DROP NOT NULL;

UPDATE mapping_dokter_poli SET end_date = NULL WHERE end_date = '9999-12-31';
UPDATE mapping_perawat_poli SET end_date = NULL WHERE end_date = '9999-12-31';

CREATE UNIQUE INDEX idx_mapping_dokter_active ON mapping_dokter_poli (dokter_id) WHERE end_date IS NULL AND deleted_dt IS NULL;
CREATE UNIQUE INDEX idx_mapping_perawat_active ON mapping_perawat_poli (perawat_id) WHERE end_date IS NULL AND deleted_dt IS NULL;
