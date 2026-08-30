CREATE TABLE IF NOT EXISTS jadwal_piket_poli (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poli_code VARCHAR(50) NOT NULL,
    dokter_id UUID NOT NULL REFERENCES profil_dokter(id) ON DELETE CASCADE,
    perawat_id UUID REFERENCES profil_perawat(id) ON DELETE SET NULL,
    piket_date DATE NOT NULL,
    shift_start TIME NOT NULL DEFAULT '08:00:00',
    shift_end TIME NOT NULL DEFAULT '14:00:00',
    keterangan VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_piket_poli_date UNIQUE (poli_code, piket_date)
);

CREATE INDEX IF NOT EXISTS idx_jadwal_piket_date_poli ON jadwal_piket_poli (piket_date, poli_code);
