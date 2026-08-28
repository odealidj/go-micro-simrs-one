ALTER TABLE mapping_dokter_poli 
  DROP COLUMN IF EXISTS days_of_week,
  DROP COLUMN IF EXISTS shift_start,
  DROP COLUMN IF EXISTS shift_end;

ALTER TABLE mapping_perawat_poli 
  DROP COLUMN IF EXISTS days_of_week,
  DROP COLUMN IF EXISTS shift_start,
  DROP COLUMN IF EXISTS shift_end;
