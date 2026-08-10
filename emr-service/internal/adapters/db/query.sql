-- name: CreateDraftMR :one
INSERT INTO medical_records (id, encounter_no, mrn)
VALUES ($1, $2, $3)
RETURNING id, encounter_no, mrn, icd10_codes, notes, created_at, updated_at;

-- name: AddDiagnosis :one
UPDATE medical_records
SET icd10_codes = array_append(COALESCE(icd10_codes, ARRAY[]::TEXT[]), $2), notes = $3, updated_at = CURRENT_TIMESTAMP
WHERE encounter_no = $1
RETURNING id, encounter_no, mrn, icd10_codes, notes, created_at, updated_at;

-- name: GetMRByEncounterNo :one
SELECT id, encounter_no, mrn, icd10_codes, notes, created_at, updated_at
FROM medical_records
WHERE encounter_no = $1 LIMIT 1;
