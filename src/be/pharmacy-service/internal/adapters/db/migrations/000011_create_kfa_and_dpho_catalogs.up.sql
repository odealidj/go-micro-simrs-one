-- 1. Create KFA Catalog Table (Kamus Farmasi & Alkes Kemenkes RI - SATUSEHAT FHIR)
CREATE TABLE IF NOT EXISTS kfa_catalog (
    kfa_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active_substance VARCHAR(255),
    dosage_form VARCHAR(100),
    strength VARCHAR(100),
    bpom_nie VARCHAR(100),
    atc_code VARCHAR(50),
    snomed_concept_id VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_dt TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

CREATE INDEX IF NOT EXISTS idx_kfa_name ON kfa_catalog(name);
CREATE INDEX IF NOT EXISTS idx_kfa_substance ON kfa_catalog(active_substance);

-- 2. Create BPJS DPHO Catalog Table (Daftar & Plafon Harga Obat / FORNAS)
CREATE TABLE IF NOT EXISTS bpjs_dpho_catalog (
    dpho_code VARCHAR(50) PRIMARY KEY,
    dpho_name VARCHAR(255) NOT NULL,
    is_fornas BOOLEAN NOT NULL DEFAULT true,
    is_prb BOOLEAN NOT NULL DEFAULT false,
    restriction TEXT,
    max_qty_per_claim INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_dt TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

CREATE INDEX IF NOT EXISTS idx_dpho_name ON bpjs_dpho_catalog(dpho_name);

-- 3. Create Cross-Map Table between Inventory (SIMRS Internal) and KFA + BPJS DPHO
CREATE TABLE IF NOT EXISTS inventory_kfa_mapping (
    item_code VARCHAR(100) NOT NULL REFERENCES inventory(item_code) ON DELETE CASCADE,
    kfa_code VARCHAR(50) NOT NULL REFERENCES kfa_catalog(kfa_code) ON DELETE CASCADE,
    dpho_code VARCHAR(50) REFERENCES bpjs_dpho_catalog(dpho_code) ON DELETE SET NULL,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    mapping_confidence DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_dt TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    PRIMARY KEY (item_code, kfa_code)
);

CREATE INDEX IF NOT EXISTS idx_inv_kfa_item ON inventory_kfa_mapping(item_code);
CREATE INDEX IF NOT EXISTS idx_inv_kfa_kfa ON inventory_kfa_mapping(kfa_code);

-- 4. Seed Standard KFA Catalog Dataset
INSERT INTO kfa_catalog (kfa_code, name, active_substance, dosage_form, strength, bpom_nie, atc_code, snomed_concept_id) VALUES
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

-- 5. Seed BPJS DPHO Catalog Dataset (Formularium Nasional / BPJS)
INSERT INTO bpjs_dpho_catalog (dpho_code, dpho_name, is_fornas, is_prb, restriction, max_qty_per_claim) VALUES
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

-- 6. Seed Additional Inventory Items
INSERT INTO inventory (item_code, name, stock_quantity, price) VALUES
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
ON CONFLICT (item_code) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;

-- 7. Seed Initial Cross-Mappings (Inventory -> KFA & DPHO)
INSERT INTO inventory_kfa_mapping (item_code, kfa_code, dpho_code, is_primary, mapping_confidence) VALUES
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

-- Also seed for MED-001 to MED-005 if present
INSERT INTO inventory_kfa_mapping (item_code, kfa_code, dpho_code, is_primary, mapping_confidence)
SELECT 'MED-001', '93000108', 'DPHO-001', true, 100.00 WHERE EXISTS (SELECT 1 FROM inventory WHERE item_code = 'MED-001')
ON CONFLICT DO NOTHING;

INSERT INTO inventory_kfa_mapping (item_code, kfa_code, dpho_code, is_primary, mapping_confidence)
SELECT 'MED-002', '93000215', 'DPHO-002', true, 100.00 WHERE EXISTS (SELECT 1 FROM inventory WHERE item_code = 'MED-002')
ON CONFLICT DO NOTHING;

INSERT INTO inventory_kfa_mapping (item_code, kfa_code, dpho_code, is_primary, mapping_confidence)
SELECT 'MED-003', '93000567', NULL, true, 100.00 WHERE EXISTS (SELECT 1 FROM inventory WHERE item_code = 'MED-003')
ON CONFLICT DO NOTHING;

INSERT INTO inventory_kfa_mapping (item_code, kfa_code, dpho_code, is_primary, mapping_confidence)
SELECT 'MED-004', '93001123', 'DPHO-010', true, 100.00 WHERE EXISTS (SELECT 1 FROM inventory WHERE item_code = 'MED-004')
ON CONFLICT DO NOTHING;

INSERT INTO inventory_kfa_mapping (item_code, kfa_code, dpho_code, is_primary, mapping_confidence)
SELECT 'MED-005', '93000342', 'DPHO-003', true, 100.00 WHERE EXISTS (SELECT 1 FROM inventory WHERE item_code = 'MED-005')
ON CONFLICT DO NOTHING;
