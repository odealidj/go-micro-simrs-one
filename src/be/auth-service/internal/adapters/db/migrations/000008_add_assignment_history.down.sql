-- Drop unique indexes
DROP INDEX IF EXISTS idx_mapping_dokter_active;
DROP INDEX IF EXISTS idx_mapping_perawat_active;

-- Drop new columns
ALTER TABLE mapping_dokter_poli DROP COLUMN start_date;
ALTER TABLE mapping_dokter_poli DROP COLUMN end_date;
ALTER TABLE mapping_perawat_poli DROP COLUMN start_date;
ALTER TABLE mapping_perawat_poli DROP COLUMN end_date;

-- Revert surrogate PK and add back composite PK
ALTER TABLE mapping_dokter_poli DROP COLUMN id;
ALTER TABLE mapping_perawat_poli DROP COLUMN id;

ALTER TABLE mapping_dokter_poli ADD PRIMARY KEY (dokter_id, poli_code);
ALTER TABLE mapping_perawat_poli ADD PRIMARY KEY (perawat_id, poli_code);
