-- Rename diagnosis to kbm_code in clinic_wait_time_aggregates
ALTER TABLE clinic_wait_time_aggregates RENAME COLUMN diagnosis TO kbm_code;

-- Since the unique constraint was named we need to recreate it if we drop/add,
-- but PostgreSQL automatically updates constraint column references when renamed!
