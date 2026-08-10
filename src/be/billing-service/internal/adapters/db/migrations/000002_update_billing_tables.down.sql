DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS invoice_items;

ALTER TABLE invoices DROP COLUMN IF EXISTS paid_at;
ALTER TABLE invoices RENAME COLUMN total_amount TO amount;
ALTER TABLE invoices ADD COLUMN related_id VARCHAR(255) NOT NULL DEFAULT '';
