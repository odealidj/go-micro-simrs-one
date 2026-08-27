-- Insert a large seed of ICD-10 (For performance testing and full DB structure check)
-- This includes English and Indonesian names where applicable

INSERT INTO icd10_catalog (icd10_code, name, description) VALUES
('A00.0', 'Kolera akibat Vibrio cholerae 01, biotipe cholerae', 'Cholera due to Vibrio cholerae 01, biovar cholerae'),
('A00.1', 'Kolera akibat Vibrio cholerae 01, biotipe eltor', 'Cholera due to Vibrio cholerae 01, biovar eltor'),
('A01.0', 'Demam Tifoid', 'Typhoid fever'),
('A09', 'Diare dan gastroenteritis oleh penyebab infeksi tertentu', 'Diarrhoea and gastroenteritis of presumed infectious origin'),
('B01.9', 'Cacar air tanpa komplikasi', 'Varicella without complication'),
('B05.9', 'Campak tanpa komplikasi', 'Measles without complication'),
('B20', 'Penyakit HIV yang menyebabkan penyakit infeksi dan parasit', 'Human immunodeficiency virus [HIV] disease resulting in infectious and parasitic diseases'),
('B24', 'Penyakit HIV yang tidak ditentukan', 'Unspecified human immunodeficiency virus [HIV] disease'),
('C50.9', 'Neoplasma ganas payudara, tidak ditentukan', 'Malignant neoplasm: Breast, unspecified'),
('C53.9', 'Neoplasma ganas serviks uteri, tidak ditentukan', 'Malignant neoplasm: Cervix uteri, unspecified'),
('D50.9', 'Anemia defisiensi besi, tidak ditentukan', 'Iron deficiency anaemia, unspecified'),
('D64.9', 'Anemia, tidak ditentukan', 'Anaemia, unspecified'),
('E11.8', 'Diabetes mellitus tipe 2 dengan komplikasi lain', 'Type 2 diabetes mellitus with unspecified complications'),
('E11.9', 'Diabetes mellitus tipe 2 tanpa komplikasi', 'Type 2 diabetes mellitus without complications'),
('E78.5', 'Hiperlipidemia, tidak ditentukan', 'Hyperlipidaemia, unspecified'),
('F32.9', 'Episode depresi, tidak ditentukan', 'Depressive episode, unspecified'),
('F41.9', 'Gangguan kecemasan, tidak ditentukan', 'Anxiety disorder, unspecified'),
('G43.9', 'Migren, tidak ditentukan', 'Migraine, unspecified'),
('G47.0', 'Gangguan memulai dan mempertahankan tidur [insomnia]', 'Disorders of initiating and maintaining sleep [insomnias]'),
('H10.9', 'Konjungtivitis, tidak ditentukan', 'Conjunctivitis, unspecified'),
('H65.9', 'Otitis media non-supuratif, tidak ditentukan', 'Nonsuppurative otitis media, unspecified'),
('I10', 'Hipertensi esensial (primer)', 'Essential (primary) hypertension'),
('I50.0', 'Gagal jantung kongestif', 'Congestive heart failure'),
('I50.9', 'Gagal jantung, tidak ditentukan', 'Heart failure, unspecified'),
('I64', 'Stroke, tidak ditentukan sebagai pendarahan atau infark', 'Stroke, not specified as haemorrhage or infarction'),
('J00', 'Nasofaringitis akut [common cold]', 'Acute nasopharyngitis [common cold]'),
('J06.9', 'Infeksi saluran pernapasan atas akut, tidak ditentukan', 'Acute upper respiratory infection, unspecified'),
('J18.9', 'Pneumonia, tidak ditentukan', 'Pneumonia, unspecified'),
('J45.9', 'Asma, tidak ditentukan', 'Asthma, unspecified'),
('K21.9', 'Penyakit refluks gastro-esofagus tanpa esofagitis', 'Gastro-oesophageal reflux disease without oesophagitis'),
('K27.9', 'Tukak peptik, tidak ditentukan akut atau kronis', 'Peptic ulcer, unspecified as acute or chronic, without haemorrhage or perforation'),
('K29.7', 'Gastritis, tidak ditentukan', 'Gastritis, unspecified'),
('K35.8', 'Apendisitis akut lainnya dan tidak ditentukan', 'Other and unspecified acute appendicitis'),
('L20.9', 'Dermatitis atopik, tidak ditentukan', 'Atopic dermatitis, unspecified'),
('L23.9', 'Dermatitis kontak alergi, penyebab tidak ditentukan', 'Allergic contact dermatitis, unspecified cause'),
('M19.9', 'Osteoartritis, tidak ditentukan', 'Osteoarthritis, unspecified'),
('M54.5', 'Nyeri punggung bawah (Low back pain)', 'Low back pain'),
('N18.9', 'Penyakit ginjal kronis, tidak ditentukan', 'Chronic kidney disease, unspecified'),
('N39.0', 'Infeksi saluran kemih, lokasi tidak ditentukan', 'Urinary tract infection, site not specified'),
('O20.0', 'Ancaman keguguran', 'Threatened abortion'),
('O80.9', 'Persalinan spontan tunggal, tidak ditentukan', 'Single spontaneous delivery, unspecified'),
('R05', 'Batuk', 'Cough'),
('R07.4', 'Nyeri dada, tidak ditentukan', 'Chest pain, unspecified'),
('R50.9', 'Demam, tidak ditentukan', 'Fever, unspecified'),
('R51', 'Sakit kepala', 'Headache')
ON CONFLICT (icd10_code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Re-map the KBM codes to these new ICD10 structures
INSERT INTO kbm_icd10_mappings (kbm_code, icd10_code, is_primary, mapping_confidence) VALUES
('KBM-001', 'A01.0', true, 'HIGH'),
('KBM-011', 'J06.9', true, 'HIGH'),
('KBM-011', 'J00', false, 'MEDIUM'),
('KBM-021', 'I10', true, 'HIGH'),
('KBM-031', 'E11.9', true, 'HIGH'),
('KBM-031', 'E11.8', false, 'MEDIUM')
ON CONFLICT (kbm_code, icd10_code) DO UPDATE
SET is_primary = EXCLUDED.is_primary, mapping_confidence = EXCLUDED.mapping_confidence;
