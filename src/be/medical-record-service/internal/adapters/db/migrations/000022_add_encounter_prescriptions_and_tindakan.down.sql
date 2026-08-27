DROP TABLE IF EXISTS encounter_resep;
DROP TABLE IF EXISTS encounter_tindakan;

ALTER TABLE master_tindakan
    DROP COLUMN IF EXISTS internal_category;
