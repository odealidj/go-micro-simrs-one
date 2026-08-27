ALTER TABLE medical_records
ADD COLUMN blood_pressure_systolic INT,
ADD COLUMN blood_pressure_diastolic INT,
ADD COLUMN temperature NUMERIC(5,2),
ADD COLUMN heart_rate INT;

CREATE TABLE IF NOT EXISTS medical_actions (
    id VARCHAR(255) PRIMARY KEY,
    medical_record_id VARCHAR(255) NOT NULL REFERENCES medical_records(id),
    action_code VARCHAR(100) NOT NULL,
    action_name VARCHAR(255) NOT NULL,
    price NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
