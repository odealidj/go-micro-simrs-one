CREATE TABLE IF NOT EXISTS polyclinics (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kbm_polyclinic_mappings (
    kbm_code VARCHAR(50) NOT NULL REFERENCES kbm_catalog(kbm_code),
    polyclinic_code VARCHAR(50) NOT NULL REFERENCES polyclinics(code),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kbm_code, polyclinic_code)
);

-- Enable pg_trgm for ICD-10 and KBM text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_kbm_catalog_name_trgm ON kbm_catalog USING GIN (kbm_name gin_trgm_ops);

-- Seed Polyclinics
INSERT INTO polyclinics (code, name) VALUES
('UMUM', 'Poliklinik Umum'),
('GIGI', 'Poliklinik Gigi'),
('KANDUNGAN', 'Poliklinik Kandungan (Obgyn)'),
('ANAK', 'Poliklinik Anak'),
('MATA', 'Poliklinik Mata')
ON CONFLICT (code) DO NOTHING;

-- Seed KBM Polyclinic Mappings (Dummy Data for existing KBMs)
-- From 000010_seed_kbm_catalog.up.sql we have: KBM-001 (Typhoid), KBM-011 (ISPA), KBM-021 (Hipertensi), KBM-031 (Diabetes)
INSERT INTO kbm_polyclinic_mappings (kbm_code, polyclinic_code) VALUES
('KBM-001', 'UMUM'),
('KBM-001', 'ANAK'),
('KBM-011', 'UMUM'),
('KBM-011', 'ANAK'),
('KBM-021', 'UMUM'),
('KBM-031', 'UMUM')
ON CONFLICT DO NOTHING;
