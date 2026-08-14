CREATE TABLE IF NOT EXISTS inventory_polyclinic_mappings (
    item_code VARCHAR(100) NOT NULL REFERENCES inventory(item_code) ON DELETE CASCADE,
    polyclinic_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_code, polyclinic_code)
);
