-- 1. Buat tabel master status kunjungan
CREATE TABLE IF NOT EXISTS master_encounter_status (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    is_terminal BOOLEAN DEFAULT FALSE,
    is_cancellable BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seeding status resmi kunjungan rawat jalan
INSERT INTO master_encounter_status (code, name, description, category, is_terminal, is_cancellable, sort_order) VALUES
('REGISTERED', 'Terdaftar', 'Pasien baru terdaftar di loket admisi', 'ADMISSION', FALSE, TRUE, 1),
('WAITING_FOR_PAYMENT', 'Menunggu Pembayaran', 'Menunggu pelunasan biaya registrasi/tindakan di kasir', 'BILLING', FALSE, TRUE, 2),
('QUEUED_FOR_POLI', 'Antre Poliklinik', 'Pembayaran kasir lunas, menunggu antrean panggilan dokter di poli', 'CLINICAL', FALSE, TRUE, 3),
('IN_PROGRESS', 'Sedang Diperiksa', 'Pasien sedang dalam penanganan/konsultasi dokter', 'CLINICAL', FALSE, FALSE, 4),
('IN_EXAMINATION', 'Pemeriksaan Klinis', 'Pemeriksaan medis oleh dokter sedang berlangsung', 'CLINICAL', FALSE, FALSE, 5),
('COMPLETED', 'Selesai Pelayanan', 'Pelayanan poliklinik telah selesai secara paripurna', 'TERMINAL', TRUE, FALSE, 6),
('CANCELLED', 'Dibatalkan', 'Pendaftaran kunjungan dibatalkan secara administratif', 'TERMINAL', TRUE, FALSE, 7)
ON CONFLICT (code) DO NOTHING;

-- 3. Foreign Key lokal pada encounters (100% legal dalam skema registration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_encounters_status'
    ) THEN
        ALTER TABLE encounters
        ADD CONSTRAINT fk_encounters_status
        FOREIGN KEY (status) REFERENCES master_encounter_status(code);
    END IF;
END $$;
