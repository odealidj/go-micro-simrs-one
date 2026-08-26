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
('A91', 'Dengue haemorrhagic fever', 'Demam Berdarah Dengue (DBD)', 'I', 'A90-A99', 'NORMAL', true),
('B01.9', 'Varicella without complication', 'Cacar air tanpa komplikasi', 'I', 'B00-B09', 'NORMAL', true),
('B05.9', 'Measles without complication', 'Campak tanpa komplikasi', 'I', 'B00-B09', 'NORMAL', true),
('B20', 'Human immunodeficiency virus [HIV] disease resulting in infectious and parasitic diseases', 'Penyakit HIV yang menyebabkan penyakit infeksi dan parasit', 'I', 'B20-B24', 'DAGGER', true),
('C50.9', 'Malignant neoplasm: Breast, unspecified', 'Neoplasma ganas payudara, tidak ditentukan', 'II', 'C00-C97', 'NORMAL', true),
('C53.9', 'Malignant neoplasm: Cervix uteri, unspecified', 'Neoplasma ganas serviks uteri, tidak ditentukan', 'II', 'C00-C97', 'NORMAL', true),
('D50.9', 'Iron deficiency anaemia, unspecified', 'Anemia defisiensi besi, tidak ditentukan', 'III', 'D50-D53', 'NORMAL', true),
('D64.9', 'Anaemia, unspecified', 'Anemia, tidak ditentukan', 'III', 'D50-D89', 'NORMAL', true),
('E10.2', 'Type 1 diabetes mellitus with renal complications', 'Diabetes mellitus tipe 1 dengan komplikasi ginjal', 'IV', 'E10-E14', 'DAGGER', true),
('E10.9', 'Type 1 diabetes mellitus without complications', 'Diabetes mellitus tipe 1 tanpa komplikasi', 'IV', 'E10-E14', 'NORMAL', true),
('E11.8', 'Type 2 diabetes mellitus with unspecified complications', 'Diabetes mellitus tipe 2 dengan komplikasi lain', 'IV', 'E10-E14', 'NORMAL', true),
('E11.9', 'Type 2 diabetes mellitus without complications', 'Diabetes mellitus tipe 2 tanpa komplikasi', 'IV', 'E10-E14', 'NORMAL', true),
('E28.2', 'Polycystic ovarian syndrome', 'Sindrom ovarium polikistik (PCOS)', 'IV', 'E20-E35', 'NORMAL', true),
('E78.5', 'Hyperlipidaemia, unspecified', 'Hiperlipidemia, tidak ditentukan', 'IV', 'E70-E90', 'NORMAL', true),
('F32.9', 'Depressive episode, unspecified', 'Episode depresi, tidak ditentukan', 'V', 'F30-F39', 'NORMAL', true),
('F41.9', 'Anxiety disorder, unspecified', 'Gangguan kecemasan, tidak ditentukan', 'V', 'F40-F48', 'NORMAL', true),
('G43.9', 'Migraine, unspecified', 'Migren, tidak ditentukan', 'VI', 'G40-G47', 'NORMAL', true),
('G47.0', 'Disorders of initiating and maintaining sleep [insomnias]', 'Gangguan memulai dan mempertahankan tidur [insomnia]', 'VI', 'G40-G47', 'NORMAL', true),
('H00.0', 'Hordeolum and other deep inflammation of eyelid', 'Hordeolum dan radang kelopak mata (Bintitan)', 'VII', 'H00-H06', 'NORMAL', true),
('H10.9', 'Conjunctivitis, unspecified', 'Konjungtivitis, tidak ditentukan', 'VII', 'H10-H13', 'NORMAL', true),
('H25.9', 'Senile cataract, unspecified', 'Katarak senilis, tidak ditentukan', 'VII', 'H25-H28', 'NORMAL', true),
('H52.1', 'Myopia', 'Miopia (Rabun Jauh)', 'VII', 'H49-H52', 'NORMAL', true),
('H65.9', 'Nonsuppurative otitis media, unspecified', 'Otitis media non-supuratif, tidak ditentukan', 'VIII', 'H65-H75', 'NORMAL', true),
('I10', 'Essential (primary) hypertension', 'Hipertensi esensial (primer)', 'IX', 'I10-I15', 'NORMAL', true),
('I11.0', 'Hypertensive heart disease with (congestive) heart failure', 'Penyakit jantung hipertensi dengan gagal jantung', 'IX', 'I10-I15', 'NORMAL', true),
('I25.1', 'Atherosclerotic heart disease', 'Penyakit Jantung Aterosklerotik', 'IX', 'I20-I25', 'NORMAL', true),
('I50.0', 'Congestive heart failure', 'Gagal jantung kongestif', 'IX', 'I50-I52', 'NORMAL', true),
('I50.9', 'Heart failure, unspecified', 'Gagal jantung, tidak ditentukan', 'IX', 'I50-I52', 'NORMAL', true),
('I64', 'Stroke, not specified as haemorrhage or infarction', 'Stroke, tidak ditentukan sebagai pendarahan atau infark', 'IX', 'I60-I69', 'NORMAL', true),
('J00', 'Acute nasopharyngitis [common cold]', 'Nasofaringitis akut [common cold]', 'X', 'J00-J06', 'NORMAL', true),
('J01.9', 'Acute sinusitis, unspecified', 'Sinusitis akut, tidak ditentukan', 'X', 'J00-J06', 'NORMAL', true),
('J06.9', 'Acute upper respiratory infection, unspecified', 'Infeksi saluran pernapasan atas akut (ISPA)', 'X', 'J00-J06', 'NORMAL', true),
('J18.9', 'Pneumonia, unspecified', 'Pneumonia, tidak ditentukan', 'X', 'J09-J18', 'NORMAL', true),
('J45.9', 'Asthma, unspecified', 'Asma, tidak ditentukan', 'X', 'J40-J47', 'NORMAL', true),
('K02.9', 'Dental caries, unspecified', 'Karies gigi, tidak ditentukan', 'XI', 'K00-K14', 'NORMAL', true),
('K04.0', 'Pulpitis', 'Pulpitis (Radang Pulpa Gigi)', 'XI', 'K00-K14', 'NORMAL', true),
('K05.3', 'Chronic periodontitis', 'Periodontitis kronis', 'XI', 'K00-K14', 'NORMAL', true),
('K21.9', 'Gastro-oesophageal reflux disease without oesophagitis', 'Penyakit refluks gastro-esofagus tanpa esofagitis (GERD)', 'XI', 'K20-K31', 'NORMAL', true),
('K27.9', 'Peptic ulcer, unspecified as acute or chronic', 'Tukak peptik, tidak ditentukan akut atau kronis', 'XI', 'K20-K31', 'NORMAL', true),
('K29.7', 'Gastritis, unspecified', 'Gastritis, tidak ditentukan', 'XI', 'K20-K31', 'NORMAL', true),
('K35.8', 'Other and unspecified acute appendicitis', 'Apendisitis akut lainnya dan tidak ditentukan', 'XI', 'K35-K38', 'NORMAL', true),
('L20.9', 'Atopic dermatitis, unspecified', 'Dermatitis atopik, tidak ditentukan', 'XII', 'L20-L30', 'NORMAL', true),
('L23.9', 'Allergic contact dermatitis, unspecified cause', 'Dermatitis kontak alergi, penyebab tidak ditentukan', 'XII', 'L20-L30', 'NORMAL', true),
('L50.9', 'Urticaria, unspecified', 'Urtikaria (biduran), tidak ditentukan', 'XII', 'L50-L54', 'NORMAL', true),
('M14.8*', 'Arthropathies in other specified diseases classified elsewhere', 'Artropati pada penyakit lain yang diklasifikasikan di tempat lain', 'XIII', 'M00-M25', 'ASTERISK', true),
('M19.9', 'Osteoarthritis, unspecified', 'Osteoartritis, tidak ditentukan', 'XIII', 'M15-M19', 'NORMAL', true),
('M54.5', 'Low back pain', 'Nyeri punggung bawah (LBP)', 'XIII', 'M50-M54', 'NORMAL', true),
('N08.3*', 'Glomerular disorders in diabetes mellitus', 'Gangguan glomerulus pada diabetes mellitus', 'XIV', 'N00-N08', 'ASTERISK', true),
('N18.9', 'Chronic kidney disease, unspecified', 'Penyakit ginjal kronis, tidak ditentukan', 'XIV', 'N17-N19', 'NORMAL', true),
('N39.0', 'Urinary tract infection, site not specified', 'Infeksi saluran kemih (ISK)', 'XIV', 'N30-N39', 'NORMAL', true),
('N94.6', 'Dysmenorrhoea, unspecified', 'Dismenore (Nyeri Haid), tidak ditentukan', 'XIV', 'N80-N98', 'NORMAL', true),
('O13', 'Gestational [pregnancy-induced] hypertension', 'Hipertensi gestasional (induksi kehamilan)', 'XV', 'O10-O16', 'NORMAL', true),
('O20.0', 'Threatened abortion', 'Ancaman keguguran (Abortus imminens)', 'XV', 'O20-O29', 'NORMAL', true),
('O24.4', 'Diabetes mellitus arising in pregnancy', 'Diabetes mellitus gestasional pada kehamilan', 'XV', 'O20-O29', 'NORMAL', true),
('O80.9', 'Single spontaneous delivery, unspecified', 'Persalinan spontan tunggal, tidak ditentukan', 'XV', 'O80-O84', 'NORMAL', true),
('P07.3', 'Other preterm infants', 'Bayi prematur lainnya', 'XVI', 'P05-P08', 'NORMAL', true),
('Q05.9', 'Spina bifida, unspecified', 'Spina bifida, tidak ditentukan', 'XVII', 'Q00-Q07', 'NORMAL', true),
('R05', 'Cough', 'Batuk', 'XVIII', 'R00-R09', 'NORMAL', true),
('R07.4', 'Chest pain, unspecified', 'Nyeri dada, tidak ditentukan', 'XVIII', 'R00-R09', 'NORMAL', true),
('R50.9', 'Fever, unspecified', 'Demam, tidak ditentukan', 'XVIII', 'R50-R69', 'NORMAL', true),
('R51', 'Headache', 'Sakit kepala', 'XVIII', 'R50-R69', 'NORMAL', true),
('S09.9', 'Unspecified injury of head', 'Cedera kepala, tidak ditentukan', 'XIX', 'S00-S09', 'NORMAL', true),
('T07', 'Unspecified multiple injuries', 'Cedera ganda, tidak ditentukan', 'XIX', 'T00-T07', 'NORMAL', true),
('T15.0', 'Foreign body in cornea', 'Benda asing pada kornea', 'XIX', 'T15-T19', 'NORMAL', true),
('Z00.0', 'General medical examination', 'Pemeriksaan medis umum (Medical Check Up)', 'XXI', 'Z00-Z13', 'NORMAL', true),
('Z01.2', 'Dental examination', 'Pemeriksaan kesehatan gigi', 'XXI', 'Z00-Z13', 'NORMAL', true),
('A16.2', 'Tuberculosis of lung, without mention of bacteriological or histological confirmation', 'Tuberkulosis paru anak, tanpa konfirmasi bakteriologis', 'I', 'A15-A19', 'NORMAL', true),
('A90', 'Dengue fever [classical dengue]', 'Demam dengue [dengue klasik]', 'I', 'A90-A99', 'NORMAL', true),
('B08.4', 'Enteroviral vesicular stomatitis with exanthem', 'Stomatitis vesikuler enteroviral dengan eksantem (Flu Singapura / HFMD)', 'I', 'B00-B09', 'NORMAL', true),
('B26.9', 'Mumps without complication', 'Gondongan tanpa komplikasi (Parotitis)', 'I', 'B25-B34', 'NORMAL', true),
('B35.9', 'Dermatophytosis, unspecified', 'Dermatofitosis, tidak ditentukan (Jamur kulit / Tinea)', 'I', 'B35-B49', 'NORMAL', true),
('B86', 'Scabies', 'Skabies (Kudis)', 'I', 'B85-B89', 'NORMAL', true),
('D25.9', 'Leiomyoma of uterus, unspecified', 'Leiomioma uteri, tidak ditentukan (Mioma uteri)', 'II', 'D10-D36', 'NORMAL', true),
('E44.0', 'Moderate protein-energy malnutrition', 'Malnutrisi energi-protein sedang (Gizi kurang)', 'IV', 'E40-E46', 'NORMAL', true),
('E79.0', 'Hyperuricaemia without signs of inflammatory arthritis', 'Hiperurisemia tanpa tanda artritis inflamasi (Asam urat tinggi)', 'IV', 'E70-E90', 'NORMAL', true),
('H01.0', 'Blepharitis', 'Blefaritis (Radang kelopak mata)', 'VII', 'H00-H06', 'NORMAL', true),
('H11.0', 'Pterygium', 'Pterigium (Selaput mata)', 'VII', 'H10-H13', 'NORMAL', true),
('H16.0', 'Corneal ulcer', 'Ulkus kornea', 'VII', 'H15-H22', 'NORMAL', true),
('H40.9', 'Glaucoma, unspecified', 'Glaukoma, tidak ditentukan', 'VII', 'H40-H42', 'NORMAL', true),
('H52.0', 'Hypermetropia', 'Hipermetropia (Rabun dekat)', 'VII', 'H49-H52', 'NORMAL', true),
('H52.2', 'Astigmatism', 'Astigmatisme (Silinder mata)', 'VII', 'H49-H52', 'NORMAL', true),
('H52.4', 'Presbyopia', 'Presbiopia (Mata tua)', 'VII', 'H49-H52', 'NORMAL', true),
('J20.9', 'Acute bronchitis, unspecified', 'Bronkitis akut, tidak ditentukan', 'X', 'J20-J22', 'NORMAL', true),
('J21.9', 'Acute bronchiolitis, unspecified', 'Bronkiolitis akut, tidak ditentukan', 'X', 'J20-J22', 'NORMAL', true),
('K01.1', 'Impacted teeth', 'Gigi impaksi (Molar tiga impaksi)', 'XI', 'K00-K14', 'NORMAL', true),
('K03.6', 'Deposits [accretions] on teeth', 'Deposit pada gigi (Karang gigi / Kalkulus)', 'XI', 'K00-K14', 'NORMAL', true),
('K04.7', 'Periapical abscess without sinus', 'Abses periapikal tanpa sinus (Abses gigi)', 'XI', 'K00-K14', 'NORMAL', true),
('K08.1', 'Loss of teeth due to accident, extraction or local periodontal disease', 'Kehilangan gigi akibat pencabutan atau penyakit periodontal', 'XI', 'K00-K14', 'NORMAL', true),
('K12.0', 'Recurrent aphthous stomatitis', 'Stomatitis aftosa rekuren (Sariawan)', 'XI', 'K00-K14', 'NORMAL', true),
('K80.2', 'Calculus of gallbladder without cholecystitis', 'Batu kantung empedu tanpa kolesistitis (Kolelitiasis)', 'XI', 'K80-K87', 'NORMAL', true),
('L03.9', 'Cellulitis, unspecified', 'Selulitis, tidak ditentukan', 'XII', 'L00-L08', 'NORMAL', true),
('M10.9', 'Gout, unspecified', 'Penyakit asam urat (Gout arthritis), tidak ditentukan', 'XIII', 'M00-M25', 'NORMAL', true),
('N20.1', 'Calculus of ureter', 'Batu ureter (Batu saluran kemih)', 'XIV', 'N20-N23', 'NORMAL', true),
('N76.0', 'Acute vaginitis', 'Vaginitis akut (Keputihan abnormal)', 'XIV', 'N70-N77', 'NORMAL', true),
('N80.9', 'Endometriosis, unspecified', 'Endometriosis, tidak ditentukan', 'XIV', 'N80-N98', 'NORMAL', true),
('O03.9', 'Complete or unspecified spontaneous abortion, without complication', 'Abortus spontan lengkap atau tidak ditentukan, tanpa komplikasi', 'XV', 'O00-O08', 'NORMAL', true),
('O14.0', 'Mild to moderate pre-eclampsia', 'Preeklampsia ringan sampai sedang', 'XV', 'O10-O16', 'NORMAL', true),
('O21.0', 'Mild hyperemesis gravidarum', 'Hiperemesis gravidarum ringan (Mual muntah kehamilan)', 'XV', 'O20-O29', 'NORMAL', true),
('R56.0', 'Febrile convulsions', 'Kejang demam (Stuiper)', 'XVIII', 'R50-R69', 'NORMAL', true),
('T14.0', 'Superficial injury of unspecified body region', 'Cedera superfisial bagian tubuh yang tidak ditentukan (Luka lecet / memar)', 'XIX', 'T14-T14', 'NORMAL', true),
('T14.1', 'Open wound of unspecified body region', 'Luka terbuka bagian tubuh yang tidak ditentukan (Luka robek)', 'XIX', 'T14-T14', 'NORMAL', true),
('Z00.1', 'Routine child health examination', 'Pemeriksaan rutin kesehatan dan tumbuh kembang anak', 'XXI', 'Z00-Z13', 'NORMAL', true),
('Z34.0', 'Supervision of normal first pregnancy', 'Pengawasan kehamilan pertama normal (ANC 1)', 'XXI', 'Z30-Z39', 'NORMAL', true),
('Z34.8', 'Supervision of other normal pregnancy', 'Pengawasan kehamilan normal lainnya (ANC lanjutan)', 'XXI', 'Z30-Z39', 'NORMAL', true)
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
('99.29', 'Injection or infusion of other therapeutic or prophylactic substance', 'Injeksi atau infus zat terapeutik lainnya', '99', true),
('23.2', 'Restoration of tooth by filling', 'Penambalan Gigi', '23', true),
('95.02', 'Comprehensive eye examination', 'Pemeriksaan Mata Komprehensif', '95', true),
('96.54', 'Dental scaling and polishing', 'Pembersihan Karang Gigi (Scaling)', '96', true)
ON CONFLICT (icd9_code) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_id = EXCLUDED.name_id,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active;

-- Tindakan Medis
INSERT INTO emr.master_tindakan (kode_tindakan, nama_tindakan, base_price) VALUES
('TND-001', 'Pemeriksaan Umum', 50000.00),
('TND-002', 'Pemeriksaan Gigi', 75000.00),
('TND-003', 'Cabut Gigi', 150000.00),
('TND-004', 'USG Kandungan', 200000.00),
('TND-005', 'Cek Gula Darah', 25000.00),
('TND-006', 'Jahit Luka', 100000.00),
('TND-007', 'Rekam Jantung (EKG)', 80000.00),
('TND-008', 'Terapi Nebulisasi (Inhalasi)', 65000.00),
('TND-009', 'Ekstraksi Benda Asing Mata (Corpus Alienum)', 125000.00),
('TND-010', 'Rontgen Dada (Thorax)', 120000.00),
('TND-011', 'Injeksi Obat / Antibiotik', 35000.00),
('TND-012', 'Penanganan Epistaksis (Tampon Hidung Anterior)', 75000.00),
('TND-013', 'Transfusi Darah (PRC)', 150000.00),
('TND-014', 'Pembersihan Karang Gigi (Scaling)', 150000.00),
('TND-015', 'Penambalan Gigi (Tambal Gigi)', 120000.00),
('TND-016', 'Pemeriksaan Refraksi & Mata Komprehensif', 75000.00)
ON CONFLICT (kode_tindakan) DO UPDATE SET 
    nama_tindakan = EXCLUDED.nama_tindakan, 
    base_price = EXCLUDED.base_price;

-- 3. PHARMACY SCHEMA (KFA Catalog, BPJS DPHO Catalog, Inventory Obat, Mappings)

-- Standard KFA Catalog Dataset (Kemenkes RI - SATUSEHAT FHIR)
INSERT INTO pharmacy.kfa_catalog (kfa_code, name, active_substance, dosage_form, strength, bpom_nie, atc_code, snomed_concept_id) VALUES
('93000108', 'Paracetamol 500 mg Tablet', 'Paracetamol', 'Tablet', '500 mg', 'DKL1234567890A1', 'N02BE01', '387517004'),
('93000215', 'Amoxicillin 500 mg Kapsul', 'Amoxicillin Trihydrate', 'Kapsul', '500 mg', 'GKL9876543210B1', 'J01CA04', '372687004'),
('93000342', 'Omeprazole 20 mg Kapsul Lepas Tunda', 'Omeprazole', 'Kapsul', '20 mg', 'GKL5678901234A1', 'A02BC01', '387207008'),
('93000456', 'Loratadine 10 mg Tablet', 'Loratadine', 'Tablet', '10 mg', 'DKL8901234567A1', 'R06AX13', '387494007'),
('93000567', 'Ascorbic Acid (Vitamin C) 500 mg Tablet', 'Ascorbic Acid', 'Tablet', '500 mg', 'SD012345678', 'A11GA01', '387168000'),
('93000678', 'Metformin HCl 500 mg Tablet Salut Selaput', 'Metformin Hydrochloride', 'Tablet', '500 mg', 'GKL3456789012A1', 'A10BA02', '387463004'),
('93000789', 'Amlodipine 10 mg Tablet', 'Amlodipine Besylate', 'Tablet', '10 mg', 'GKL7890123456A1', 'C08CA01', '386864001'),
('93000890', 'Ceftriaxone 1 g Serbuk Injeksi', 'Ceftriaxone Sodium', 'Serbuk Injeksi', '1 g', 'GKL2345678901A1', 'J01DD04', '387362001'),
('93000901', 'Salbutamol 100 mcg/puff Inhaler', 'Salbutamol Sulfate', 'Inhaler Cair', '100 mcg/puff', 'DKI4567890123A1', 'R03AC02', '372826007'),
('93001012', 'Antasida DOEN Tablet Kunyah', 'Aluminium Hidroksida + Magnesium Hidroksida', 'Tablet Kunyah', '200 mg / 200 mg', 'GBL0123456789A1', 'A02AD01', '764660000'),
('93001123', 'Ibuprofen 400 mg Tablet Salut Selaput', 'Ibuprofen', 'Tablet', '400 mg', 'GKL1230984567A1', 'M01AE01', '387207008'),
('93001234', 'Dexamethasone 0.5 mg Tablet', 'Dexamethasone', 'Tablet', '0.5 mg', 'GKL6789012345A1', 'H02AB02', '372584000')
ON CONFLICT (kfa_code) DO NOTHING;

-- Standard BPJS DPHO Catalog Dataset (Formularium Nasional / DPHO BPJS)
INSERT INTO pharmacy.bpjs_dpho_catalog (dpho_code, dpho_name, is_fornas, is_prb, restriction, max_qty_per_claim) VALUES
('DPHO-001', 'Paracetamol 500 mg tab', true, false, 'Diberikan untuk terapi simtomatik demam/nyeri. Maksimal 30 tablet per kasus.', 30),
('DPHO-002', 'Amoxicillin 500 mg kap', true, false, 'Antibiotik lini pertama infeksi bakteri rentan. Maksimal 15-20 tablet per resep (durasi 5-7 hari).', 20),
('DPHO-003', 'Omeprazole 20 mg kap', true, false, 'Untuk tukak lambung/duodenum dan GERD. Maksimal 30 kapsul per bulan.', 30),
('DPHO-004', 'Loratadine 10 mg tab', true, false, 'Antihistamin non-sedatif untuk rinitis alergi dan urtikaria. Maksimal 10 tablet per resep.', 10),
('DPHO-005', 'Metformin 500 mg tab', true, true, 'Obat Program Rujuk Balik (PRB) Diabetes Melitus Tipe 2. Maksimal 90 tablet per bulan.', 90),
('DPHO-006', 'Amlodipine 10 mg tab', true, true, 'Obat Program Rujuk Balik (PRB) Hipertensi derajat 1-2. Maksimal 30 tablet per bulan.', 30),
('DPHO-007', 'Ceftriaxone 1 g serb inj', true, false, 'Antibiotik lini ketiga untuk infeksi berat di rawat inap / IGD. Maksimal 2 vial per hari selama maks 7 hari.', 14),
('DPHO-008', 'Salbutamol 100 mcg/puff inhaler', true, true, 'Obat PRB / Asma bronkial dan PPOK. Maksimal 1 can per bulan.', 1),
('DPHO-009', 'Antasida DOEN tab kunyah', true, false, 'Untuk hiperasiditas lambung. Maksimal 30 tablet per kasus.', 30),
('DPHO-010', 'Ibuprofen 400 mg tab', true, false, 'Antiinflamasi non-steroid untuk nyeri/inflamasi sedang. Maksimal 30 tablet per kasus.', 30),
('DPHO-011', 'Dexamethasone 0.5 mg tab', true, false, 'Kortikosteroid antiinflamasi dan imunosupresan. Maksimal 20 tablet per kasus.', 20)
ON CONFLICT (dpho_code) DO NOTHING;

-- Standard SIMRS Pharmacy Inventory (Obat RS)
INSERT INTO pharmacy.inventory (item_code, name, stock_quantity, price) VALUES
('OBT-001', 'Paracetamol 500mg (Tablet)', 1000, 5000.00),
('OBT-002', 'Amoxicillin 500mg (Kapsul)', 500, 15000.00),
('OBT-003', 'Omeprazole 20mg (Kapsul)', 300, 25000.00),
('OBT-004', 'Loratadine 10mg (Tablet)', 400, 10000.00),
('OBT-005', 'Vitamin C 500mg (Tablet)', 2000, 2000.00),
('OBT-006', 'Metformin HCl 500mg (Tablet)', 800, 8000.00),
('OBT-007', 'Amlodipine 10mg (Tablet)', 600, 12000.00),
('OBT-008', 'Ceftriaxone 1g Injeksi (Vial)', 150, 65000.00),
('OBT-009', 'Salbutamol 100mcg Inhaler (Can)', 80, 85000.00),
('OBT-010', 'Antasida DOEN Tablet Kunyah', 1200, 3000.00),
('OBT-011', 'Ibuprofen 400mg (Tablet)', 750, 7500.00),
('OBT-012', 'Dexamethasone 0.5mg (Tablet)', 900, 4000.00)
ON CONFLICT (item_code) DO UPDATE SET 
    name = EXCLUDED.name, 
    price = EXCLUDED.price;

-- Initial Cross-Mappings (Inventory -> KFA & DPHO)
INSERT INTO pharmacy.inventory_kfa_mapping (item_code, kfa_code, dpho_code, is_primary, mapping_confidence) VALUES
('OBT-001', '93000108', 'DPHO-001', true, 100.00),
('OBT-002', '93000215', 'DPHO-002', true, 100.00),
('OBT-003', '93000342', 'DPHO-003', true, 100.00),
('OBT-004', '93000456', 'DPHO-004', true, 100.00),
('OBT-005', '93000567', NULL, true, 100.00),
('OBT-006', '93000678', 'DPHO-005', true, 100.00),
('OBT-007', '93000789', 'DPHO-006', true, 100.00),
('OBT-008', '93000890', 'DPHO-007', true, 100.00),
('OBT-009', '93000901', 'DPHO-008', true, 100.00),
('OBT-010', '93001012', 'DPHO-009', true, 100.00),
('OBT-011', '93001123', 'DPHO-010', true, 100.00),
('OBT-012', '93001234', 'DPHO-011', true, 100.00)
ON CONFLICT (item_code, kfa_code) DO NOTHING;

-- Note: Mapping Dokter ke Poli & Jadwal Praktek (auth schema)
-- Because this requires UUIDs from auth.profil_dokter and auth.profil_perawat,
-- it is best managed via API or application logic rather than hardcoded seed.

-- Seed Polyclinics (just in case they are missing)
INSERT INTO emr.polyclinics (code, name) VALUES
('01', 'Poliklinik Umum'),
('02', 'Poliklinik Gigi'),
('03', 'Poliklinik Anak'),
('04', 'Poliklinik Kandungan (Obgyn)'),
('05', 'Poliklinik Mata')
ON CONFLICT (code) DO NOTHING;

-- Seed KBM Catalog
INSERT INTO emr.kbm_catalog (kbm_code, kbm_name, description, body_system, is_active) VALUES
('KBM-001', 'Demam Tinggi', 'Gejala demam di atas 38 derajat', 'Sistem Imun', true),
('KBM-011', 'Batuk Berdahak', 'Batuk disertai dahak kental', 'Sistem Pernapasan', true),
('KBM-021', 'Nyeri Perut', 'Nyeri pada area abdomen', 'Sistem Pencernaan', true),
('KBM-031', 'Sakit Kepala Berat', 'Migrain atau sakit kepala tegang', 'Sistem Saraf', true),
('KBM-041', 'Nyeri Gigi & Gusi', 'Nyeri pada gigi berlubang, radang pulpa, dan gusi bengkak', 'Sistem Stomatognatik (Gigi & Mulut)', true),
('KBM-051', 'Mata Merah & Gangguan Penglihatan', 'Iritasi mata merah, belek, pandangan kabur, atau rasa mengganjal', 'Sistem Penglihatan (Mata)', true),
('KBM-061', 'Keluhan Kehamilan & Nyeri Panggul', 'Keluhan terkait kehamilan, flek darah, mual berlebih, atau nyeri haid', 'Sistem Reproduksi (Kandungan)', true),
('KBM-071', 'Sesak Napas & Mengi', 'Napas berbunyi mengi atau sesak napas saat beraktivitas/cuaca dingin', 'Sistem Pernapasan', true),
('KBM-081', 'Gatal & Ruam Kulit', 'Bintik merah, bentol alergi, rasa gatal pada kulit', 'Sistem Integumen (Kulit)', true),
('KBM-091', 'Nyeri Sendi & Pegal Linu', 'Nyeri pada sendi lutut, pinggang bawah, atau rasa kaku sendi', 'Sistem Muskuloskeletal', true),
('KBM-101', 'Diare & Gangguan Saluran Cerna', 'BAB cair lebih dari 3 kali sehari, rasa mulas, atau kembung', 'Sistem Pencernaan', true)
ON CONFLICT (kbm_code) DO UPDATE
SET kbm_name = EXCLUDED.kbm_name, description = EXCLUDED.description, body_system = EXCLUDED.body_system, is_active = EXCLUDED.is_active;

-- Mappings EMR (ICD-10 to Polyclinic)
INSERT INTO emr.icd10_polyclinic_mappings (icd10_code, polyclinic_code) VALUES
-- Poli 01: Poliklinik Umum
('A00.0', '01'),
('A01.0', '01'),
('A09', '01'),
('A15.0', '01'),
('A90', '01'),
('A91', '01'),
('B01.9', '01'),
('B20', '01'),
('B35.9', '01'),
('B86', '01'),
('E10.2', '01'),
('E10.9', '01'),
('E11.8', '01'),
('E11.9', '01'),
('E78.5', '01'),
('E79.0', '01'),
('G43.9', '01'),
('G47.0', '01'),
('H00.0', '01'),
('H10.9', '01'),
('I10', '01'),
('I11.0', '01'),
('I25.1', '01'),
('I50.0', '01'),
('I50.9', '01'),
('I64', '01'),
('J00', '01'),
('J01.9', '01'),
('J06.9', '01'),
('J18.9', '01'),
('J20.9', '01'),
('J45.9', '01'),
('K12.0', '01'),
('K21.9', '01'),
('K27.9', '01'),
('K29.7', '01'),
('K35.8', '01'),
('K80.2', '01'),
('L03.9', '01'),
('L20.9', '01'),
('L23.9', '01'),
('L50.9', '01'),
('M10.9', '01'),
('M14.8*', '01'),
('M19.9', '01'),
('M54.5', '01'),
('N08.3*', '01'),
('N18.9', '01'),
('N20.1', '01'),
('N39.0', '01'),
('R05', '01'),
('R07.4', '01'),
('R50.9', '01'),
('R51', '01'),
('S09.9', '01'),
('T07', '01'),
('T14.0', '01'),
('T14.1', '01'),
('Z00.0', '01'),

-- Poli 02: Poliklinik Gigi
('K01.1', '02'),
('K02.9', '02'),
('K03.6', '02'),
('K04.0', '02'),
('K04.7', '02'),
('K05.3', '02'),
('K08.1', '02'),
('K12.0', '02'),
('Z01.2', '02'),

-- Poli 03: Poliklinik Anak
('A01.0', '03'),
('A09', '03'),
('A16.2', '03'),
('A90', '03'),
('B01.9', '03'),
('B05.9', '03'),
('B08.4', '03'),
('B26.9', '03'),
('E44.0', '03'),
('J00', '03'),
('J06.9', '03'),
('J18.9', '03'),
('J20.9', '03'),
('J21.9', '03'),
('J45.9', '03'),
('L20.9', '03'),
('L50.9', '03'),
('P07.3', '03'),
('R05', '03'),
('R50.9', '03'),
('R56.0', '03'),
('Z00.1', '03'),

-- Poli 04: Poliklinik Kandungan (Obgyn)
('C50.9', '04'),
('C53.9', '04'),
('D25.9', '04'),
('D50.9', '04'),
('E28.2', '04'),
('K21.9', '04'),
('N39.0', '04'),
('N76.0', '04'),
('N80.9', '04'),
('N94.6', '04'),
('O03.9', '04'),
('O13', '04'),
('O14.0', '04'),
('O20.0', '04'),
('O21.0', '04'),
('O24.4', '04'),
('O80.9', '04'),
('Z34.0', '04'),
('Z34.8', '04'),

-- Poli 05: Poliklinik Mata
('H00.0', '05'),
('H01.0', '05'),
('H10.9', '05'),
('H11.0', '05'),
('H16.0', '05'),
('H25.9', '05'),
('H40.9', '05'),
('H52.0', '05'),
('H52.1', '05'),
('H52.2', '05'),
('H52.4', '05'),
('T15.0', '05')
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
-- TND-001: Pemeriksaan Umum / Konsultasi Dokter (Umum, Anak, Mata)
('TND-001', '01'),
('TND-001', '03'),
('TND-001', '05'),

-- TND-002: Pemeriksaan Gigi (Gigi)
('TND-002', '02'),

-- TND-003: Cabut Gigi (Gigi)
('TND-003', '02'),

-- TND-004: USG Kandungan (Obgyn)
('TND-004', '04'),

-- TND-005: Cek Gula Darah (Umum, Obgyn)
('TND-005', '01'),
('TND-005', '04'),

-- TND-006: Jahit Luka (Umum, Obgyn)
('TND-006', '01'),
('TND-006', '04'),

-- TND-007: Rekam Jantung (EKG) (Umum, Obgyn)
('TND-007', '01'),
('TND-007', '04'),

-- TND-008: Terapi Nebulisasi (Umum, Anak)
('TND-008', '01'),
('TND-008', '03'),

-- TND-009: Ekstraksi Benda Asing Mata (Mata)
('TND-009', '05'),

-- TND-010: Rontgen Dada (Thorax) (Umum, Anak)
('TND-010', '01'),
('TND-010', '03'),

-- TND-011: Injeksi Obat / Antibiotik (Umum, Anak, Obgyn)
('TND-011', '01'),
('TND-011', '03'),
('TND-011', '04'),

-- TND-012: Penanganan Epistaksis (Umum, Anak)
('TND-012', '01'),
('TND-012', '03'),

-- TND-013: Transfusi Darah (PRC) (Umum, Obgyn)
('TND-013', '01'),
('TND-013', '04'),

-- TND-014: Pembersihan Karang Gigi (Gigi)
('TND-014', '02'),

-- TND-015: Penambalan Gigi (Gigi)
('TND-015', '02'),

-- TND-016: Pemeriksaan Refraksi & Mata (Mata)
('TND-016', '05')
ON CONFLICT DO NOTHING;

-- Tindakan ICD-9 Mappings
INSERT INTO emr.tindakan_icd9_mapping (kode_tindakan, icd9_code, is_primary) VALUES
('TND-001', '89.02', true), -- Pemeriksaan Umum -> Wawancara dan evaluasi, terbatas
('TND-002', '89.03', true), -- Pemeriksaan Gigi -> Wawancara dan evaluasi, komprehensif
('TND-003', '23.09', true), -- Cabut Gigi -> Pencabutan Gigi Lainnya
('TND-004', '88.78', true), -- USG Kandungan -> USG Kandungan
('TND-005', '90.59', true), -- Cek Gula Darah -> Pemeriksaan mikroskopik darah
('TND-006', '86.59', true), -- Jahit Luka -> Jahit Luka
('TND-007', '89.52', true), -- Rekam Jantung (EKG) -> Elektrokardiogram
('TND-008', '93.94', true), -- Terapi Nebulisasi -> Pemberian obat pernapasan dengan nebulizer
('TND-009', '10.0', true),  -- Ekstraksi Benda Asing Mata -> Pengangkatan benda asing dari konjungtiva dengan insisi
('TND-010', '87.44', true), -- Rontgen Dada -> Rontgen Dada
('TND-011', '99.21', true), -- Injeksi Antibiotik -> Injeksi antibiotik
('TND-012', '21.01', true), -- Tampon Hidung Epistaksis -> Kontrol epistaksis dengan tampon hidung anterior
('TND-013', '99.04', true), -- Transfusi Darah -> Transfusi sel darah merah
('TND-014', '96.54', true), -- Pembersihan Karang Gigi -> Dental scaling and polishing
('TND-015', '23.2', true),  -- Penambalan Gigi -> Restoration of tooth by filling
('TND-016', '95.02', true)  -- Pemeriksaan Refraksi Mata -> Comprehensive eye examination
ON CONFLICT (kode_tindakan, icd9_code) DO NOTHING;

-- KBM to ICD-10 Mappings
INSERT INTO emr.kbm_icd10_mappings (kbm_code, icd10_code, is_primary, mapping_confidence) VALUES
-- KBM-001: Demam Tinggi
('KBM-001', 'A01.0', true, '0.95'),
('KBM-001', 'A91', false, '0.90'),
('KBM-001', 'A90', false, '0.85'),
('KBM-001', 'R50.9', false, '0.85'),
('KBM-001', 'R56.0', false, '0.80'),

-- KBM-011: Batuk Berdahak
('KBM-011', 'J06.9', true, '0.95'),
('KBM-011', 'J00', false, '0.85'),
('KBM-011', 'J18.9', false, '0.90'),
('KBM-011', 'J20.9', false, '0.85'),
('KBM-011', 'R05', false, '0.90'),
('KBM-011', 'A15.0', false, '0.80'),

-- KBM-021: Nyeri Perut
('KBM-021', 'K29.7', true, '0.95'),
('KBM-021', 'K21.9', false, '0.85'),
('KBM-021', 'K35.8', false, '0.90'),
('KBM-021', 'K80.2', false, '0.80'),
('KBM-021', 'K27.9', false, '0.80'),

-- KBM-031: Sakit Kepala Berat
('KBM-031', 'G43.9', true, '0.95'),
('KBM-031', 'I10', false, '0.90'),
('KBM-031', 'R51', false, '0.90'),
('KBM-031', 'E11.9', false, '0.85'),
('KBM-031', 'E11.8', false, '0.85'),

-- KBM-041: Nyeri Gigi & Gusi
('KBM-041', 'K02.9', true, '0.95'),
('KBM-041', 'K04.0', false, '0.90'),
('KBM-041', 'K04.7', false, '0.90'),
('KBM-041', 'K05.3', false, '0.85'),
('KBM-041', 'K03.6', false, '0.80'),
('KBM-041', 'K01.1', false, '0.80'),

-- KBM-051: Mata Merah & Gangguan Penglihatan
('KBM-051', 'H10.9', true, '0.95'),
('KBM-051', 'H00.0', false, '0.90'),
('KBM-051', 'H25.9', false, '0.90'),
('KBM-051', 'H52.1', false, '0.85'),
('KBM-051', 'H11.0', false, '0.85'),
('KBM-051', 'H40.9', false, '0.80'),

-- KBM-061: Keluhan Kehamilan & Nyeri Panggul
('KBM-061', 'O20.0', true, '0.95'),
('KBM-061', 'N94.6', false, '0.90'),
('KBM-061', 'O80.9', false, '0.85'),
('KBM-061', 'E28.2', false, '0.80'),
('KBM-061', 'O21.0', false, '0.85'),
('KBM-061', 'O14.0', false, '0.85'),
('KBM-061', 'Z34.0', false, '0.90'),

-- KBM-071: Sesak Napas & Mengi
('KBM-071', 'J45.9', true, '0.95'),
('KBM-071', 'J18.9', false, '0.90'),
('KBM-071', 'J20.9', false, '0.85'),
('KBM-071', 'J21.9', false, '0.85'),

-- KBM-081: Gatal & Ruam Kulit
('KBM-081', 'L50.9', true, '0.95'),
('KBM-081', 'L20.9', false, '0.90'),
('KBM-081', 'B01.9', false, '0.85'),
('KBM-081', 'B86', false, '0.90'),
('KBM-081', 'B35.9', false, '0.85'),

-- KBM-091: Nyeri Sendi & Pegal Linu
('KBM-091', 'M54.5', true, '0.95'),
('KBM-091', 'M19.9', false, '0.90'),
('KBM-091', 'M10.9', false, '0.90'),
('KBM-091', 'M14.8*', false, '0.80'),

-- KBM-101: Diare & Gangguan Saluran Cerna
('KBM-101', 'A09', true, '0.95'),
('KBM-101', 'A00.0', false, '0.90'),
('KBM-101', 'K27.9', false, '0.80')
ON CONFLICT (kbm_code, icd10_code) DO NOTHING;

-- ==========================================
-- SNOMED-CT CLINICAL CORE CATALOG & CROSS MAPS
-- ==========================================
INSERT INTO emr.snomed_concepts (concept_id, fsn, term_id, semantic_tag, is_active) VALUES
-- Penyakit & Gangguan Klinis (Disorders & Findings)
('4834000', 'Typhoid fever (disorder)', 'Demam Tifoid', 'disorder', true),
('38362002', 'Dengue fever (disorder)', 'Demam Berdarah Dengue (DBD)', 'disorder', true),
('38341003', 'Hypertensive disorder, systemic arterial (disorder)', 'Hipertensi Primer / Esensial', 'disorder', true),
('44054006', 'Type 2 diabetes mellitus (disorder)', 'Diabetes Melitus Tipe 2', 'disorder', true),
('195967001', 'Asthma (disorder)', 'Asma Bronkial', 'disorder', true),
('74400008', 'Appendicitis (disorder)', 'Apendisitis Akut', 'disorder', true),
('233604007', 'Pneumonia (disorder)', 'Pneumonia Bakterial', 'disorder', true),
('50417007', 'Gastroenteritis (disorder)', 'Gastroenteritis Akut (Diare)', 'disorder', true),
('53741008', 'Coronary arteriosclerosis (disorder)', 'Penyakit Jantung Koroner', 'disorder', true),
('80967001', 'Dental caries (disorder)', 'Karies Gigi', 'disorder', true),
('398447008', 'Pulpitis (disorder)', 'Pulpitis (Radang Pulpa Gigi)', 'disorder', true),
('70634000', 'Periapical abscess (disorder)', 'Abses Periapikal Gigi', 'disorder', true),
('77176002', 'Periodontitis (disorder)', 'Periodontitis Kronis', 'disorder', true),
('9826008', 'Conjunctivitis (disorder)', 'Konjungtivitis', 'disorder', true),
('193570009', 'Cataract (disorder)', 'Katarak Senilis', 'disorder', true),
('57190000', 'Myopia (disorder)', 'Miopia (Rabun Jauh)', 'disorder', true),
('42106001', 'Pterygium of eye (disorder)', 'Pterigium Mata', 'disorder', true),
('23986001', 'Glaucoma (disorder)', 'Glaukoma', 'disorder', true),
('198992004', 'Threatened abortion (disorder)', 'Ancaman Keguguran (Abortus Imminens)', 'disorder', true),
('33940009', 'Dysmenorrhea (disorder)', 'Dismenore (Nyeri Haid)', 'disorder', true),
('225544001', 'Polycystic ovary syndrome (disorder)', 'PCOS (Sindrom Ovarium Polikistik)', 'disorder', true),
('237055002', 'Gestational diabetes mellitus (disorder)', 'Diabetes Melitus Gestasional', 'disorder', true),
('198953006', 'Pregnancy-induced hypertension (disorder)', 'Hipertensi Gestasional', 'disorder', true),
('386661006', 'Fever (finding)', 'Demam', 'finding', true),
('49727002', 'Cough (finding)', 'Batuk', 'finding', true),
('25064002', 'Headache (finding)', 'Sakit Kepala', 'finding', true),
('10509002', 'Acute nasopharyngitis (disorder)', 'Nasofaringitis Akut (Common Cold)', 'disorder', true),
('54150009', 'Acute upper respiratory infection (disorder)', 'Infeksi Saluran Pernapasan Atas Akut (ISPA)', 'disorder', true),
('4556007', 'Gastritis (disorder)', 'Gastritis', 'disorder', true),
('235595009', 'Gastroesophageal reflux disease (disorder)', 'GERD', 'disorder', true),
('279039007', 'Low back pain (finding)', 'Nyeri Punggung Bawah (LBP)', 'finding', true),
('399211009', 'Osteoarthritis (disorder)', 'Osteoartritis', 'disorder', true),
('126485001', 'Urticaria (disorder)', 'Urtikaria (Biduran)', 'disorder', true),
('24079001', 'Atopic dermatitis (disorder)', 'Dermatitis Atopik', 'disorder', true),
('68566005', 'Urinary tract infection (disorder)', 'Infeksi Saluran Kemih (ISK)', 'disorder', true),
('90560007', 'Gout (disorder)', 'Penyakit Asam Urat (Gout)', 'disorder', true),
('41420007', 'Febrile convulsion (disorder)', 'Kejang Demam', 'disorder', true),

-- Prosedur & Tindakan Klinis (Procedures)
('274151003', 'Extraction of tooth (procedure)', 'Pencabutan Gigi', 'procedure', true),
('265747005', 'Diagnostic ultrasound of pregnancy (procedure)', 'USG Kehamilan / Kandungan', 'procedure', true),
('104091002', 'Measurement of blood glucose (procedure)', 'Pemeriksaan Gula Darah', 'procedure', true),
('225965007', 'Suture of skin (procedure)', 'Penjahitan Luka Kulit', 'procedure', true),
('386053000', 'Evaluation procedure (procedure)', 'Pemeriksaan Medis Umum', 'procedure', true),
('29303009', 'Electrocardiographic procedure (procedure)', 'Rekam Jantung (EKG)', 'procedure', true),
('410206007', 'Inhalation therapy (procedure)', 'Terapi Inhalasi / Nebulisasi', 'procedure', true),
('284210009', 'Removal of foreign body from conjunctiva (procedure)', 'Ekstraksi Benda Asing Konjungtiva', 'procedure', true),
('399208008', 'Plain chest X-ray (procedure)', 'Foto Rontgen Dada / Thorax', 'procedure', true),
('281789004', 'Antibiotic therapy (procedure)', 'Injeksi / Terapi Antibiotik', 'procedure', true),
('182832007', 'Procedure on nose (procedure)', 'Tampon Hidung Anterior (Epistaksis)', 'procedure', true),
('396154006', 'Transfusion of packed red blood cells (procedure)', 'Transfusi Sel Darah Merah (PRC)', 'procedure', true),
('232585006', 'Scaling of teeth (procedure)', 'Pembersihan Karang Gigi / Scaling', 'procedure', true),
('113040004', 'Restoration of tooth (procedure)', 'Penambalan / Restorasi Gigi', 'procedure', true),
('397524001', 'Comprehensive eye examination (procedure)', 'Pemeriksaan Refraksi & Mata Lengkap', 'procedure', true)
ON CONFLICT (concept_id) DO NOTHING;

-- SNOMED-CT to ICD-10 Mappings
INSERT INTO emr.snomed_icd10_mapping (snomed_concept_id, icd10_code, map_group, map_priority, map_rule, map_advice, is_primary) VALUES
('4834000', 'A01.0', 1, 1, 'TRUE', 'ALWAYS A01.0', true),
('38362002', 'A91', 1, 1, 'TRUE', 'ALWAYS A91', true),
('38341003', 'I10', 1, 1, 'TRUE', 'ALWAYS I10', true),
('44054006', 'E11.9', 1, 1, 'TRUE', 'ALWAYS E11.9', true),
('195967001', 'J45.9', 1, 1, 'TRUE', 'ALWAYS J45.9', true),
('74400008', 'K35.8', 1, 1, 'TRUE', 'ALWAYS K35.8', true),
('233604007', 'J18.9', 1, 1, 'TRUE', 'ALWAYS J18.9', true),
('50417007', 'A09', 1, 1, 'TRUE', 'ALWAYS A09', true),
('80967001', 'K02.9', 1, 1, 'TRUE', 'ALWAYS K02.9', true),
('398447008', 'K04.0', 1, 1, 'TRUE', 'ALWAYS K04.0', true),
('70634000', 'K04.7', 1, 1, 'TRUE', 'ALWAYS K04.7', true),
('77176002', 'K05.3', 1, 1, 'TRUE', 'ALWAYS K05.3', true),
('9826008', 'H10.9', 1, 1, 'TRUE', 'ALWAYS H10.9', true),
('193570009', 'H25.9', 1, 1, 'TRUE', 'ALWAYS H25.9', true),
('57190000', 'H52.1', 1, 1, 'TRUE', 'ALWAYS H52.1', true),
('42106001', 'H11.0', 1, 1, 'TRUE', 'ALWAYS H11.0', true),
('23986001', 'H40.9', 1, 1, 'TRUE', 'ALWAYS H40.9', true),
('198992004', 'O20.0', 1, 1, 'TRUE', 'ALWAYS O20.0', true),
('33940009', 'N94.6', 1, 1, 'TRUE', 'ALWAYS N94.6', true),
('225544001', 'E28.2', 1, 1, 'TRUE', 'ALWAYS E28.2', true),
('237055002', 'O24.4', 1, 1, 'TRUE', 'ALWAYS O24.4', true),
('198953006', 'O13', 1, 1, 'TRUE', 'ALWAYS O13', true),
('386661006', 'R50.9', 1, 1, 'TRUE', 'ALWAYS R50.9', true),
('49727002', 'R05', 1, 1, 'TRUE', 'ALWAYS R05', true),
('25064002', 'R51', 1, 1, 'TRUE', 'ALWAYS R51', true),
('10509002', 'J00', 1, 1, 'TRUE', 'ALWAYS J00', true),
('54150009', 'J06.9', 1, 1, 'TRUE', 'ALWAYS J06.9', true),
('4556007', 'K29.7', 1, 1, 'TRUE', 'ALWAYS K29.7', true),
('235595009', 'K21.9', 1, 1, 'TRUE', 'ALWAYS K21.9', true),
('279039007', 'M54.5', 1, 1, 'TRUE', 'ALWAYS M54.5', true),
('399211009', 'M19.9', 1, 1, 'TRUE', 'ALWAYS M19.9', true),
('126485001', 'L50.9', 1, 1, 'TRUE', 'ALWAYS L50.9', true),
('24079001', 'L20.9', 1, 1, 'TRUE', 'ALWAYS L20.9', true),
('68566005', 'N39.0', 1, 1, 'TRUE', 'ALWAYS N39.0', true),
('90560007', 'M10.9', 1, 1, 'TRUE', 'ALWAYS M10.9', true),
('41420007', 'R56.0', 1, 1, 'TRUE', 'ALWAYS R56.0', true)
ON CONFLICT (snomed_concept_id, icd10_code) DO NOTHING;

-- SNOMED-CT to ICD-9-CM Mappings
INSERT INTO emr.snomed_icd9_mapping (snomed_concept_id, icd9_code, is_primary) VALUES
('274151003', '23.09', true),
('265747005', '88.78', true),
('104091002', '90.59', true),
('225965007', '86.59', true),
('386053000', '89.02', true),
('29303009', '89.52', true),
('410206007', '93.94', true),
('284210009', '10.0', true),
('399208008', '87.44', true),
('281789004', '99.21', true),
('182832007', '21.01', true),
('396154006', '99.04', true),
('232585006', '96.54', true),
('113040004', '23.2', true),
('397524001', '95.02', true)
ON CONFLICT (snomed_concept_id, icd9_code) DO NOTHING;

-- Mappings Pharmacy (Inventory to Polyclinic)
INSERT INTO pharmacy.inventory_polyclinic_mappings (item_code, polyclinic_code) VALUES
-- OBT-001: Paracetamol (Umum, Gigi, Anak, Obgyn, Mata)
('OBT-001', '01'),
('OBT-001', '02'),
('OBT-001', '03'),
('OBT-001', '04'),
('OBT-001', '05'),

-- OBT-002: Amoxicillin (Umum, Gigi, Anak, Obgyn, Mata)
('OBT-002', '01'),
('OBT-002', '02'),
('OBT-002', '03'),
('OBT-002', '04'),
('OBT-002', '05'),

-- OBT-003: Omeprazole (Umum, Obgyn)
('OBT-003', '01'),
('OBT-003', '04'),

-- OBT-004: Loratadine (Umum, Anak, Mata)
('OBT-004', '01'),
('OBT-004', '03'),
('OBT-004', '05'),

-- OBT-005: Vitamin C (Umum, Anak, Obgyn, Mata)
('OBT-005', '01'),
('OBT-005', '03'),
('OBT-005', '04'),
('OBT-005', '05'),

-- OBT-006: Metformin (Umum - PRB DM2, Obgyn - PCOS)
('OBT-006', '01'),
('OBT-006', '04'),

-- OBT-007: Amlodipine (Umum - PRB Hipertensi)
('OBT-007', '01'),

-- OBT-008: Ceftriaxone (Umum - Tindakan/IGD, Obgyn - Bedah/Pelvis)
('OBT-008', '01'),
('OBT-008', '04'),

-- OBT-009: Salbutamol Inhaler (Umum - PRB Asma/PPOK, Anak - Asma)
('OBT-009', '01'),
('OBT-009', '03'),

-- OBT-010: Antasida DOEN (Umum, Anak)
('OBT-010', '01'),
('OBT-010', '03'),

-- OBT-011: Ibuprofen (Umum - Nyeri/Artritis, Gigi - Bedah Mulut, Obgyn - Dismenore)
('OBT-011', '01'),
('OBT-011', '02'),
('OBT-011', '04'),

-- OBT-012: Dexamethasone (Umum, Anak, Mata - Uveitis/Radang Orbita)
('OBT-012', '01'),
('OBT-012', '03'),
('OBT-012', '05')
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

