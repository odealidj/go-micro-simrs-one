# SIMRS Microservices Backend

Sistem Informasi Manajemen Rumah Sakit (SIMRS) Backend berbasis arsitektur **Microservices** menggunakan **Golang** dan **gRPC**. Sistem ini dirancang untuk memiliki skalabilitas tinggi, ketersediaan tinggi, dan observabilitas yang komprehensif.

## 🏗 Arsitektur

Sistem ini terdiri dari satu API Gateway dan beberapa microservices yang berkomunikasi menggunakan protokol gRPC:
- **API Gateway**: Menangani routing HTTP, otentikasi (PASETO), Rate Limiting, Circuit Breaker, Idempotency, SSE, dan Swagger UI.
- **Auth Service**: Mengelola manajemen pengguna, otentikasi, dan otorisasi berbasis peran (RBAC).
- **Patient Service**: Mengelola **data master pasien** — identitas (NIK, nama, tanggal lahir) dan penerbitan nomor rekam medis (MRN).
- **Registration Service**: Menangani **pendaftaran kunjungan (encounter)** pasien ke poli tertentu, alokasi dokter, dan estimasi antrean real-time via SSE.
- **EMR Service**: Berfungsi sebagai **modul Poliklinik** — tempat dokter dan perawat mencatat pemeriksaan awal (triage/vital signs), input diagnosa ICD-10, tindakan medis beserta tarifnya, serta kalkulasi estimasi waktu tunggu antrean poli.
- **Pharmacy Service**: Mengelola **inventaris obat** dan penebusan resep — termasuk validasi stok, pencatatan resep racikan/non-racikan, dan sinkronisasi status pembayaran sebelum obat dikeluarkan.
- **Billing Service**: Menangani **penagihan dan pembayaran** — generate invoice otomatis dari akumulasi tindakan medis dan resep, serta notifikasi pembayaran via event (Outbox Pattern + Redis Streams).

### Infrastruktur Pendukung
- **PostgreSQL**: Database utama relasional.
- **Redis**: Caching, *Distributed Locks* untuk idempotency, dan *Message Broker* (Redis Streams).
- **Jaeger**: *Distributed Tracing* (OpenTelemetry).

---

## 🚀 Panduan Menjalankan Aplikasi

Aplikasi ini didesain agar dapat berjalan di dua mode utama secara berdampingan tanpa konflik port:
1. **Docker Mode (Direkomendasikan)**: Menjalankan semua layanan dan infrastruktur di dalam kontainer terisolasi.
2. **Local Native Mode**: Menjalankan layanan Golang langsung di sistem operasi host Anda (sangat cocok untuk *live-reload debugging*), dengan tetap memakai database/redis dari Docker.

### 📋 Prasyarat
- Go 1.24+
- Podman (atau Docker) & Podman Compose (atau Docker Compose)
- Make (tersedia secara bawaan di Linux/macOS)

### 1. Menjalankan via Docker Mode
Cara paling praktis untuk menjalankan seluruh sistem (Infrastruktur + Microservices) secara penuh:

```bash
# Menjalankan seluruh sistem di background
make be-run-all

# Mematikan seluruh sistem
make down
```

**Konfigurasi Port Docker:**
Untuk menghindari bentrok dengan *Local Native Mode*, layanan Docker di-expose ke port **60xxx**:
- API Gateway: `http://localhost:60080`
- Auth Service: `:60051`
- Patient Service: `:60052`
- Registration Service: `:60053`
- EMR Service: `:60054`
- Pharmacy Service: `:60055`
- Billing Service: `:60056`
- Jaeger UI: `http://localhost:16686`

---

### 2. Menjalankan via Local Native Mode
Sangat berguna untuk proses *development* atau *debugging* langsung. Layanan Go akan berjalan di mesin Anda sendiri, namun menembak ke database PostgreSQL dan Redis yang berjalan di Docker.

```bash
# Langkah 1: Nyalakan infrastrukturnya saja (PostgreSQL, Redis, Jaeger)
make be-infra-up

# Langkah 2: Jalankan seluruh microservices secara native di mesin lokal
make be-run-local-all

# Langkah 3: Jika sudah selesai, matikan microservices lokal
make be-stop-local-all

# (Opsional) Matikan infrastrukturnya
make be-infra-down
```

**Konfigurasi Port Lokal:**
Layanan yang berjalan di lokal akan mengikat port standar **50xxx**:
- API Gateway: `http://localhost:8080`
- Auth Service: `:50051`
- ...dan seterusnya hingga `:50056`

*(Catatan: Docker Mode dan Local Native Mode bisa dijalankan secara bersamaan jika Anda ingin membandingkannya).*

---

## 📖 Akses Dokumentasi (Swagger)

Aplikasi telah dilengkapi dengan antarmuka dokumentasi Swagger UI.
- **Akses Lokal:** [http://localhost:8080/api/v1/swagger](http://localhost:8080/api/v1/swagger)
- **Akses Docker:** [http://localhost:60080/api/v1/swagger](http://localhost:60080/api/v1/swagger)

> **Catatan Penting:** Untuk endpoint mutasi (`POST`/`PUT`), Anda wajib mengirimkan header `X-Request-ID` berisi format UUID standar untuk perlindungan *Strict Idempotency*.

---

## ⚙️ Skrip Makefile Lainnya

- **Database Migrations:**
  - `make migrate-up`: Menjalankan semua skema migrasi database terbaru.
  - `make migrate-down`: Me-rollback semua tabel migrasi.

- **Menjalankan Service Spesifik secara Lokal:**
  Jika Anda hanya sedang mengembangkan satu service saja, gunakan perintah spesifik:
  - `make be-run-local-api-gateway`
  - `make be-stop-local-api-gateway`
