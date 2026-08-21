-- ==========================================
-- MASTER DATA RESET FOR SIMRS
-- ==========================================

TRUNCATE TABLE pharmacy.inventory_polyclinic_mappings CASCADE;
TRUNCATE TABLE pharmacy.inventory CASCADE;
TRUNCATE TABLE emr.kbm_icd10_mappings CASCADE;
TRUNCATE TABLE emr.icd10_polyclinic_mappings CASCADE;
TRUNCATE TABLE emr.tindakan_polyclinic_mappings CASCADE;
TRUNCATE TABLE emr.kbm_polyclinic_mappings CASCADE;
TRUNCATE TABLE emr.master_tindakan CASCADE;
TRUNCATE TABLE emr.icd10_catalog CASCADE;
TRUNCATE TABLE emr.kbm_catalog CASCADE;
TRUNCATE TABLE emr.polyclinics CASCADE;

TRUNCATE TABLE auth.mapping_dokter_poli CASCADE;
TRUNCATE TABLE auth.mapping_perawat_poli CASCADE;
TRUNCATE TABLE auth.profil_dokter CASCADE;
TRUNCATE TABLE auth.profil_perawat CASCADE;
TRUNCATE TABLE auth.staff_profiles CASCADE;

-- Hard delete all users except admin and superadmin
DELETE FROM auth.users WHERE role NOT IN ('admin', 'super_admin') OR role IS NULL;

-- Hard delete all roles except super_admin and admin
DELETE FROM auth.master_role WHERE id NOT IN ('super_admin', 'admin');
