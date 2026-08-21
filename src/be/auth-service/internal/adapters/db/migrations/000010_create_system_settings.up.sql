CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255)
);

INSERT INTO system_settings (key, value, updated_by)
VALUES ('gemini_ocr_model', 'gemini-3.6-flash', 'system')
ON CONFLICT (key) DO NOTHING;
