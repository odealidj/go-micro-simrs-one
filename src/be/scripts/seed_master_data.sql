-- ==========================================
-- MASTER DATA SEEDER FOR SIMRS
-- ==========================================

-- 1. AUTH SCHEMA (Roles and Users)
-- Insert Roles if they don't exist
INSERT INTO auth.master_role (id, deskripsi) VALUES
('super_admin', 'Super Administrator Sistem (IT)'),
('admin', 'Administrator IT'),
('admisi', 'Staf Pendaftaran / Admisi'),
('dokter', 'Dokter Poliklinik'),
('perawat', 'Perawat Poliklinik'),
('kasir', 'Kasir Pembayaran'),
('asisten_apoteker', 'Asisten Apoteker / Operator Farmasi'),
('pasien', 'Pasien')
ON CONFLICT (id) DO NOTHING;

-- Create default users for testing (Password is admin123)
-- (This is just an example, super_admin is auto-provisioned by auth-service)
-- DO NOT insert users directly here because they need bcrypt hashed passwords.
-- Users should be created via auth-service registration flow or BootstrapAdmin.

-- 2. EMR SCHEMA (KBM, ICD-10, Tindakan Medis, Polyclinics)
-- ICD-10
CREATE EXTENSION IF NOT EXISTS pg_trgm;

INSERT INTO emr.icd10_catalog (icd10_code, name, description) VALUES
('A00', 'Cholera', 'Kolera'),
('A01', 'Typhoid and paratyphoid fevers', 'Tifus'),
('A09', 'Infectious gastroenteritis and colitis, unspecified', 'Gastroenteritis'),
('E11', 'Type 2 diabetes mellitus', 'Diabetes'),
('I10', 'Essential (primary) hypertension', 'Hipertensi'),
('J00', 'Acute nasopharyngitis [common cold]', 'Flu'),
('J01', 'Acute sinusitis', 'Sinusitis')
ON CONFLICT (icd10_code) DO NOTHING;

-- Tindakan Medis
INSERT INTO emr.master_tindakan (kode_tindakan, nama_tindakan, base_price) VALUES
('TND-001', 'Pemeriksaan Umum', 50000.00),
('TND-002', 'Pemeriksaan Gigi', 75000.00),
('TND-003', 'Cabut Gigi', 150000.00),
('TND-004', 'USG Kandungan', 200000.00),
('TND-005', 'Cek Gula Darah', 25000.00),
('TND-006', 'Jahit Luka', 100000.00)
ON CONFLICT (kode_tindakan) DO NOTHING;

-- 3. PHARMACY SCHEMA (Obat / Inventory)
INSERT INTO pharmacy.inventory (item_code, name, stock_quantity, price) VALUES
('OBT-001', 'Paracetamol 500mg (Tablet)', 1000, 5000.00),
('OBT-002', 'Amoxicillin 500mg (Kapsul)', 500, 15000.00),
('OBT-003', 'Omeprazole 20mg (Kapsul)', 300, 25000.00),
('OBT-004', 'Loratadine 10mg (Tablet)', 400, 10000.00),
('OBT-005', 'Vitamin C 500mg (Tablet)', 2000, 2000.00)
ON CONFLICT (item_code) DO UPDATE SET 
    name = EXCLUDED.name, 
    price = EXCLUDED.price;

-- Note: Mapping Dokter ke Poli & Jadwal Praktek (auth schema)
-- Because this requires UUIDs from auth.profil_dokter and auth.profil_perawat,
-- it is best managed via API or application logic rather than hardcoded seed.

-- Seed Polyclinics (just in case they are missing)
INSERT INTO emr.polyclinics (code, name) VALUES
('01', 'Poliklinik Umum'),
('02', 'Poliklinik Gigi'),
('04', 'Poliklinik Kandungan (Obgyn)'),
('03', 'Poliklinik Anak'),
('MATA', 'Poliklinik Mata')
ON CONFLICT (code) DO NOTHING;

-- Seed KBM Catalog
INSERT INTO emr.kbm_catalog (kbm_code, kbm_name, description, body_system, is_active) VALUES
('KBM-001', 'Demam Tinggi', 'Gejala demam di atas 38 derajat', 'Sistem Imun', true),
('KBM-011', 'Batuk Berdahak', 'Batuk disertai dahak kental', 'Sistem Pernapasan', true),
('KBM-021', 'Nyeri Perut', 'Nyeri pada area abdomen', 'Sistem Pencernaan', true),
('KBM-031', 'Sakit Kepala Berat', 'Migrain atau sakit kepala tegang', 'Sistem Saraf', true)
ON CONFLICT (kbm_code) DO NOTHING;

-- Mappings EMR
INSERT INTO emr.icd10_polyclinic_mappings (icd10_code, polyclinic_code) VALUES
('A00', '01'),
('A01', '01'),
('A09', '01'),
('E11', '01'),
('I10', '01'),
('J00', '01'),
('J00', '03'),
('J01', '01')
ON CONFLICT DO NOTHING;

-- Seed KBM Polyclinic Mappings (Dummy Data for existing KBMs)
INSERT INTO emr.kbm_polyclinic_mappings (kbm_code, polyclinic_code) VALUES
('KBM-001', '01'),
('KBM-001', '03'),
('KBM-011', '01'),
('KBM-011', '03'),
('KBM-021', '01'),
('KBM-031', '01')
ON CONFLICT DO NOTHING;

INSERT INTO emr.tindakan_polyclinic_mappings (kode_tindakan, polyclinic_code) VALUES
('TND-001', '01'),
('TND-002', '02'),
('TND-003', '02'),
('TND-004', '04'),
('TND-005', '01'),
('TND-006', '01')
ON CONFLICT DO NOTHING;

-- Mappings Pharmacy
INSERT INTO pharmacy.inventory_polyclinic_mappings (item_code, polyclinic_code) VALUES
('OBT-001', '01'),
('OBT-001', '03'),
('OBT-002', '01'),
('OBT-003', '01'),
('OBT-004', '01'),
('OBT-005', '01')
ON CONFLICT DO NOTHING;

-- ==========================================
-- ADDITIONS: KBM, DOCTORS, NURSES
-- ==========================================

-- KBM Catalog moved to the top

-- Seed Users for Doctors and Nurses
INSERT INTO auth.users (id, username, password_hash, role) VALUES
('d0000000-0000-0000-0000-000000000001', 'dokter.budi', '$2a$10$X8H.h.qN7TzQ7eJ6hHn3f.Q3eE7x9bY2w2q9T1p3u9x/eG0h/U6.C', 'dokter')
ON CONFLICT (username) DO NOTHING;

INSERT INTO auth.users (id, username, password_hash, role) VALUES
('d0000000-0000-0000-0000-000000000002', 'dokter.siti', '$2a$10$X8H.h.qN7TzQ7eJ6hHn3f.Q3eE7x9bY2w2q9T1p3u9x/eG0h/U6.C', 'dokter')
ON CONFLICT (username) DO NOTHING;

INSERT INTO auth.users (id, username, password_hash, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'perawat.andi', '$2a$10$X8H.h.qN7TzQ7eJ6hHn3f.Q3eE7x9bY2w2q9T1p3u9x/eG0h/U6.C', 'perawat')
ON CONFLICT (username) DO NOTHING;

-- Seed Doctor Profiles
INSERT INTO auth.profil_dokter (user_id, spesialisasi, sip)
SELECT id, 'Penyakit Dalam', 'SIP-12345678' FROM auth.users WHERE username = 'dokter.budi'
AND NOT EXISTS (SELECT 1 FROM auth.profil_dokter WHERE user_id = (SELECT id FROM auth.users WHERE username = 'dokter.budi'));

INSERT INTO auth.profil_dokter (user_id, spesialisasi, sip)
SELECT id, 'Anak', 'SIP-87654321' FROM auth.users WHERE username = 'dokter.siti'
AND NOT EXISTS (SELECT 1 FROM auth.profil_dokter WHERE user_id = (SELECT id FROM auth.users WHERE username = 'dokter.siti'));

-- Seed Nurse Profiles
INSERT INTO auth.profil_perawat (user_id, str_perawat)
SELECT id, 'STR-11223344' FROM auth.users WHERE username = 'perawat.andi'
AND NOT EXISTS (SELECT 1 FROM auth.profil_perawat WHERE user_id = (SELECT id FROM auth.users WHERE username = 'perawat.andi'));

-- Seed Mapping Dokter Poli
INSERT INTO auth.mapping_dokter_poli (dokter_id, poli_code, end_date)
SELECT (SELECT id FROM auth.profil_dokter WHERE user_id = (SELECT id FROM auth.users WHERE username = 'dokter.budi')), '01', '2099-12-31'
WHERE NOT EXISTS (SELECT 1 FROM auth.mapping_dokter_poli WHERE dokter_id = (SELECT id FROM auth.profil_dokter WHERE user_id = (SELECT id FROM auth.users WHERE username = 'dokter.budi')) AND poli_code = '01');

INSERT INTO auth.mapping_dokter_poli (dokter_id, poli_code, end_date)
SELECT (SELECT id FROM auth.profil_dokter WHERE user_id = (SELECT id FROM auth.users WHERE username = 'dokter.siti')), '03', '2099-12-31'
WHERE NOT EXISTS (SELECT 1 FROM auth.mapping_dokter_poli WHERE dokter_id = (SELECT id FROM auth.profil_dokter WHERE user_id = (SELECT id FROM auth.users WHERE username = 'dokter.siti')) AND poli_code = '03');

-- Seed Mapping Perawat Poli
INSERT INTO auth.mapping_perawat_poli (perawat_id, poli_code, end_date)
SELECT (SELECT id FROM auth.profil_perawat WHERE user_id = (SELECT id FROM auth.users WHERE username = 'perawat.andi')), '01', '2099-12-31'
WHERE NOT EXISTS (SELECT 1 FROM auth.mapping_perawat_poli WHERE perawat_id = (SELECT id FROM auth.profil_perawat WHERE user_id = (SELECT id FROM auth.users WHERE username = 'perawat.andi')) AND poli_code = '01');
