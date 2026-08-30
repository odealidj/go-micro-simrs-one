ALTER TABLE invoices DROP CONSTRAINT IF EXISTS fk_invoices_status;
DROP TABLE IF EXISTS master_payment_methods;
DROP TABLE IF EXISTS master_invoice_status;
