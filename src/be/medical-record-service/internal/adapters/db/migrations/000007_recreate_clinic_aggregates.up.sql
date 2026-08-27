DROP TABLE IF EXISTS clinic_wait_time_aggregates;

CREATE TABLE clinic_wait_time_aggregates (
    id SERIAL PRIMARY KEY,
    diagnosis VARCHAR(100) NOT NULL,
    doctor_id VARCHAR(255) NOT NULL,
    department_code VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    age_bracket VARCHAR(20) NOT NULL,
    average_wait_minutes INT NOT NULL,
    sample_count INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(diagnosis, doctor_id, department_code, gender, age_bracket)
);
