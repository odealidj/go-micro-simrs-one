CREATE INDEX IF NOT EXISTS idx_invoices_reporting ON invoices (paid_at, status) WHERE deleted_dt IS NULL;
