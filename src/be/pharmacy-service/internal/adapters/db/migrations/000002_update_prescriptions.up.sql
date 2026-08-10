-- Create prescription_items table
CREATE TABLE IF NOT EXISTS prescription_items (
    id VARCHAR(255) PRIMARY KEY,
    prescription_id VARCHAR(255) NOT NULL REFERENCES prescriptions(id),
    item_code VARCHAR(100) NOT NULL REFERENCES inventory(item_code),
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- Alter prescriptions table
ALTER TABLE prescriptions
DROP COLUMN item_code,
DROP COLUMN quantity,
DROP COLUMN amount,
ADD COLUMN is_compounded BOOLEAN DEFAULT false,
ADD COLUMN notes TEXT;

-- Insert dummy data for inventory
INSERT INTO inventory (item_code, name, stock_quantity, price) VALUES
('MED-001', 'Paracetamol 500mg', 1000, 5000.00),
('MED-002', 'Amoxicillin 500mg', 500, 15000.00),
('MED-003', 'Vitamin C 50mg', 2000, 2500.00),
('MED-004', 'Ibuprofen 400mg', 800, 8000.00),
('MED-005', 'Omeprazole 20mg', 300, 25000.00)
ON CONFLICT (item_code) DO NOTHING;
