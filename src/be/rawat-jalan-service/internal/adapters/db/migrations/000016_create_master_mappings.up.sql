CREATE TABLE IF NOT EXISTS tindakan_polyclinic_mappings (
    kode_tindakan VARCHAR(50) NOT NULL REFERENCES master_tindakan(kode_tindakan) ON DELETE CASCADE,
    polyclinic_code VARCHAR(50) NOT NULL REFERENCES polyclinics(code) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kode_tindakan, polyclinic_code)
);

CREATE TABLE IF NOT EXISTS icd10_polyclinic_mappings (
    icd10_code VARCHAR(20) NOT NULL REFERENCES icd10_catalog(icd10_code) ON DELETE CASCADE,
    polyclinic_code VARCHAR(50) NOT NULL REFERENCES polyclinics(code) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (icd10_code, polyclinic_code)
);
