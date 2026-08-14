CREATE TABLE master_role (
    id VARCHAR(50) PRIMARY KEY,
    deskripsi TEXT
);

INSERT INTO master_role (id, deskripsi) VALUES
('super_admin', 'Super Administrator Sistem (IT)'),
('admin', 'Administrator IT'),
('admisi', 'Staf Pendaftaran / Admisi'),
('dokter', 'Dokter Poliklinik'),
('perawat', 'Perawat Poliklinik'),
('kasir', 'Kasir Pembayaran'),
('asisten_apoteker', 'Asisten Apoteker / Operator Farmasi'),
('pasien', 'Pasien')
ON CONFLICT (id) DO NOTHING;

-- Assign any existing users with null or unknown roles to a default just in case
UPDATE users SET role = 'pasien' WHERE role IS NULL OR role NOT IN (SELECT id FROM master_role);

ALTER TABLE users ADD CONSTRAINT fk_user_role FOREIGN KEY (role) REFERENCES master_role(id);
