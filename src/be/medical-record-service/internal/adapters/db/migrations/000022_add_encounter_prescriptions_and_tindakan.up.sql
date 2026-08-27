-- Tambah kategori/tag internal pada master_tindakan
ALTER TABLE master_tindakan
    ADD COLUMN IF NOT EXISTS internal_category VARCHAR(50) DEFAULT 'UMUM';

-- Berikan tag khusus untuk "Pemeriksaan Dokter Umum" dan "Pemeriksaan Dokter Spesialis"
UPDATE master_tindakan SET internal_category = 'KARCIS' WHERE kode_tindakan IN ('TND-001', 'TND-002'); -- Assuming these are the codes, let's verify later. We can update by name if needed.
UPDATE master_tindakan SET internal_category = 'KARCIS' WHERE nama_tindakan ILIKE 'Pemeriksaan Dokter%';

-- Buat tabel encounter_tindakan
CREATE TABLE IF NOT EXISTS encounter_tindakan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_no VARCHAR(255) NOT NULL REFERENCES medical_records(encounter_no) ON DELETE CASCADE,
    kode_tindakan VARCHAR(50) NOT NULL REFERENCES master_tindakan(kode_tindakan),
    qty INT NOT NULL DEFAULT 1,
    price NUMERIC(15,2) NOT NULL DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_dt TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_enc_tindakan_encounter ON encounter_tindakan(encounter_no);
CREATE INDEX IF NOT EXISTS idx_enc_tindakan_payment ON encounter_tindakan(payment_status);

-- Buat tabel encounter_resep
CREATE TABLE IF NOT EXISTS encounter_resep (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_no VARCHAR(255) NOT NULL REFERENCES medical_records(encounter_no) ON DELETE CASCADE,
    obat_id VARCHAR(100) NOT NULL, -- Assuming string identifier for drug, later can FK to pharmacy.inventory
    obat_name VARCHAR(255) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    dosis VARCHAR(100),
    instruksi TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT_TO_FARMASI, DISPENSED
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_dt TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_enc_resep_encounter ON encounter_resep(encounter_no);
