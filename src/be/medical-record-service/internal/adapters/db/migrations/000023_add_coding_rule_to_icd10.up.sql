-- Menambahkan flag untuk BPJS INA-CBG
ALTER TABLE icd10_catalog
    ADD COLUMN IF NOT EXISTS coding_rule VARCHAR(20) DEFAULT 'NORMAL'; -- 'DAGGER', 'ASTERISK', 'NORMAL'
