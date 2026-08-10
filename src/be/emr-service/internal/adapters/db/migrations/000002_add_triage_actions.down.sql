DROP TABLE IF EXISTS medical_actions;

ALTER TABLE medical_records
DROP COLUMN IF EXISTS blood_pressure_systolic,
DROP COLUMN IF EXISTS blood_pressure_diastolic,
DROP COLUMN IF EXISTS temperature,
DROP COLUMN IF EXISTS heart_rate;
