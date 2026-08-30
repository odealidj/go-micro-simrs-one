CREATE INDEX IF NOT EXISTS idx_encounters_reporting ON encounters (created_at, status) WHERE deleted_dt IS NULL;
