-- Drop existing table
DROP TABLE IF EXISTS icd10_catalog CASCADE;

CREATE TABLE icd10_catalog (
    icd10_code VARCHAR(20) PRIMARY KEY,
    name_en VARCHAR(255) NOT NULL,
    name_id VARCHAR(255) NOT NULL,
    chapter_code VARCHAR(10),
    block_code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_dt TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_icd10_name_en_trgm ON icd10_catalog USING GIN (name_en gin_trgm_ops);
CREATE INDEX idx_icd10_name_id_trgm ON icd10_catalog USING GIN (name_id gin_trgm_ops);
CREATE INDEX idx_icd10_chapter ON icd10_catalog(chapter_code);
CREATE INDEX idx_icd10_block ON icd10_catalog(block_code);
