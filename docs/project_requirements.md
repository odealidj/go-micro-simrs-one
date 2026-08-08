# Spesifikasi Sistem Informasi Rumah Sakit (SIMRS) - Rawat Jalan

## 1. Latar Belakang & Tujuan
Project ini adalah Sistem Informasi Rumah Sakit (SIMRS) berskala kecil yang difokuskan pada pelayanan **Rawat Jalan (Outpatient)**. Tujuan utama dari sistem ini adalah untuk mengelola aliran data pasien mulai dari pendaftaran, pemeriksaan di poliklinik, hingga pengambilan obat di apotek. 
Project ini juga ditujukan sebagai *showcase portfolio* pengembangan perangkat lunak (terutama arsitektur backend/microservices).

## 2. Alur Proses Bisnis (Business Process Flow)

### A. Pendaftaran (Registration)
1. **Pasien Baru:** Pasien yang belum memiliki catatan rekam medis (Nomor RM). 
   - Pasien harus mengisi data pribadi secara lengkap.
   - Petugas akan mencatat keluhan awal dan mengarahkan ke Poliklinik tujuan.
   - Sistem akan men-generate Nomor Rekam Medis (RM) baru untuk pasien.
2. **Pasien Lama:** Pasien yang sudah pernah mendaftar dan memiliki Nomor RM.
   - Pasien hanya perlu memberikan Nomor RM atau identitas.
   - Pasien memilih Poliklinik tujuan untuk berobat.

### B. Poliklinik (Polyclinic / Examination)
1. **Pemeriksaan Awal (Perawat):**
   - Perawat memanggil pasien berdasarkan antrean.
   - Perawat menanyakan kembali keluhan, melakukan pemeriksaan tanda-tanda vital (tekanan darah, suhu, dll), dan mencatatnya ke dalam sistem.
2. **Pemeriksaan Dokter:**
   - Dokter melihat hasil pemeriksaan awal perawat.
   - Dokter melakukan pemeriksaan medis.
   - Dokter menginput **Diagnosa** (berdasarkan standar ICD-10).
   - Dokter menginput **Tindakan Medis** (beserta tarif).
   - Dokter membuat **Resep Obat** melalui sistem.
   - Dokter mengarahkan pasien ke Apotek.

### C. Apotek (Pharmacy)
1. **Penerimaan Resep:**
   - Data pasien, diagnosa, tindakan medis, dan resep obat akan otomatis muncul di sistem Apotek.
2. **Penyerahan Obat:**
   - Petugas apotek menyiapkan obat berdasarkan resep.
   - Obat diserahkan kepada pasien dan status pelayanan selesai (atau dilanjutkan ke pembayaran).

### D. Pembayaran / Kasir (Tambahan untuk Showcase)
1. Setelah dari apotek, total tagihan (tindakan poliklinik + harga obat) dikalkulasikan.
2. Pasien melakukan pembayaran dan transaksi dinyatakan selesai.

---

## 3. Kebutuhan Teknis (Technical Requirements)

### A. Pembagian Hak Akses (RBAC)
Sistem ini membutuhkan otentikasi (contoh: JWT) dan otorisasi untuk beberapa Role:
- **Admin / Resepsionis:** Mengelola pendaftaran pasien baru dan lama.
- **Perawat:** Mengisi data pemeriksaan awal di poliklinik.
- **Dokter:** Mengisi diagnosa (ICD-10), tindakan, dan resep.
- **Apoteker:** Memproses resep obat dan menyerahkan ke pasien.
- **Kasir:** Melakukan proses konfirmasi pembayaran.

### B. Arsitektur Microservices (Saran Implementasi)
Mengingat nama project `go-micro-simrs-one`, project ini direkomendasikan untuk dibangun dengan arsitektur microservices menggunakan Golang. Berikut adalah rancangan pembagian *service*:
1. **User/Auth Service:** Mengelola login, registrasi staff, dan manajemen token JWT.
2. **Patient Service:** Mengelola master data pasien dan pembuatan Nomor Rekam Medis (RM).
3. **Visit/Registration Service:** Mengelola kunjungan pasien per hari (Pendaftaran Rawat Jalan) dan sistem nomor antrean.
4. **EMR (Electronic Medical Record) Service:** Mencatat pemeriksaan perawat, diagnosa dokter, dan tindakan medis.
5. **Pharmacy Service:** Mengelola master data obat, stok sederhana, dan memproses resep dari EMR.
6. **Billing Service:** Mengkalkulasi total tagihan pasien dari layanan (EMR) dan obat (Pharmacy).

### C. Basis Data (Database)
- Relational Database (PostgreSQL / MySQL) sangat direkomendasikan untuk integritas data (ACID compliance) pada transaksi RS.

### D. Integrasi Antar Layanan (Inter-Service Communication)
- **Synchronous:** REST API / gRPC (contoh: Billing Service meminta rincian harga obat ke Pharmacy Service).
- **Asynchronous:** Message Broker seperti RabbitMQ / Kafka (contoh: Saat dokter menyimpan resep, event dikirim ke Apotek agar petugas apotek mendapat notifikasi real-time tanpa refresh halaman).
