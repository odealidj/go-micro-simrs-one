# Rancangan UI/UX & Best Practices - SIMRS Rawat Jalan

Dokumen ini memetakan alur *User Interface* (UI) dan *User Experience* (UX) dengan panduan praktik terbaik (*best practices*) serta mengaitkannya secara mendalam dengan integrasi API Gateway (*Endpoints*) dari backend.

---

## 1. Modul Autentikasi & Registrasi (Login & Sign Up)

### 🎯 UI/UX Best Practices:
- **Clean Interface:** Gunakan form yang bersih tanpa distraksi. Fokuskan pada *call-to-action* (CTA) seperti tombol "Masuk" atau "Daftar".
- **Real-time Validation:** Berikan *feedback* visual jika input tidak valid (misal: "Format email salah" atau "Password minimal 8 karakter") sebelum disubmit.
- **Auto-format & Masking:** Untuk NIK (16 digit) dan No HP, gunakan format blok otomatis agar mudah dibaca.
- **Global Error Handling:** Tangkap response dari Gateway (karena sudah dilengkapi *Global Exception*) dan tampilkan dalam bentuk `Toaster` atau `Snackbar` interaktif di pojok atas, bukan sekadar alert standar browser.

### 🔗 Endpoint Mapping:
- **`POST /api/v1/auth/login`**: Digunakan saat user memasukkan kredensial. Akan mengembalikan *Access Token* dan *Refresh Token*.
- **`POST /api/v1/auth/signup/patient`**: Form registrasi mandiri pasien.
- **`POST /api/v1/patient/register`**: Form registrasi pasien oleh petugas administrasi (Offline mode).

---

## 2. Modul Pendaftaran Pelayanan & Antrean (Dashboard Resepsionis/Pasien)

### 🎯 UI/UX Best Practices:
- **Live Queue Dashboard:** Tampilkan nomor antrean berjalan (*current serving*) menggunakan font berukuran sangat besar (Hero Numbering). Gunakan teknologi SSE (*Server-Sent Events*) agar layar ter-update otomatis tanpa *refresh* (AJAX polling).
- **Stepped Wizard:** Untuk pendaftaran kunjungan, pecah form ke beberapa *step*: (1) Cari Nomor Rekam Medis (MRN), (2) Pilih Poliklinik, (3) Pilih Dokter, (4) Konfirmasi.
- **Card-based Layout:** Tampilkan dokter yang bertugas dengan foto, spesialisasi, dan **Estimasi Waktu Tunggu** dalam bentuk kartu (*Card*).

### 🔗 Endpoint Mapping:
- **`GET /api/v1/patient/{mrn}`**: Cari dan autofill data pasien berdasarkan No. RM.
- **`GET /api/v1/queue/clinic/estimate`**: Tarik estimasi waktu tunggu untuk ditampilkan di samping nama dokter sebelum user memilih.
- **`POST /api/v1/registrations`**: Konfirmasi dan cetak nomor antrean.

---

## 3. Modul Pelayanan Poliklinik (Perawat & Dokter)

### 🎯 UI/UX Best Practices:
- **Two-Panel Layout (Split Screen):** 
  - *Sebelah Kiri:* Daftar antrean pasien hari ini, dilengkapi indikator warna (Kuning: Menunggu, Biru: Diperiksa, Hijau: Selesai). 
  - *Sebelah Kanan:* Ruang kerja (*workspace*) EMR, yang terdiri dari tab Triage, Diagnosa, Tindakan, dan Resep.
- **Smart Autocomplete (Debounce):** Pencarian Diagnosa KBM (Kamus Bahasa Medis) wajib di-filter berdasarkan Poliklinik tempat dokter bekerja. Saat dokter mengetik di *dropdown*, gunakan `debounce` 300ms sebelum memanggil API.
- **Sticky Actions:** Tombol "Simpan" atau "Selesai Pemeriksaan" harus selalu terlihat di bawah layar (Sticky footer).

### 🔗 Endpoint Mapping:
- **`GET /api/v1/queue/clinic/stream`**: Endpoint *streaming* (SSE) agar antrean di layar perawat/dokter ter-update otomatis.
- **`POST /api/v1/emr/triage`**: Perawat menginput tanda-tanda vital.
- **`POST /api/v1/emr/start`**: Dokter memulai pemeriksaan pasien.
- **`GET /api/v1/emr/kbm/search?q={query}&dept_code={kode}`**: Autocomplete KBM yang sangat dioptimalkan karena di-cache per poliklinik di Redis.
- **`POST /api/v1/emr/diagnosis-kbm` & `POST /api/v1/emr/actions`**: Menyimpan data medis.
- **`POST /api/v1/pharmacy/prescriptions`**: Mengirim permintaan resep ke apotek.

---

## 4. Modul Kasir (Billing)

### 🎯 UI/UX Best Practices:
- **Detailed Invoice Table:** Tabel harus memisahkan Biaya Jasa (Tindakan Medis Dokter) dan Biaya Barang (Obat-obatan) untuk kejelasan (Transparansi).
- **One-Click Pay:** Sediakan fitur *Quick Pay* (tombol bayar pas/tunai) dan integrasi tombol QRIS.
- **Auto-Print Prompt:** Begitu pembayaran disubmit dan response API mengembalikan status sukses, picu perintah `window.print()` untuk otomatis mencetak struk kasir (*thermal printer*).

### 🔗 Endpoint Mapping:
- **`GET /api/v1/billing/invoice/{encounter_no}`**: Dipanggil saat kasir memindai barcode kunjungan / memilih dari list.
- **`POST /api/v1/billing/pay`**: Mengonfirmasi pembayaran. *Penting: Backend menggunakan Saga dan Outbox pattern di sini, jadi kasir tidak perlu menunggu apotek memvalidasi secara sinkron, UI bisa langsung transisi ke status Lunas.*

---

## 5. Modul Apotek (Pharmacy)

### 🎯 UI/UX Best Practices:
- **Kanban Board Style:** Gunakan tampilan layaknya *Trello board* untuk memisahkan resep: 
  1. `Belum Lunas` (abu-abu, di-lock agar tidak di-dispense)
  2. `Siap Diramu` (Kuning, pasien sudah bayar)
  3. `Selesai / Menunggu Diambil` (Hijau)
- **Warning Badges:** Berikan ikon atau label merah pada obat yang stoknya minim ketika apoteker membuka rincian resep.

### 🔗 Endpoint Mapping:
- **`GET /api/v1/queue/pharmacy/stream`**: Endpoint *streaming* untuk memindahkan kartu Kanban secara *real-time* saat pembayaran di Kasir selesai.
- **`GET /api/v1/queue/pharmacy/estimate`**: Memberikan info pada layar tunggu pasien berapa lama waktu tunggu peracikan.
- **`POST /api/v1/pharmacy/dispense`**: Memproses pengeluaran obat dan merubah status di Kanban board menjadi 'Selesai'.

---

## 6. Modul Rekam Medis (Medical Record Verification)

### 🎯 UI/UX Best Practices:
- **Side-by-Side Comparison:** 
  - Kiri: Daftar raw input KBM yang dimasukkan dokter.
  - Kanan: Prediksi (Suggestions) ICD-10 dari sistem beserta input pencarian manual ICD-10.
- **Bulk Verification (Batch Mode):** Memungkinkan petugas rekam medis menceklis beberapa diagnosa sekaligus dan menekan 1 tombol verifikasi.
- **Keyboard Shortcuts:** Tambahkan *shortcut* seperti `Enter` untuk Verifikasi Cepat dan `Esc` untuk menutup dialog pencarian guna mempercepat kerja petugas.

### 🔗 Endpoint Mapping:
- **`GET /api/v1/emr/pending-icd10`**: Memuat *list* KBM yang belum dipetakan.
- **`GET /api/v1/emr/kbm/{code}/icd10-suggestions`**: Ditembak begitu petugas menyorot (klik) satu KBM, menampilkan rekomendasi ICD-10. (Sekarang ini dioptimalkan dengan `pg_trgm` di PostgreSQL).
- **`POST /api/v1/emr/verify-icd10`**: Melakukan pengesahan pemetaan kode standar.

---

> [!TIP]
> **Strategi Integrasi UI ke Backend:**
> 1. Manfaatkan field `trace_id` dan `request_id` di response sukses maupun error dari API Gateway, lalu simpan di state UI (misal: Redux/Zustand) dan kirimkan ke monitoring *frontend* (seperti Sentry) untuk memudahkan *end-to-end tracing*.
> 2. Pahami bahwa dengan arsitektur microservices kita, event seperti "Pembayaran Lunas" atau "Input Resep" ditransmisikan di belakang layar via Redis Streams. Gunakan endpoint **SSE Stream (`/stream`)** di Frontend untuk reaktivitas tinggi tanpa memberatkan server, dibanding melakukan `setInterval` HTTP Polling.
