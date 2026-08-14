# Spesifikasi Patient Portal (Public App)

Dokumen ini merangkum alur bisnis dan pendekatan teknis untuk **Patient Portal**, sebuah aplikasi mandiri yang ditujukan agar pasien dapat mendaftar dan memantau status kesehatan mereka secara *online* tanpa harus berinteraksi dengan petugas rumah sakit di loket pendaftaran.

## 1. Alur Bisnis (Business Flow)

### A. Registrasi Akun & Manajemen Profil
- **Sign Up / Login:** Pasien membuat akun menggunakan Email atau Nomor Telepon.
- **Data Demografi:** Pasien melengkapi profil dengan NIK, Nama Lengkap, Tanggal Lahir, Jenis Kelamin, Alamat, dll.
- **Link ke No. RM:** 
  - Jika NIK sudah ada di database RS, sistem otomatis mengaitkan akun dengan **Nomor Rekam Medis (No. RM)** yang sudah ada.
  - Jika NIK belum terdaftar, sistem akan meng-generate No. RM baru untuk pasien tersebut.

### B. Alur Pemesanan (Booking / Pendaftaran Mandiri)
Pasien dapat melakukan pendaftaran layanan rawat jalan dengan 2 cara:

#### Opsi 1: Berdasarkan Poliklinik
1. Pasien memilih **Poli** (Misal: Poli Jantung).
2. Sistem menampilkan kalender dan ketersediaan kuota.
3. Pasien memilih **Tanggal** kunjungan.
4. Sistem menampilkan daftar **Dokter** yang berjaga pada tanggal tersebut beserta jam praktik.
5. Pasien memilih Dokter.

#### Opsi 2: Berdasarkan Dokter
1. Pasien mencari nama **Dokter** favorit/langganan.
2. Sistem menampilkan daftar Poli tempat dokter tersebut berpraktik beserta jadwal praktiknya (hari dan jam).
3. Pasien memilih **Jadwal (Tanggal & Sesi)**.

### C. Konfirmasi & Pembayaran
- Pasien memilih tipe penjamin/pembayaran (Umum/Mandiri, BPJS, Asuransi Lain).
- Jika BPJS, sistem bisa meminta verifikasi nomor kepesertaan.
- Pasien menyetujui pemesanan.
- Sistem menerbitkan **e-Karcis (Digital Ticket)** yang berisi:
  - Nomor Registrasi (Booking Code)
  - Nomor Rekam Medis (No. RM)
  - Estimasi Jam Kedatangan
  - Nomor Antrean
  - *QR Code* untuk kemudahan *check-in* mandiri di mesin anjungan (Kiosk) rumah sakit.

## 2. Arsitektur Teknikal

Mengingat arsitektur *backend* kita sudah menggunakan Microservices (Go), Patient Portal akan menjadi satu *client* baru yang terhubung ke API Gateway yang sama dengan Hospital Portal.

### Frontend
- **Teknologi:** React (PWA) atau React Native. PWA (Progressive Web App) disarankan untuk MVP agar pasien bisa menginstal aplikasi langsung dari browser tanpa lewat Play Store/App Store.
- **Styling:** Tailwind CSS dengan desain yang berpusat pada pengguna (Mobile-first, *card-based*, tipografi besar, aksesibel).
- **Hosting:** Vercel / Firebase Hosting / Nginx.

### Interaksi Backend (API Gateway)
Patient Portal akan mengonsumsi API yang sudah ada (reusability):
- `Auth Service`: Untuk login/register JWT khusus *role* `Patient`.
- `Patient Service`: Untuk sinkronisasi profil dan pencarian riwayat medis.
- `Registration Service`: Untuk cek jadwal dokter (`GET /schedules`) dan membuat pendaftaran baru (`POST /registrations`).
- `Queue Service / Pharmacy Service`: Untuk memantau nomor antrean secara *real-time* atau mengecek status obat.

### Keamanan
- JWT Token untuk autentikasi.
- Rate limiting di API Gateway khusus rute publik untuk mencegah spam registrasi.
- Data sensitif pasien hanya dapat diakses jika ID pasien di token cocok dengan parameter pencarian (Akses Terbatas).
