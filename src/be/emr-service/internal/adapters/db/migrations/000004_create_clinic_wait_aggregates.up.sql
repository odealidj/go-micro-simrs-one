CREATE TABLE IF NOT EXISTS clinic_wait_time_aggregates (
    id SERIAL PRIMARY KEY,
    department_code VARCHAR(20) NOT NULL,
    age_bracket VARCHAR(20) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    average_wait_minutes INT NOT NULL,
    sample_count INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_code, age_bracket, gender)
);
