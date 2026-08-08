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

## 4. Integrasi Antar Layanan (Inter-Service Communication)
- **Synchronous:** REST API / gRPC (contoh: Billing Service meminta rincian harga obat ke Pharmacy Service).
- **Asynchronous:** Message Broker seperti RabbitMQ / Kafka (contoh: Saat dokter menyimpan resep, event dikirim ke Apotek agar petugas apotek mendapat notifikasi real-time tanpa refresh halaman).
