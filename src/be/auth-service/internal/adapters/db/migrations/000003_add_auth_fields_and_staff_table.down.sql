-- 000003_add_auth_fields_and_staff_table.down.sql
DROP TABLE IF EXISTS staff_profiles;

ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users DROP COLUMN deleted_by;
ALTER TABLE users DROP COLUMN deleted_dt;
ALTER TABLE users DROP COLUMN last_login_at;
ALTER TABLE users DROP COLUMN force_change_password;
ALTER TABLE users DROP COLUMN status;
