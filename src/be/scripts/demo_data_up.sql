INSERT INTO auth.users (username, password_hash, role) 
VALUES ('admin', '$2a$10$906AdpcVocIGlBLDnW8bD.k1P84uaG3xOa.7ia2TebTRdzDHwH0Zy', 'admin')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;
