CREATE TABLE IF NOT EXISTS icd9cm_catalog (
    icd9_code VARCHAR(20) PRIMARY KEY,
    name_en VARCHAR(255) NOT NULL,
    name_id VARCHAR(255),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_dt TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_icd9_name_en_trgm ON icd9cm_catalog USING GIN (name_en gin_trgm_ops);

CREATE TABLE IF NOT EXISTS tindakan_icd9_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_tindakan VARCHAR(50) NOT NULL REFERENCES master_tindakan(kode_tindakan) ON DELETE CASCADE,
    icd9_code VARCHAR(20) NOT NULL REFERENCES icd9cm_catalog(icd9_code) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kode_tindakan, icd9_code)
);

CREATE INDEX idx_tindakan_icd9 ON tindakan_icd9_mapping(kode_tindakan);
