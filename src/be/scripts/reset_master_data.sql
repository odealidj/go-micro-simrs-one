-- ==========================================
-- MASTER DATA RESET FOR SIMRS
-- ==========================================

-- 1. Pharmacy Schema
TRUNCATE TABLE pharmacy.inventory_kfa_mapping CASCADE;
TRUNCATE TABLE pharmacy.inventory_polyclinic_mappings CASCADE;
TRUNCATE TABLE pharmacy.inventory CASCADE;
TRUNCATE TABLE pharmacy.kfa_catalog CASCADE;
TRUNCATE TABLE pharmacy.bpjs_dpho_catalog CASCADE;

-- 2. Rawat Jalan Schema
TRUNCATE TABLE rawat_jalan.icd10_polyclinic_mappings CASCADE;
TRUNCATE TABLE rawat_jalan.tindakan_polyclinic_mappings CASCADE;
TRUNCATE TABLE rawat_jalan.kbm_polyclinic_mappings CASCADE;
TRUNCATE TABLE rawat_jalan.tindakan_icd9_mapping CASCADE;
TRUNCATE TABLE rawat_jalan.kbm_icd10_mappings CASCADE;
TRUNCATE TABLE rawat_jalan.snomed_icd10_mapping CASCADE;
TRUNCATE TABLE rawat_jalan.snomed_icd9_mapping CASCADE;
TRUNCATE TABLE rawat_jalan.snomed_concepts CASCADE;
TRUNCATE TABLE rawat_jalan.master_tindakan CASCADE;
TRUNCATE TABLE rawat_jalan.icd10_catalog CASCADE;
TRUNCATE TABLE rawat_jalan.icd9cm_catalog CASCADE;
TRUNCATE TABLE rawat_jalan.kbm_catalog CASCADE;
TRUNCATE TABLE rawat_jalan.polyclinics CASCADE;

-- 3. Medical Record Schema
TRUNCATE TABLE medical_record.snomed_icd9_mapping CASCADE;
TRUNCATE TABLE medical_record.snomed_icd10_mapping CASCADE;
TRUNCATE TABLE medical_record.snomed_concepts CASCADE;
TRUNCATE TABLE medical_record.tindakan_icd9_mapping CASCADE;
TRUNCATE TABLE medical_record.icd9cm_catalog CASCADE;
TRUNCATE TABLE medical_record.kbm_icd10_mappings CASCADE;
TRUNCATE TABLE medical_record.icd10_polyclinic_mappings CASCADE;
TRUNCATE TABLE medical_record.tindakan_polyclinic_mappings CASCADE;
TRUNCATE TABLE medical_record.kbm_polyclinic_mappings CASCADE;
TRUNCATE TABLE medical_record.master_tindakan CASCADE;
TRUNCATE TABLE medical_record.icd10_catalog CASCADE;
TRUNCATE TABLE medical_record.kbm_catalog CASCADE;
TRUNCATE TABLE medical_record.polyclinics CASCADE;

-- 4. Legacy EMR Schema
TRUNCATE TABLE emr.snomed_icd9_mapping CASCADE;
TRUNCATE TABLE emr.snomed_icd10_mapping CASCADE;
TRUNCATE TABLE emr.snomed_concepts CASCADE;
TRUNCATE TABLE emr.tindakan_icd9_mapping CASCADE;
TRUNCATE TABLE emr.icd9cm_catalog CASCADE;
TRUNCATE TABLE emr.kbm_icd10_mappings CASCADE;
TRUNCATE TABLE emr.icd10_polyclinic_mappings CASCADE;
TRUNCATE TABLE emr.tindakan_polyclinic_mappings CASCADE;
TRUNCATE TABLE emr.kbm_polyclinic_mappings CASCADE;
TRUNCATE TABLE emr.master_tindakan CASCADE;
TRUNCATE TABLE emr.icd10_catalog CASCADE;
TRUNCATE TABLE emr.kbm_catalog CASCADE;
TRUNCATE TABLE emr.polyclinics CASCADE;

-- 5. Auth Schema
TRUNCATE TABLE auth.mapping_dokter_poli CASCADE;
TRUNCATE TABLE auth.mapping_perawat_poli CASCADE;
TRUNCATE TABLE auth.profil_dokter CASCADE;
TRUNCATE TABLE auth.profil_perawat CASCADE;
TRUNCATE TABLE auth.staff_profiles CASCADE;

-- Hard delete all users except admin and superadmin
DELETE FROM auth.users WHERE role NOT IN ('admin', 'super_admin') OR role IS NULL;

-- Hard delete all roles except super_admin and admin
DELETE FROM auth.master_role WHERE id NOT IN ('super_admin', 'admin');
