# Kebutuhan Teknis (Technical Requirements) - SIMRS Rawat Jalan

## 1. Pembagian Hak Akses (RBAC)
Sistem ini membutuhkan otentikasi (contoh: JWT) dan otorisasi untuk beberapa Role:
- **Admin / Resepsionis:** Mengelola pendaftaran pasien baru dan lama.
- **Perawat:** Mengisi data pemeriksaan awal di poliklinik.
- **Dokter:** Mengisi diagnosa (ICD-10), tindakan, dan resep.
- **Apoteker:** Memproses resep obat dan menyerahkan ke pasien.
- **Kasir:** Melakukan proses konfirmasi pembayaran.

## 2. Arsitektur Microservices (Saran Implementasi)
Mengingat nama project `go-micro-simrs-one`, project ini direkomendasikan untuk dibangun dengan arsitektur microservices menggunakan Golang. Berikut adalah rancangan pembagian *service*:
1. **User/Auth Service:** Mengelola login, registrasi staff, dan manajemen token JWT.
2. **Patient Service:** Mengelola master data pasien dan pembuatan Nomor Rekam Medis (RM).
3. **Visit/Registration Service:** Mengelola kunjungan pasien per hari (Pendaftaran Rawat Jalan) dan sistem nomor antrean.
4. **EMR (Electronic Medical Record) Service:** Mencatat pemeriksaan perawat, diagnosa dokter, dan tindakan medis.
5. **Pharmacy Service:** Mengelola master data obat, stok sederhana, dan memproses resep dari EMR.
6. **Billing Service:** Mengkalkulasi total tagihan pasien dari layanan (EMR) dan obat (Pharmacy).

## 3. Basis Data (Database)
- Relational Database (PostgreSQL / MySQL) sangat direkomendasikan untuk integritas data (ACID compliance) pada transaksi RS.

## 4. Integrasi Antar Layanan & Arsitektur Event-Driven (EDA)
- **Synchronous:** REST API / gRPC (contoh: Billing Service meminta rincian harga obat ke Pharmacy Service).
- **Asynchronous:** Message Broker (RabbitMQ / Kafka) digunakan secara ekstensif, terutama untuk fitur **Estimasi Waktu Tunggu**, contoh:
  - Event `PatientExamFinished` dipublish oleh EMR Service, kemudian di-consume oleh Visit/Registration Service untuk mengkalkulasi ulang estimasi sisa waktu tunggu antrean pasien berikutnya.
  - Event `PrescriptionCreated` dikirim ke Pharmacy Service untuk mulai mengkalkulasi estimasi waktu penyiapan obat berdasarkan jenis resep.
- **Komunikasi Real-Time ke Klien:** Menggunakan **WebSockets** atau **Server-Sent Events (SSE)**. Backend akan me-broadcast pembaruan estimasi waktu tunggu secara langsung ke Frontend/Layar Pasien, sehingga informasi sisa waktu selalu akurat tanpa perlu me-refresh halaman (polling).

## 5. Arsitektur "AI-Ready" untuk Estimasi Waktu Tunggu
Untuk memfasilitasi kalkulasi waktu tunggu cerdas (berbasis historis/Machine Learning) tanpa merombak sistem *core*, proyek ini menerapkan **Dependency Injection** dan **Open-Closed Principle (SOLID)**.

Pada kode Golang (di service Registration & Pharmacy), dibuat sebuah *Interface* utama:
`type QueueEstimator interface { Estimate(data EstimatorPayload) int }`

Interface ini memiliki dua implementasi yang di-inject berdasarkan konfigurasi (*environment variable*):
1. **`StatisticalQueueEstimator`**: Mengkalkulasi rata-rata (Moving Average) secara dinamis langsung dari Database. Sistem merekam *timestamps* (waktu mulai & selesai pelayanan). Estimasi dihitung dengan Query SQL (contoh: mengambil `AVG(end_time - start_time)` berdasarkan `diagnosis_id` pasien atau `jenis_racikan`). Ini adalah solusi perantara yang sangat akurat dan aplikatif sebelum AI sungguhan diterapkan.
2. **`MLQueueEstimator`**: Melakukan pemanggilan **HTTP/gRPC Call** ke *endpoint* external (ML Service).
   - **Tahap Showcase / Development (Mock AI):** Endpoint eksternal diarahkan ke Mock Server (misalnya menggunakan Postman Mock API, atau server Python sederhana). Sistem seolah-olah berinteraksi dengan AI untuk mendapat prediksi angka.
   - **Tahap Produksi (Real AI):** Saat model Machine Learning sesungguhnya telah ditraining oleh Data Scientist, model tersebut cukup di-deploy di URL endpoint yang sama. Sistem Golang akan otomatis mendapatkan prediksi nyata dari AI **tanpa merombak kode Backend sama sekali (Zero Code Change)**.
