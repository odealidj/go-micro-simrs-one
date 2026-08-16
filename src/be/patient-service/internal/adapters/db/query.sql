-- name: CreatePatient :one
INSERT INTO patients (mrn, name, nik, dob, user_id, gender, birth_place, address, photo_url, email)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING mrn, name, nik, dob, user_id, gender, birth_place, address, photo_url, email, created_at;

-- name: GetPatientByMRN :one
SELECT mrn, name, nik, dob, user_id, gender, birth_place, address, photo_url, email, created_at
FROM patients
WHERE mrn = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: GetPatientByNIK :one
SELECT mrn, name, nik, dob, user_id, gender, birth_place, address, photo_url, email, created_at
FROM patients
WHERE nik = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: UpdatePatientUserID :exec
UPDATE patients
SET user_id = $2
WHERE mrn = $1 AND deleted_dt IS NULL;

-- name: ListPatients :many
SELECT mrn, name, nik, dob, user_id, gender, birth_place, address, photo_url, email, created_at
FROM patients
WHERE (name ILIKE $1 OR mrn ILIKE $1 OR nik ILIKE $1 OR email ILIKE $1) AND deleted_dt IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPatients :one
SELECT COUNT(*)
FROM patients
WHERE (name ILIKE $1 OR mrn ILIKE $1 OR nik ILIKE $1) AND deleted_dt IS NULL;
