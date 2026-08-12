# Dokumen Status Proyek — go-micro-simrs-one

> **Dibuat/Diperbarui:** 12 Agustus 2026  
> **Tujuan:** Dokumen ini merangkum status terkini proyek SIMRS Rawat Jalan setelah serangkaian perbaikan arsitektural dan fitur selesai diimplementasikan. Dokumen handover versi awal telah diarsipkan ke `handover_document_v1_archive.md`.

---

## 1. Identitas Proyek

| Field | Detail |
|-------|--------|
| **Nama Proyek** | go-micro-simrs-one |
| **Tujuan Proyek** | SIMRS (Sistem Informasi Manajemen Rumah Sakit) Rawat Jalan berskala microservices |
| **Status Saat Ini** | **STABLE** - Seluruh *gap* arsitektur awal telah diselesaikan |

---

## 2. Daftar Fitur yang Berhasil Diselesaikan (Completed Milestones)

Berbeda dengan dokumen handover sebelumnya yang berisi daftar GAP, saat ini sistem telah berfungsi secara *end-to-end* dengan penyelesaian masalah-masalah kritikal berikut:

### Keamanan & Otorisasi
- **PASETO Access & Refresh Token:** Skema rotasi token berumur panjang telah aktif (disimpan menggunakan hash SHA-256 di PostgreSQL). Terdapat endpoint `POST /api/v1/auth/refresh`.
- **RBAC (Role-Based Access Control):** Role (*Admin*, *Dokter*, *Perawat*, dll) dimasukkan ke dalam claims token PASETO. Middleware `RequireRole` telah terpasang di API Gateway untuk melindungi *routes* sesuai otorisasinya.
- **Auto-Provisioning Super Admin:** Akun admin otomatis dibuat saat `auth-service` menyala pertama kali berbekal *Environment Variables* (`INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`).

### Infrastruktur & Stabilitas
- **Idempotency & Redis:** Seluruh koneksi ke Redis di *microservices* (`pharmacy-service`, `billing-service`) telah diperbaiki. *Idempotency Middleware* (menggunakan *Redis SETNX*) diaktifkan di API Gateway untuk mencegah eksekusi ganda pada endpoint POST.
- **Docker Compose Healthchecks:** Infrastruktur (PostgreSQL, Redis, Jaeger) sekarang dijamin sehat (`service_healthy`) sebelum *microservices* dijalankan. Skrip `make be-infra-up` dan `make be-infra-down` beroperasi dengan sinkron dan anti *zombie process*.
- **Outbox Pattern:** Event-driven arsitektur sepenuhnya fungsional. Transaksi di EMR dan Apotek mempublikasikan event ke Redis Streams dan diserap oleh Billing Consumer untuk membangun Invoice (Tagihan) secara otomatis.

### Fungsionalitas Bisnis & API
- **Billing Service:** Implementasi method gRPC `GenerateInvoice` dan `PayInvoice` telah diluruskan dan diselaraskan dengan kontrak `.proto`.
- **Validasi Pembayaran Apotek:** `pharmacy-service` kini secara *synchronous* memvalidasi status invoice ke `billing-service`. Obat tidak dapat di-*dispense* jika invoice belum bersatus `PAID`.
- **Global Exception Handling:** Seluruh respons error dari gRPC tidak lagi membocorkan detail teknis, melainkan diterjemahkan ke dalam Bahasa Indonesia yang ramah pengguna.
- **Pendaftaran Pasien:** Alur untuk pendaftaran pasien mandiri (akun + MRN) dan pendaftaran kunjungan telah diperjelas di endpoint terpisah.
- **Queue Estimator:** Antarmuka (Interface) AI-Ready untuk menghitung waktu antrean telah disediakan.

---

## 3. Cara Menjalankan Sistem

Seluruh siklus operasional dapat dilakukan menggunakan perintah `make`:

```bash
# 1. Jalankan Infrastruktur Database (Akan menunggu hingga Postgres/Redis "healthy")
make be-infra-up

# 2. Jalankan semua microservice secara lokal
make be-run-local-all

# 3. Hentikan semua microservice lokal dengan bersih
make be-stop-local-all

# 4. Matikan seluruh infrastruktur Database
make be-infra-down

# 5. Jalankan migrasi database
make migrate-up
```

---

## 4. Alur Sistem (Happy Path)

```text
1. POST /api/v1/auth/signup/patient      → Auth & Patient Service (dapat MRN)
2. POST /api/v1/auth/login               → Auth Service (dapat Access & Refresh PASETO token)
3. POST /api/v1/registrations            → Registration Service (daftar antrean ke Poli)
4. POST /api/v1/emr/triage               → EMR Service (perawat isi tanda-tanda vital)
5. POST /api/v1/emr/diagnosis            → EMR Service (dokter input diagnosa KBM/ICD-10)
6. POST /api/v1/emr/actions              → EMR Service (dokter input tindakan poli)
                                            ↓ [Outbox Event: MedicalActionAdded → emr_stream]
                                            ↓ Billing Consumer mencatat tagihan tindakan
7. POST /api/v1/pharmacy/prescriptions   → Pharmacy Service (dokter buat resep obat)
8. GET  /api/v1/billing/invoice/{enc}    → Billing Service (lihat rincian tagihan total)
9. POST /api/v1/billing/pay              → Billing Service (kasir/pasien melunasi tagihan)
10. POST /api/v1/pharmacy/dispense       → Pharmacy Service (apotek menyerahkan obat)
```

---

## 5. Referensi Dokumen Lainnya
- Arsitektur teknis lebih mendetail: `/docs/be/technical/architecture.md`
- Alur proses bisnis: `/docs/be/business/process.md`
- Dokumentasi API (Swagger): `http://localhost:8080/swagger/` (Bila service berjalan)
