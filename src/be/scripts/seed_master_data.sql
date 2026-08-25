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
('rekam_medis', 'Petugas Unit Rekam Medis (EMR)'),
('pasien', 'Pasien')
ON CONFLICT (id) DO NOTHING;

-- Create default users for testing (Password is admin123)
-- (This is just an example, super_admin is auto-provisioned by auth-service)
-- DO NOT insert users directly here because they need bcrypt hashed passwords.
-- Users should be created via auth-service registration flow or BootstrapAdmin.

-- 2. EMR SCHEMA (KBM, ICD-10, Tindakan Medis, Polyclinics)
-- ICD-10
CREATE EXTENSION IF NOT EXISTS pg_trgm;

INSERT INTO emr.icd10_catalog (icd10_code, name_en, name_id, chapter_code, block_code, coding_rule, is_active) VALUES
('A00.0', 'Cholera due to Vibrio cholerae 01, biovar cholerae', 'Kolera akibat Vibrio cholerae 01, biotipe cholerae', 'I', 'A00-A09', 'NORMAL', true),
('A01.0', 'Typhoid fever', 'Demam Tifoid', 'I', 'A00-A09', 'NORMAL', true),
('A09', 'Diarrhoea and gastroenteritis of presumed infectious origin', 'Diare dan gastroenteritis oleh penyebab infeksi tertentu', 'I', 'A00-A09', 'NORMAL', true),
('A15.0', 'Tuberculosis of lung, confirmed by sputum microscopy with or without culture', 'Tuberkulosis paru, terkonfirmasi secara mikroskopis dahak', 'I', 'A15-A19', 'DAGGER', true),
('B01.9', 'Varicella without complication', 'Cacar air tanpa komplikasi', 'I', 'B00-B09', 'NORMAL', true),
('B20', 'Human immunodeficiency virus [HIV] disease resulting in infectious and parasitic diseases', 'Penyakit HIV yang menyebabkan penyakit infeksi dan parasit', 'I', 'B20-B24', 'DAGGER', true),
('E10.2', 'Type 1 diabetes mellitus with renal complications', 'Diabetes mellitus tipe 1 dengan komplikasi ginjal', 'IV', 'E10-E14', 'DAGGER', true),
('E11.9', 'Type 2 diabetes mellitus without complications', 'Diabetes mellitus tipe 2 tanpa komplikasi', 'IV', 'E10-E14', 'NORMAL', true),
('I10', 'Essential (primary) hypertension', 'Hipertensi esensial (primer)', 'IX', 'I10-I15', 'NORMAL', true),
('J00', 'Acute nasopharyngitis [common cold]', 'Nasofaringitis akut [common cold]', 'X', 'J00-J06', 'NORMAL', true),
('J01.9', 'Acute sinusitis, unspecified', 'Sinusitis akut, tidak ditentukan', 'X', 'J00-J06', 'NORMAL', true),
('M14.8*', 'Arthropathies in other specified diseases classified elsewhere', 'Artropati pada penyakit lain yang diklasifikasikan di tempat lain', 'XIII', 'M00-M25', 'ASTERISK', true),
('N08.3*', 'Glomerular disorders in diabetes mellitus', 'Gangguan glomerulus pada diabetes mellitus', 'XIV', 'N00-N08', 'ASTERISK', true)
ON CONFLICT (icd10_code) DO UPDATE 
SET name_en = EXCLUDED.name_en, name_id = EXCLUDED.name_id, chapter_code = EXCLUDED.chapter_code, block_code = EXCLUDED.block_code, coding_rule = EXCLUDED.coding_rule, is_active = EXCLUDED.is_active;

-- ICD-9-CM
INSERT INTO emr.icd9cm_catalog (icd9_code, name_en, name_id, category, is_active) VALUES
('00.01', 'Therapeutic ultrasound of vessels of head and neck', 'Ultrasonografi terapeutik pembuluh darah kepala dan leher', '00', true),
('00.11', 'Infusion of drotrecogin alfa (activated)', 'Infus drotrecogin alfa (diaktifkan)', '00', true),
('01.01', 'Cisternal puncture', 'Pungsi sisternal', '01', true),
('01.11', 'Closed [percutaneous] [needle] biopsy of cerebral meninges', 'Biopsi tertutup selaput otak', '01', true),
('02.01', 'Opening of cranial suture', 'Pembukaan sutura kranial', '02', true),
('03.01', 'Removal of foreign body from spinal canal', 'Pengangkatan benda asing dari kanalis spinalis', '03', true),
('04.01', 'Excision of acoustic neuroma', 'Eksisi neuroma akustik', '04', true),
('10.0', 'Removal of foreign body from conjunctiva by incision', 'Pengangkatan benda asing dari konjungtiva dengan insisi', '10', true),
('21.01', 'Control of epistaxis by anterior nasal packing', 'Kontrol epistaksis dengan tampon hidung anterior', '21', true),
('21.02', 'Control of epistaxis by posterior (and anterior) packing', 'Kontrol epistaksis dengan tampon hidung posterior (dan anterior)', '21', true),
('23.09', 'Extraction of other tooth', 'Pencabutan Gigi Lainnya', '23', true),
('33.22', 'Fiber-optic bronchoscopy', 'Bronkoskopi fiber-optik', '33', true),
('33.23', 'Other bronchoscopy', 'Bronkoskopi lainnya', '33', true),
('45.13', 'Other endoscopy of small intestine', 'Endoskopi usus halus lainnya', '45', true),
('45.23', 'Colonoscopy', 'Kolonoskopi', '45', true),
('54.21', 'Laparoscopy', 'Laparoskopi', '54', true),
('86.59', 'Closure of skin and subcutaneous tissue of other sites', 'Jahit Luka', '86', true),
('87.44', 'Routine chest x-ray, so described', 'Rontgen Dada', '87', true),
('88.78', 'Diagnostic ultrasound of gravid uterus', 'USG Kandungan', '88', true),
('89.01', 'Interview and evaluation, described as brief', 'Wawancara dan evaluasi, singkat', '89', true),
('89.02', 'Interview and evaluation, described as limited', 'Wawancara dan evaluasi, terbatas', '89', true),
('89.03', 'Interview and evaluation, described as comprehensive', 'Wawancara dan evaluasi, komprehensif', '89', true),
('89.52', 'Electrocardiogram', 'Elektrokardiogram (EKG)', '89', true),
('90.59', 'Microscopic examination of blood', 'Pemeriksaan mikroskopik darah', '90', true),
('93.94', 'Respiratory medication administered by nebulizer', 'Pemberian obat pernapasan dengan nebulizer', '93', true),
('99.04', 'Transfusion of packed cells', 'Transfusi sel darah merah', '99', true),
('99.21', 'Injection of antibiotic', 'Injeksi antibiotik', '99', true),
('99.29', 'Injection or infusion of other therapeutic or prophylactic substance', 'Injeksi atau infus zat terapeutik lainnya', '99', true)
ON CONFLICT (icd9_code) DO NOTHING;

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
('A00.0', '01'),
('A01.0', '01'),
('A09', '01'),
('A15.0', '01'),
('B01.9', '01'),
('B01.9', '03'),
('B20', '01'),
('E10.2', '01'),
('E11.9', '01'),
('I10', '01'),
('J00', '01'),
('J00', '03'),
('J01.9', '01'),
('M14.8*', '01'),
('N08.3*', '01')
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

-- Tindakan ICD-9 Mappings
INSERT INTO emr.tindakan_icd9_mapping (kode_tindakan, icd9_code, is_primary) VALUES
('TND-001', '89.02', true), -- Pemeriksaan Umum -> Wawancara dan evaluasi, terbatas
('TND-002', '89.03', true), -- Pemeriksaan Gigi -> Wawancara dan evaluasi, komprehensif
('TND-003', '23.09', true), -- Cabut Gigi -> Pencabutan Gigi Lainnya
('TND-004', '88.78', true), -- USG Kandungan -> USG Kandungan
('TND-005', '90.59', true), -- Cek Gula Darah -> Pemeriksaan mikroskopik darah
('TND-006', '86.59', true)  -- Jahit Luka -> Jahit Luka
ON CONFLICT (kode_tindakan, icd9_code) DO NOTHING;

-- KBM to ICD-10 Mappings
INSERT INTO emr.kbm_icd10_mappings (kbm_code, icd10_code, is_primary, mapping_confidence) VALUES
('KBM-001', 'A01.0', true, '0.95'),
('KBM-011', 'J06.9', true, '0.90'),
('KBM-011', 'J00', false, '0.80'),
('KBM-021', 'I10', true, '0.95'),
('KBM-031', 'E11.9', true, '0.95'),
('KBM-031', 'E11.8', false, '0.85')
ON CONFLICT (kbm_code, icd10_code) DO NOTHING;

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

