-- ==========================================
-- MASTER DATA RESET FOR SIMRS
-- ==========================================

-- Mappings
DELETE FROM pharmacy.inventory_polyclinic_mappings;
DELETE FROM emr.icd10_polyclinic_mappings;
DELETE FROM emr.tindakan_polyclinic_mappings;
DELETE FROM emr.kbm_polyclinic_mappings;

-- Master Data
DELETE FROM pharmacy.inventory;
DELETE FROM emr.master_tindakan;
DELETE FROM emr.icd10_catalog;

-- Note: auth.master_role is not deleted here because it is referenced by auth.users 
-- and deleting it would break existing user accounts.
