CREATE TABLE encounter_payments (
    encounter_no VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20) NOT NULL, -- 'PAID', 'UNPAID'
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
