-- 1. Buat tabel master status invoice
CREATE TABLE IF NOT EXISTS master_invoice_status (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_payable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Buat tabel master metode pembayaran kasir
CREATE TABLE IF NOT EXISTS master_payment_methods (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seeding status invoice
INSERT INTO master_invoice_status (code, name, description, is_payable) VALUES
('DRAFT', 'Draf Tagihan', 'Tagihan belum difinalisasi oleh kasir', FALSE),
('UNPAID', 'Belum Lunas', 'Tagihan aktif dan menunggu pembayaran di loket kasir', TRUE),
('PAID', 'Lunas', 'Tagihan telah dibayar lunas dan diterbitkan kwitansi resmi', FALSE),
('CANCELLED', 'Dibatalkan', 'Tagihan dibatalkan karena pembatalan kunjungan admisi', FALSE),
('REFUNDED', 'Pengembalian Dana', 'Pembayaran kasir telah diretur/dikembalikan ke pasien', FALSE)
ON CONFLICT (code) DO NOTHING;

-- 4. Seeding metode pembayaran resmi kasir
INSERT INTO master_payment_methods (code, name, is_active) VALUES
('CASH', 'Tunai (Cash)', TRUE),
('QRIS', 'QRIS / Digital Payment', TRUE),
('DEBIT', 'Kartu Debit EDC', TRUE),
('TRANSFER', 'Transfer Rekening Bank', TRUE),
('BPJS', 'Penjamin BPJS Kesehatan', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 5. Foreign Key lokal pada invoices (100% legal dalam skema billing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_status'
    ) THEN
        ALTER TABLE invoices
        ADD CONSTRAINT fk_invoices_status
        FOREIGN KEY (status) REFERENCES master_invoice_status(code);
    END IF;
END $$;
