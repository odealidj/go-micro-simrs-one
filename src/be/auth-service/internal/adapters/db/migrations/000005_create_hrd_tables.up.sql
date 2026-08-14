CREATE TABLE profil_dokter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spesialisasi VARCHAR(100),
    sip VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profil_perawat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    str_perawat VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mapping Dokter ke Poliklinik (poli_id is a business key pointing to emr.master_poliklinik)
CREATE TABLE mapping_dokter_poli (
    dokter_id UUID NOT NULL REFERENCES profil_dokter(id) ON DELETE CASCADE,
    poli_id UUID NOT NULL,
    PRIMARY KEY (dokter_id, poli_id)
);

-- Mapping Perawat ke Poliklinik
CREATE TABLE mapping_perawat_poli (
    perawat_id UUID NOT NULL REFERENCES profil_perawat(id) ON DELETE CASCADE,
    poli_id UUID NOT NULL,
    PRIMARY KEY (perawat_id, poli_id)
);

-- Jadwal Praktek Dokter di Poli
CREATE TABLE jadwal_praktek (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokter_id UUID NOT NULL REFERENCES profil_dokter(id) ON DELETE CASCADE,
    poli_id UUID NOT NULL,
    hari_mingguan INTEGER NOT NULL, -- 0=Minggu, 1=Senin, dst.
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    kuota INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
