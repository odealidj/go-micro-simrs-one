-- name: CreatePatient :one
INSERT INTO patients (mrn, name, nik, dob, user_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING mrn, name, nik, dob, user_id, created_at;

-- name: GetPatientByMRN :one
SELECT mrn, name, nik, dob, user_id, created_at
FROM patients
WHERE mrn = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: GetPatientByNIK :one
SELECT mrn, name, nik, dob, user_id, created_at
FROM patients
WHERE nik = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: UpdatePatientUserID :exec
UPDATE patients
SET user_id = $2
WHERE mrn = $1 AND deleted_dt IS NULL;
