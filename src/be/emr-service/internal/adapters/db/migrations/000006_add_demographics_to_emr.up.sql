ALTER TABLE medical_records
ADD COLUMN doctor_id VARCHAR(255),
ADD COLUMN department_code VARCHAR(50),
ADD COLUMN diagnosis VARCHAR(100),
ADD COLUMN gender VARCHAR(10),
ADD COLUMN age_bracket VARCHAR(20);
