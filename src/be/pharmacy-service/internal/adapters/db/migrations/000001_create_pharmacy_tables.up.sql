CREATE TABLE IF NOT EXISTS inventory (
    item_code VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
    price DECIMAL(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id VARCHAR(255) PRIMARY KEY,
    encounter_no VARCHAR(255) NOT NULL,
    item_code VARCHAR(100) NOT NULL REFERENCES inventory(item_code),
    quantity INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
