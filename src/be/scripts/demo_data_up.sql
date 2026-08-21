INSERT INTO auth.users (username, password_hash, role, status, force_change_password) 
VALUES ('admin', '$2a$10$GNH3TS1dB.F4X7lU1IFDNO4PLZgaHrow4Lp81FjjGme0L5VtKfVwG', 'admin', 'ACTIVE', true)
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, status = EXCLUDED.status, force_change_password = EXCLUDED.force_change_password;

-- Insert Patient Demo Data
INSERT INTO patient.patients (mrn, name, nik, dob, gender, birth_place, address) 
VALUES 
('RM-000001', 'Budi Santoso', '3201010101900001', '1990-01-01', 'Laki-laki', 'Jakarta', 'Jl. Merdeka No 1'),
('RM-000002', 'Siti Aminah', '3201010101920002', '1992-02-02', 'Perempuan', 'Bandung', 'Jl. Asia Afrika No 2'),
('RM-000003', 'Andi Pratama', '3201010101950003', '1995-03-03', 'Laki-laki', 'Surabaya', 'Jl. Pahlawan No 3')
ON CONFLICT (mrn) DO NOTHING;
