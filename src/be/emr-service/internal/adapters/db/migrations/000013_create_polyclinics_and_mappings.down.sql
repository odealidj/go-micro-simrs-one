DROP INDEX IF EXISTS idx_kbm_catalog_name_trgm;
DROP EXTENSION IF EXISTS pg_trgm;

DROP TABLE IF EXISTS kbm_polyclinic_mappings;
DROP TABLE IF EXISTS polyclinics;
