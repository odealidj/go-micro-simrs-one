CREATE TABLE IF NOT EXISTS icd10_catalog (
    icd10_code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_icd10_name_trgm ON icd10_catalog USING GIN (name gin_trgm_ops);

-- Add foreign key constraint to existing mapping table if needed
-- ALTER TABLE kbm_icd10_mappings ADD CONSTRAINT fk_kbm_icd10_mappings_icd10 FOREIGN KEY (icd10_code) REFERENCES icd10_catalog(icd10_code);
