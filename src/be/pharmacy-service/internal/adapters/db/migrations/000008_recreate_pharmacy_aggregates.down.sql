DROP TABLE IF EXISTS pharmacy_wait_time_aggregates;

CREATE TABLE pharmacy_wait_time_aggregates (
    id SERIAL PRIMARY KEY,
    pharmacy_type VARCHAR(20) NOT NULL,
    average_wait_minutes INT NOT NULL,
    sample_count INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pharmacy_type)
);
