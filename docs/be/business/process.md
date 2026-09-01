# Proses Bisnis - Sistem Informasi Rumah Sakit (SIMRS) Rawat Jalan

## 1. Latar Belakang & Tujuan
Project ini adalah Sistem Informasi Rumah Sakit (SIMRS) berskala kecil yang difokuskan pada pelayanan **Rawat Jalan (Outpatient)**. Tujuan utama dari sistem ini adalah untuk mengelola aliran data pasien mulai dari pendaftaran, pemeriksaan di poliklinik, hingga pengambilan obat di apotek. 
Project ini juga ditujukan sebagai *showcase portfolio* pengembangan perangkat lunak.

## 2. Alur Proses Bisnis (Business Process Flow)

### A. Pendaftaran (Registration)
Proses pendaftaran terbagi menjadi dua konsep utama: **Pendaftaran Master Data Pasien** (mendapatkan MRN) dan **Pendaftaran Pelayanan/Kunjungan** (mendapatkan antrean poliklinik).

1. **Pasien Baru:** Pasien yang belum memiliki catatan rekam medis (Nomor RM).
   - **Mandiri (via Aplikasi):** Pasien mendaftar dengan membuat akun pengguna sekaligus mengisi data demografi (`POST /api/v1/auth/signup/patient`). Sistem akan men-generate Nomor Rekam Medis (RM / MRN) baru secara otomatis (Contoh Format: `10-00-00-01`). Setelah mendapatkan MRN, pasien dapat mendaftar antrean kunjungan poliklinik (`POST /api/v1/registrations`).
   - **Offline (via Petugas):** Petugas (Admin) mendaftarkan data pasien di sistem pendaftaran tanpa harus membuat akun *login* untuk pasien (`POST /api/v1/patient/register` atau `POST /api/v1/registrations/new-patient`). Setelah mendapat MRN, petugas mendaftarkan pasien ke poliklinik tujuan.

2. **Pasien Lama:** Pasien yang sudah pernah mendaftar dan memiliki Nomor RM.
   - Karena master data sudah ada, pasien atau petugas hanya perlu memasukkan Nomor RM (MRN) dan memilih Poliklinik serta Dokter tujuan untuk berobat. Endpoint yang dipanggil langsung mengarah ke layanan pendaftaran kunjungan (`POST /api/v1/registrations`).

> 🏥 **Standarisasi Master Poliklinik:** Pemilihan poliklinik wajib menggunakan kode resmi yang terdaftar di Master Poliklinik Rawat Jalan (contoh: `01` untuk Poli Umum, `02` untuk Poli Gigi, `03` untuk Poli Anak, `04` untuk Poli Kandungan, `05` untuk Poli Mata). Penggunaan singkatan atau kode tidak resmi akan ditolak sistem dengan validasi ketat.

### B. Pelayanan Rawat Jalan (Poliklinik)
Pelayanan di poliklinik dikelola secara mandiri oleh domain **Rawat Jalan** (`rawat-jalan-service`):
1. **Pemeriksaan Awal (Perawat):**
   - Perawat memanggil antrean pasien poliklinik.
   - Perawat melakukan pengkajian awal dan pemeriksaan tanda-tanda vital (Triage: tensi sistolik/diastolik, suhu tubuh, denyut nadi, keluhan utama) dan mencatatnya ke sistem (`POST /api/v1/rawat-jalan/triage`).
2. **Pemeriksaan Dokter (Point-of-Care):**
   - Dokter memulai sesi pemeriksaan pasien (`POST /api/v1/rawat-jalan/encounter/start`).
   - Dokter meninjau anamnesis dan hasil tanda-tanda vital perawat.
   - Dokter menginput **Diagnosis Klinis** menggunakan **Kamus Bahasa Medis (KBM)** atau pencarian langsung katalog ICD-10 yang tersedia secara lokal di poliklinik (`POST /api/v1/rawat-jalan/diagnosis`). Dokter juga dapat menentukan derajat keparahan klinis (*Severity Level*).
   - Dokter menginput **Tindakan Medis** (beserta tarif tindakan) (`POST /api/v1/rawat-jalan/actions`). Input tindakan ini secara otomatis memicu event ke bagian Kasir (Billing).
   - Dokter membuat **Resep Obat** elektronik melalui sistem (`POST /api/v1/pharmacy/prescriptions`).
   - Dokter menyelesaikan pemeriksaan poliklinik (`POST /api/v1/rawat-jalan/encounter/complete`).

### C. Pengelolaan Rekam Medis & Koding (Medical Records & Casemix)
Unit **Rekam Medis** (`medical-record-service`) bertindak sebagai pengelola arsip legal dan koding klinis terstandar untuk pelaporan nasional dan klaim BPJS Kesehatan:
1. **Verifikasi Koding Diagnosa & KBM:**
   - Perekam Medis (Coder) menerima berkas rekam medis yang telah diselesaikan dokter poliklinik.
   - Sistem Rekam Medis memberikan rekomendasi (*mapping suggestion*) kode **ICD-10** dan **ICD-9-CM** berdasarkan KBM atau SNOMED-CT yang diinput dokter.
   - Perekam Medis memverifikasi atau menyesuaikan pemetaan kode (*cross-mapping*) dan menetapkan Diagnosa Utama (*Primary*) serta Diagnosa Sekunder (*Comorbidity*) untuk keperluan klaim INA-CBGs BPJS (`POST /api/v1/rekam-medis/diagnosis/{id}/verify-kbm`).
2. **Finalisasi Severity & Casemix:**
   - Perekam medis memvalidasi tingkat keparahan (*Severity Level I, II, atau III*) untuk pengelompokan tarif klaim BPJS (`POST /api/v1/rekam-medis/encounter/{encounter_no}/severity/finalize`).
3. **Single Source of Truth (SSOT) Master Data Klinis:**
   - Unit Rekam Medis mengelola katalog referensi standar (ICD-10, ICD-9, SNOMED, KBM, dan Tindakan).
   - Setiap pembaruan katalog master data di Rekam Medis direplikasi secara asinkron ke database poliklinik (*Local Read-Replica*) agar pelayanan dokter di poli tidak terganggu.

### D. Pembayaran / Kasir (Billing)
1. **Kalkulasi Tagihan Otomatis:**
   - Sistem Billing mengonsumsi event registrasi kunjungan, tindakan medis dari Poliklinik (`rawat_jalan_stream`), dan event penyerahan obat dari Farmasi (`pharmacy_stream`) untuk menyusun tagihan (*invoice*) pasien secara otomatis tanpa entri ulang.
2. **Antrean & Rincian Tagihan Kasir:**
   - Petugas kasir melihat daftar antrean pembayaran pasien pada menu kasir (`GET /api/v1/billing/queue`).
   - Petugas kasir membuka rincian invoice dan melihat breakdown item tindakan poli, obat farmasi, dan jasa administrasi (`GET /api/v1/billing/invoice/{encounter_no}`).
3. **Pelunasan Pembayaran:**
   - Pasien melakukan pelunasan tagihan di Kasir menggunakan metode bayar yang dipilih (Tunai, QRIS, Kartu Debit, atau Jaminan BPJS) (`POST /api/v1/billing/pay`).
   - Setelah tagihan berstatus `PAID`, sistem memperbarui status kunjungan pasien ke antrean poliklinik (`QUEUED_FOR_POLI`) dan menerbitkan event pelunasan ke sistem Farmasi.
4. **Laporan Settlement & Rekapitulasi Kasir:**
   - Kasir dan manajemen keuangan dapat mengakses laporan rekapitulasi harian transaksi dan total penerimaan kasir per metode pembayaran (`GET /api/v1/billing/reports/rekap`).

### E. Apotek (Pharmacy)
1. **Penerimaan Resep:**
   - Resep elektronik dari poliklinik muncul di antrean Apotek.
   - Sistem memvalidasi status pembayaran tagihan sebelum obat dapat dikeluarkan (*dispense*).
2. **Penyerahan Obat:**
   - Petugas apotek meracik/menyiapkan obat sesuai dosis dan instruksi dokter.
   - Petugas apotek memproses penyerahan obat (`POST /api/v1/pharmacy/dispense`) yang secara atomik memotong stok inventaris farmasi.

### F. Estimasi Waktu Tunggu (Fitur Cerdas AI-Ready)
Sistem menyediakan estimasi waktu tunggu secara real-time:
1. **Estimasi Waktu Pelayanan Poliklinik:** 
   - Dihitung berdasarkan riwayat waktu pelayanan (AHT - *Average Handling Time*) dari dokter bersangkutan dikalikan antrean pasien di depan.
2. **Estimasi Waktu Pengambilan Obat Farmasi:** 
   - Dihitung berdasarkan jenis resep (Racikan vs Non-Racikan) dan antrean resep yang sedang diproses.
