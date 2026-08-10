-- name: CreatePatient :one
INSERT INTO patients (mrn, name, nik, dob)
VALUES ($1, $2, $3, $4)
RETURNING mrn, name, nik, dob, created_at;

-- name: GetPatientByMRN :one
SELECT mrn, name, nik, dob, created_at
FROM patients
WHERE mrn = $1 LIMIT 1;
