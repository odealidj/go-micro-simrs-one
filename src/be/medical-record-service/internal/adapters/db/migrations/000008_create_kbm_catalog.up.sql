CREATE TABLE IF NOT EXISTS kbm_catalog (
    kbm_code    VARCHAR(50)  PRIMARY KEY,
    kbm_name    VARCHAR(255) NOT NULL,
    description TEXT,
    body_system VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kbm_catalog_name        ON kbm_catalog (kbm_name);
CREATE INDEX IF NOT EXISTS idx_kbm_catalog_body_system ON kbm_catalog (body_system);
