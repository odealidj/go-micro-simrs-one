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

### Arsitektur Microservices & Pemisahan Domain
- **Pemisahan Domain Rawat Jalan & Rekam Medis:**
  - `rawat-jalan-service` (:50057) menangani operasional dokter dan perawat poliklinik (triage, diagnosis, tindakan, resep elektronik, antrean).
  - `medical-record-service` (:50054) menangani pengarsipan berkas rekam medis permanen, verifikasi koding KBM ke ICD-10, finalisasi severity casemix INA-CBGs BPJS, dan *Single Source of Truth* katalog klinis.
- **Arsitektur Database Multi-Schema KETAT:**
  - Database terisolasi ke skema: `auth`, `patient`, `registration`, `rawat_jalan`, `medical_record`, `pharmacy`, `billing`.
  - Ditegakkan aturan: *Zero Cross-Schema JOINs* dan *Zero Cross-Schema Foreign Keys*.
  - Transaksi poliklinik menggunakan *Clinical Snapshot Pattern* untuk menyimpan nama tindakan dan diagnosa secara independen.
  - *Asynchronous Master Data Replication*: Katalog klinis direplikasi secara asinkron dari Rekam Medis ke tabel replika lokal Rawat Jalan via Redis Stream `clinical_master_stream` untuk menjamin pencarian autocomplete sub-detik (1-2 ms).

### Keamanan & Otorisasi
- **PASETO Access & Refresh Token:** Skema rotasi token berumur panjang telah aktif (disimpan menggunakan hash SHA-256 di PostgreSQL). Terdapat endpoint `POST /api/v1/auth/refresh`.
- **RBAC (Role-Based Access Control):** Role (*Admin*, *Dokter*, *Perawat*, *Perekam Medis*, *Apoteker*, *Kasir*) dimasukkan ke dalam claims token PASETO. Middleware `RequireRole` terpasang di API Gateway melindungi rute `/rawat-jalan/*` dan `/rekam-medis/*`.
- **Auto-Provisioning Super Admin:** Akun admin otomatis dibuat saat `auth-service` menyala pertama kali berbekal *Environment Variables* (`INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`).

### Infrastruktur & Stabilitas
- **Idempotency & Redis:** Seluruh koneksi ke Redis di *microservices* telah diperbaiki. *Idempotency Middleware* (menggunakan *Redis SETNX*) diaktifkan di API Gateway untuk mencegah eksekusi ganda pada endpoint POST.
- **Docker Compose Healthchecks:** Infrastruktur (PostgreSQL, Redis, Jaeger) dijamin sehat (`service_healthy`) sebelum *microservices* dijalankan.
- **Transactional Outbox Pattern & Redis Streams:**
  - `registration.events` dikonsumsi oleh `rawat-jalan-group` (`rawat-jalan-service`).
  - `rawat_jalan_stream` dikonsumsi oleh `billing_group` (`billing-service`) untuk tagihan tindakan medis poli.
  - `pharmacy_stream` dikonsumsi oleh `billing_group` (`billing-service`) untuk tagihan obat.
  - `clinical_master_stream` dikonsumsi oleh `rawat-jalan-master-sync` (`rawat-jalan-service`).

---

## 3. Cara Menjalankan Sistem

Seluruh siklus operasional dapat dilakukan menggunakan perintah `make`:

```bash
# 1. Jalankan Infrastruktur Database (PostgreSQL, Redis, Jaeger)
make be-infra-up

# 2. Siapkan skema database multi-schema
make db-schemas

# 3. Jalankan migrasi database seluruh service
make migrate-up

# 4. Jalankan semua microservice secara lokal
make be-run-local-all

# 5. Hentikan semua microservice lokal dengan bersih
make be-stop-local-all
```

---

## 4. Alur Sistem (Happy Path)

```text
1. POST /api/v1/auth/signup/patient           → Auth & Patient Service (generate MRN)
2. POST /api/v1/auth/login                    → Auth Service (dapat PASETO token)
3. POST /api/v1/registrations                 → Registration Service (daftar antrean ke Poli)
                                                 ↓ [Outbox: registration.events → rawat-jalan-group]
4. POST /api/v1/rawat-jalan/triage            → Rawat Jalan Service (perawat isi tanda-tanda vital)
5. POST /api/v1/rawat-jalan/encounter/start   → Rawat Jalan Service (dokter mulai pemeriksaan)
6. POST /api/v1/rawat-jalan/diagnosis         → Rawat Jalan Service (dokter input diagnosa KBM/ICD-10)
7. POST /api/v1/rawat-jalan/actions           → Rawat Jalan Service (dokter input tindakan poli)
                                                 ↓ [Outbox Event: MedicalActionAdded → rawat_jalan_stream]
                                                 ↓ Billing Consumer mencatat tagihan tindakan
8. POST /api/v1/pharmacy/prescriptions        → Pharmacy Service (dokter buat resep obat)
9. POST /api/v1/rawat-jalan/encounter/complete→ Rawat Jalan Service (dokter selesaikan kunjungan)
10. GET  /api/v1/billing/invoice/{enc}         → Billing Service (lihat rincian tagihan total)
11. POST /api/v1/billing/pay                   → Billing Service (kasir/pasien melunasi tagihan)
                                                 ↓ [Outbox Event: InvoicePaid → pharmacy_stream]
12. POST /api/v1/pharmacy/dispense            → Pharmacy Service (apotek memotong stok & serahkan obat)
13. POST /api/v1/rekam-medis/diagnosis/{id}/verify-kbm 
                                              → Medical Record Service (verifikasi koding ICD-10/BPJS)
14. POST /api/v1/rekam-medis/encounter/{enc}/severity/finalize 
                                              → Medical Record Service (finalisasi severity klaim)
```

---

## 5. Referensi Dokumen Lainnya
- Arsitektur teknis lebih mendetail: `/docs/be/technical/architecture.md`
- Alur proses bisnis komprehensif: `/docs/be/business/process.md`
- Dokumentasi API & ERD: `/docs/be/technical/technical_documentation.md`
- Panduan Terminologi Klinis & Klaim: `/docs/PROSES_BISNIS_DAN_TEKNIS_TERMINOLOGI_MEDIS_DAN_KLAIM.md`
