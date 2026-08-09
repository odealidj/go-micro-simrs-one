# Proses Bisnis - Sistem Informasi Rumah Sakit (SIMRS) Rawat Jalan

## 1. Latar Belakang & Tujuan
Project ini adalah Sistem Informasi Rumah Sakit (SIMRS) berskala kecil yang difokuskan pada pelayanan **Rawat Jalan (Outpatient)**. Tujuan utama dari sistem ini adalah untuk mengelola aliran data pasien mulai dari pendaftaran, pemeriksaan di poliklinik, hingga pengambilan obat di apotek. 
Project ini juga ditujukan sebagai *showcase portfolio* pengembangan perangkat lunak.

## 2. Alur Proses Bisnis (Business Process Flow)

### A. Pendaftaran (Registration)
1. **Pasien Baru:** Pasien yang belum memiliki catatan rekam medis (Nomor RM). 
   - Pasien harus mengisi data pribadi secara lengkap.
   - Petugas akan mencatat keluhan awal dan mengarahkan ke Poliklinik tujuan.
   - Sistem akan men-generate Nomor Rekam Medis (RM / MRN) baru secara otomatis (Contoh Format: `10-00-00-01` di mana angka 1 menandakan Rawat Jalan).
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
   - Dokter mengarahkan pasien ke Kasir untuk melakukan pelunasan, kemudian ke Apotek.

### C. Pembayaran / Kasir
1. **Kalkulasi Tagihan:**
   - Sistem akan mengkalkulasi total tagihan secara otomatis, yang mencakup biaya tindakan medis di poliklinik dan harga obat dari resep.
2. **Pelunasan Pembayaran:**
   - Pasien melakukan pelunasan tagihan di Kasir.
   - Setelah lunas, status pasien di-update sehingga obat dapat mulai diproses di Apotek.

### D. Apotek (Pharmacy)
1. **Penerimaan Resep:**
   - Data resep obat pasien akan muncul di sistem Apotek (diutamakan bagi pasien yang status pembayarannya sudah lunas).
2. **Penyerahan Obat:**
   - Petugas apotek menyiapkan obat berdasarkan resep.
   - Obat diserahkan kepada pasien dan keseluruhan proses rawat jalan dinyatakan selesai.

### E. Estimasi Waktu Tunggu (Fitur Unggulan)
Sistem memiliki fitur untuk memberikan estimasi waktu secara real-time kepada pasien:
1. **Estimasi Waktu Poliklinik:** 
   - Pasien dapat melihat berapa menit lagi giliran mereka akan dipanggil. Kalkulasi didasarkan pada Rata-Rata Waktu Pelayanan (AHT - Average Handling Time) dari masing-masing dokter dikalikan dengan jumlah antrean di depan pasien.
2. **Estimasi Waktu Pengambilan Obat:** 
   - Pasien mengetahui kapan obat siap diambil. Kalkulasi didasarkan pada jenis resep (Racikan atau Non-Racikan) dan jumlah antrean resep yang sedang diproses oleh Apoteker.
