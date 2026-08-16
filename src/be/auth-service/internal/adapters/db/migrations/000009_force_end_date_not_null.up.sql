-- Drop old unique indexes that rely on end_date IS NULL
DROP INDEX IF EXISTS idx_mapping_dokter_active;
DROP INDEX IF EXISTS idx_mapping_perawat_active;

-- Update existing records that have NULL end_date to a far future date to allow NOT NULL constraint
UPDATE mapping_dokter_poli SET end_date = '9999-12-31' WHERE end_date IS NULL;
UPDATE mapping_perawat_poli SET end_date = '9999-12-31' WHERE end_date IS NULL;

-- Alter column to be NOT NULL
ALTER TABLE mapping_dokter_poli ALTER COLUMN end_date SET NOT NULL;
ALTER TABLE mapping_perawat_poli ALTER COLUMN end_date SET NOT NULL;
