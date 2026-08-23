CREATE TABLE master_label_profesi (
    id SERIAL PRIMARY KEY,
    nama_label VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_dt TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

INSERT INTO master_label_profesi (nama_label) VALUES
('Administrator IT'),
('Administrasi'),
('Asisten Apoteker'),
('Dokter Poliklinik'),
('Perawat Poliklinik');

ALTER TABLE staff_profiles ADD COLUMN full_name VARCHAR(255);
ALTER TABLE staff_profiles ADD COLUMN label_profesi_id INT REFERENCES master_label_profesi(id);
