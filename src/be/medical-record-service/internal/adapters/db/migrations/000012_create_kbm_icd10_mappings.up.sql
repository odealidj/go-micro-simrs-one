CREATE TABLE kbm_icd10_mappings (
    kbm_code VARCHAR(50) NOT NULL REFERENCES kbm_catalog(kbm_code),
    icd10_code VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kbm_code, icd10_code)
);

-- Seed data for some common ones
INSERT INTO kbm_icd10_mappings (kbm_code, icd10_code, is_primary) VALUES
('KBM-001', 'A01.0', true),
('KBM-011', 'J06.9', true),
('KBM-011', 'J00', false),
('KBM-021', 'I10', true),
('KBM-031', 'E11.9', true),
('KBM-031', 'E11.8', false);
