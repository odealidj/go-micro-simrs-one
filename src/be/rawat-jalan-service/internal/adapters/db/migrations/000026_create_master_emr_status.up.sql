-- 1. Buat tabel master status EMR Rawat Jalan
CREATE TABLE IF NOT EXISTS master_emr_status (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_terminal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seeding status resmi EMR
INSERT INTO master_emr_status (code, name, description, is_terminal) VALUES
('DRAFT', 'Draf Pemeriksaan', 'Dokumen rekam medis baru diinisiasi dan belum lengkap', FALSE),
('IN_PROGRESS', 'Sedang Diperiksa', 'Pemeriksaan klinis dan pengisian EMR sedang berlangsung oleh dokter/perawat', FALSE),
('COMPLETED', 'Selesai Pelayanan', 'Pemeriksaan selesai, diagnosis, resep, dan disposisi telah difinalisasi', TRUE),
('CANCELLED', 'Dibatalkan', 'Kunjungan atau pemeriksaan dibatalkan', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 3. Foreign Key lokal pada medical_records (100% legal dalam skema rawat_jalan)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_medical_records_status'
    ) THEN
        ALTER TABLE medical_records
        ADD CONSTRAINT fk_medical_records_status
        FOREIGN KEY (status) REFERENCES master_emr_status(code);
    END IF;
END $$;
