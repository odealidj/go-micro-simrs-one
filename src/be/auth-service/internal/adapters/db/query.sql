-- name: GetUserByUsername :one
SELECT id, username, password_hash, role, status, force_change_password, last_login_at, created_at, updated_at
FROM users
WHERE username = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: GetUserByID :one
SELECT id, username, password_hash, role, status, force_change_password, last_login_at, created_at, updated_at
FROM users
WHERE id = $1 AND deleted_dt IS NULL LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (username, password_hash, role, status, force_change_password)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, username, password_hash, role, status, force_change_password, last_login_at, created_at, updated_at;

-- name: CreateStaffProfile :one
INSERT INTO staff_profiles (user_id, nip, email, phone)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, nip, email, phone, created_at, updated_at;

-- name: ListUsersWithProfile :many
SELECT u.id, u.username, u.role, u.status, u.created_at, 
       s.nip, s.email, s.phone
FROM users u
LEFT JOIN staff_profiles s ON u.id = s.user_id
WHERE u.deleted_dt IS NULL
  AND ($1::text = '' OR u.status = $1)
ORDER BY u.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUsersWithProfile :one
SELECT COUNT(u.id)
FROM users u
WHERE u.deleted_dt IS NULL
  AND ($1::text = '' OR u.status = $1);

-- name: UpdateUserStatusAndRole :exec
UPDATE users
SET status = $2, role = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_dt IS NULL;

-- name: SoftDeleteUser :exec
UPDATE users
SET deleted_dt = CURRENT_TIMESTAMP, deleted_by = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_dt IS NULL;

-- name: UpdateLastLogin :exec
UPDATE users
SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_dt IS NULL;

-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id, user_id, token_hash, expires_at, created_at;

-- name: GetRefreshToken :one
SELECT id, user_id, token_hash, expires_at, created_at
FROM refresh_tokens
WHERE token_hash = $1 LIMIT 1;

-- name: DeleteRefreshToken :exec
DELETE FROM refresh_tokens
WHERE token_hash = $1;

-- name: GetMasterRoles :many
SELECT id, deskripsi 
FROM master_role
WHERE deleted_dt IS NULL
  AND id != 'super_admin'
  AND ($1::text = '' OR id ILIKE '%' || $1 || '%' OR deskripsi ILIKE '%' || $1 || '%')
ORDER BY id
LIMIT $2 OFFSET $3;

-- name: CountMasterRoles :one
SELECT COUNT(id) 
FROM master_role
WHERE deleted_dt IS NULL
  AND id != 'super_admin'
  AND ($1::text = '' OR id ILIKE '%' || $1 || '%' OR deskripsi ILIKE '%' || $1 || '%');

-- name: GetDoctors :many
SELECT d.id, u.username, s.nip, s.email, d.spesialisasi, d.sip, u.status, m.poli_code, m.start_date, m.end_date
FROM profil_dokter d
JOIN users u ON d.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
LEFT JOIN mapping_dokter_poli m ON d.id = m.dokter_id AND CURRENT_DATE BETWEEN m.start_date AND m.end_date AND m.deleted_dt IS NULL
WHERE u.deleted_dt IS NULL AND d.deleted_dt IS NULL
  AND ($1::text = '' OR u.username ILIKE '%' || $1 || '%' OR s.nip ILIKE '%' || $1 || '%')
ORDER BY u.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountDoctors :one
SELECT COUNT(d.id)
FROM profil_dokter d
JOIN users u ON d.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
WHERE u.deleted_dt IS NULL AND d.deleted_dt IS NULL
  AND ($1::text = '' OR u.username ILIKE '%' || $1 || '%' OR s.nip ILIKE '%' || $1 || '%');

-- name: GetNurses :many
SELECT p.id, u.username, s.nip, s.email, p.str_perawat, u.status, m.poli_code, m.start_date, m.end_date
FROM profil_perawat p
JOIN users u ON p.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
LEFT JOIN mapping_perawat_poli m ON p.id = m.perawat_id AND CURRENT_DATE BETWEEN m.start_date AND m.end_date AND m.deleted_dt IS NULL
WHERE u.deleted_dt IS NULL AND p.deleted_dt IS NULL
  AND ($1::text = '' OR u.username ILIKE '%' || $1 || '%' OR s.nip ILIKE '%' || $1 || '%')
ORDER BY u.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountNurses :one
SELECT COUNT(p.id)
FROM profil_perawat p
JOIN users u ON p.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
WHERE u.deleted_dt IS NULL AND p.deleted_dt IS NULL
  AND ($1::text = '' OR u.username ILIKE '%' || $1 || '%' OR s.nip ILIKE '%' || $1 || '%');

-- name: GetDoctorsByPoli :many
SELECT d.id, u.username, s.nip, d.spesialisasi, m.poli_code, m.start_date, m.end_date
FROM mapping_dokter_poli m
JOIN profil_dokter d ON m.dokter_id = d.id
JOIN users u ON d.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
WHERE u.deleted_dt IS NULL AND d.deleted_dt IS NULL AND m.deleted_dt IS NULL AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
  AND ($1::text = '' OR m.poli_code = $1)
  AND ($2::text = '' OR u.username ILIKE '%' || $2 || '%' OR s.nip ILIKE '%' || $2 || '%')
ORDER BY u.username
LIMIT $3 OFFSET $4;

-- name: CountDoctorsByPoli :one
SELECT COUNT(m.dokter_id)
FROM mapping_dokter_poli m
JOIN profil_dokter d ON m.dokter_id = d.id
JOIN users u ON d.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
WHERE u.deleted_dt IS NULL AND d.deleted_dt IS NULL AND m.deleted_dt IS NULL AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
  AND ($1::text = '' OR m.poli_code = $1)
  AND ($2::text = '' OR u.username ILIKE '%' || $2 || '%' OR s.nip ILIKE '%' || $2 || '%');

-- name: GetNursesByPoli :many
SELECT p.id, u.username, s.nip, p.str_perawat, m.poli_code, m.start_date, m.end_date
FROM mapping_perawat_poli m
JOIN profil_perawat p ON m.perawat_id = p.id
JOIN users u ON p.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
WHERE u.deleted_dt IS NULL AND p.deleted_dt IS NULL AND m.deleted_dt IS NULL AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
  AND ($1::text = '' OR m.poli_code = $1)
  AND ($2::text = '' OR u.username ILIKE '%' || $2 || '%' OR s.nip ILIKE '%' || $2 || '%')
ORDER BY u.username
LIMIT $3 OFFSET $4;

-- name: CountNursesByPoli :one
SELECT COUNT(m.perawat_id)
FROM mapping_perawat_poli m
JOIN profil_perawat p ON m.perawat_id = p.id
JOIN users u ON p.user_id = u.id
LEFT JOIN staff_profiles s ON u.id = s.user_id
WHERE u.deleted_dt IS NULL AND p.deleted_dt IS NULL AND m.deleted_dt IS NULL AND CURRENT_DATE BETWEEN m.start_date AND m.end_date
  AND ($1::text = '' OR m.poli_code = $1)
  AND ($2::text = '' OR u.username ILIKE '%' || $2 || '%' OR s.nip ILIKE '%' || $2 || '%');

-- name: CheckDoctorAssignmentOverlap :one
SELECT EXISTS (
    SELECT 1 FROM mapping_dokter_poli
    WHERE dokter_id = $1
      AND deleted_dt IS NULL
      AND start_date <= $3
      AND end_date >= $2
);

-- name: AssignDoctorToPoli :one
INSERT INTO mapping_dokter_poli (dokter_id, poli_code, start_date, end_date)
VALUES ($1, $2, $3, $4)
RETURNING id, dokter_id, poli_code, start_date, end_date;

-- name: CheckNurseAssignmentOverlap :one
SELECT EXISTS (
    SELECT 1 FROM mapping_perawat_poli
    WHERE perawat_id = $1
      AND deleted_dt IS NULL
      AND start_date <= $3
      AND end_date >= $2
);

-- name: AssignNurseToPoli :one
INSERT INTO mapping_perawat_poli (perawat_id, poli_code, start_date, end_date)
VALUES ($1, $2, $3, $4)
RETURNING id, perawat_id, poli_code, start_date, end_date;
