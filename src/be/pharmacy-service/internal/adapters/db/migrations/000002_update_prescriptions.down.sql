ALTER TABLE prescriptions
DROP COLUMN is_compounded,
DROP COLUMN notes,
ADD COLUMN item_code VARCHAR(100),
ADD COLUMN quantity INT,
ADD COLUMN amount DECIMAL(10, 2);

DROP TABLE IF EXISTS prescription_items;

-- Note: We do not delete the dummy inventory data in the down migration to prevent accidental data loss.
