# Kebutuhan Teknis (Technical Requirements) - SIMRS Rawat Jalan

## 1. Arsitektur Backend (Tech Stack)
- **Bahasa Pemrograman**: Golang (Go)
- **API Gateway**: Bertindak sebagai satu-satunya pintu masuk klien (Front-End/Mobile). Dibangun menggunakan `go-chi/chi` (REST/JSON) dan meneruskan *request* ke service internal.
- **Komunikasi Internal**: Menggunakan **gRPC (Protobuf)** untuk komunikasi *synchronous* antar-service (dari API Gateway ke Service, atau antar Service). Sangat cepat dan latensi rendah.
- **Arsitektur Internal**: Hexagonal Architecture (Ports and Adapters) untuk memisahkan *Business Logic* dari dependensi infrastruktur luar.
- **Database Access Layer**: `sqlc` (Men-generate kode Go secara *type-safe* langsung dari *raw SQL*, tanpa *overhead* lambat dari ORM).
- **Caching**: Redis Cache. Digunakan untuk:
  - Caching list KBM per-poliklinik untuk mempercepat autocomplete diagnosa dokter.
  - Caching entity master poliklinik (`master:polyclinics` hash mapping dan `master:polyclinics:all` JSON list) untuk lookup instan $O(1)$ lintas service (Registration, Kasir/Billing, Gateway) tanpa perlu join atau inter-service call gRPC berulang.
  - Pencarian ICD-10 mengandalkan ekstensi `pg_trgm` PostgreSQL untuk optimasi pencarian teks.
- **Message Broker**: Redis Streams (`XADD`, `XREADGROUP`) untuk menjamin *At-Least-Once Delivery* dan kapabilitas *Consumer Groups*.
- **API Documentation**: Swagger UI (Setiap service WAJIB mengekspos endpoint `/swagger/*` untuk memudahkan testing API dan integrasi Frontend).

## 2. Arsitektur Database & Distributed Transactions (Strict Multi-Schema)
- **Database Engine**: PostgreSQL 15.
- **Strategi Multi-Schema KETAT**: Seluruh database diisolasi per bounded context ke dalam skema terpisah di `simrs_db`:
  - `auth.*`: Master kredensial, role, refresh token, penugasan staf dokter/perawat ke poliklinik, audit login.
  - `patient.*`: Master demografi pasien dan penomoran MRN unik.
  - `registration.*`: Pendaftaran kunjungan dan antrean poliklinik (wajib memvalidasi `department_code` resmi).
  - `rawat_jalan.*`: Operasional poliklinik aktif (triage, tindakan, diagnosis, resep elektronik, agregat antrean), **Single Source of Truth (SSOT) Master Poliklinik (`polyclinics`)**, beserta **tabel replika lokal master katalog klinis**.
  - `medical_record.*`: Arsip rekam medis permanen, verifikasi KBM ke ICD-10, casemix INA-CBGs BPJS, dan **Single Source of Truth (SSOT) Master Terminologi Klinis (ICD-10, ICD-9, SNOMED, KBM, Tindakan)**.
  - `pharmacy.*`: Inventaris obat, resep farmasi, status penyerahan obat, antrean farmasi.
  - `billing.*`: Invoice tagihan, item tindakan, item obat, pemrosesan pembayaran kasir.
- **Aturan Isolasi Relasi KETAT**:
  - **Dilarang Mutlak Cross-Schema JOIN**: Setiap service hanya boleh query tabel di dalam skemanya sendiri.
  - **Zero Cross-Schema Foreign Keys**: Integritas data antar-service dikaitkan menggunakan *Business Key* seperti `mrn`, `encounter_no`, dan `department_code`. Validasi ditegakkan pada layer aplikasi.
  - **Clinical Snapshot Pattern**: Saat dokter/perawat menginput tindakan atau diagnosis di poliklinik, sistem menyimpan snapshot nama dan tarif pada saat transaksi terjadi ke tabel `rawat_jalan`. Hal ini mencegah ketergantungan join ke tabel master sekaligus mematuhi standar hukum rekam medis.
  - **Asynchronous Master Data Replication (Local Read-Replica)**: Unit Rekam Medis mengelola katalog master (ICD-10, ICD-9, SNOMED, KBM, Tindakan). Setiap pembaruan katalog dipublikasikan via Redis Stream `clinical_master_stream` dan disinkronkan secara asinkron ke tabel replika lokal di skema `rawat_jalan`.
- **Saga Pattern (Choreography)**: Digunakan untuk membatalkan (*rollback*) transaksi lintas service melalui pengiriman *event kompensasi* (Misal: membatalkan tagihan kasir jika obat habis).
- **Transactional Outbox Pattern**: Menggunakan tabel `outbox_events` di setiap skema. *Event message* disimpan dalam transaksi atomik SQL yang sama saat data di-save, menjamin 100% konsistensi pengiriman pesan ke Redis Streams.
- **Concurrency & Race Conditions**: Menggunakan `SELECT ... FOR UPDATE` (Pessimistic Locking) dan operasi *Atomic Update* SQL untuk menahan *Race Condition* pada pemotongan stok obat.
- **Global Sequence Generation**: Nomor identitas seperti *MRN* dan *Encounter* dibuat menggunakan operasi *Atomic* dari Redis (`INCR`) untuk mencegah duplikasi nomor antrean saat beban tinggi.

## 3. Version Control & Development Strategy (Git)
- **Branching per Service**: Setiap pengerjaan/pembuatan Microservice baru (atau fitur besar) WAJIB dilakukan di **Branch Baru** (contoh branch: `feature/poli`). 
- Penggabungan kode ke branch utama (`main`) baru dilakukan setelah servis di branch terisolasi tersebut rampung dan lolos uji integrasi.

## 4. Keamanan, Token & Pembagian Hak Akses (RBAC)
Sistem ini membutuhkan otentikasi **PASETO (Platform-Agnostic Security Tokens)**—alternatif modern dan lebih aman dari JWT—dengan skema keamanan berlapis:
- **Access Token & Refresh Token**: Login menghasilkan *access token* berumur pendek (15 menit) dan *refresh token* berumur panjang (7 hari) yang di-*hash* dengan SHA-256 dan disimpan di database. Hal ini memungkinkan rotasi sesi yang aman tanpa memaksa user sering login ulang.
- **Auto-Provisioning Admin**: Pada saat *startup*, `auth-service` akan membaca *Environment Variables* (`INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`) dan secara otomatis membuat akun *Super Admin* jika belum ada.

Otorisasi dibedakan untuk beberapa Role:
- **Admin / Resepsionis:** Pendaftaran master pasien baru/lama dan pembuatan antrean poli (`registration-service`).
- **Perawat:** Mengisi data pemeriksaan awal (triage/vital signs) di poliklinik (`rawat-jalan-service`).
- **Dokter:** Memulai pemeriksaan, mengisi diagnosa (KBM/ICD-10), tindakan, dan request resep (`rawat-jalan-service`).
- **Perekam Medis (Coder):** Melakukan verifikasi koding KBM ke ICD-10, penetapan severity level, pengkodean INA-CBGs BPJS, dan manajemen katalog master klinis (`medical-record-service`).
- **Apoteker:** Memvalidasi pembayaran tagihan, memproses resep, dan *dispense* obat ke pasien (`pharmacy-service`).
- **Kasir:** Melakukan verifikasi tagihan tindakan + resep, konfirmasi pelunasan pembayaran, dan monitoring rekap settlement harian (`billing-service`).

## 5. Microservices Division (8 Services)
1. **API Gateway (:8080)**: Menerima request REST/JSON dari luar, melakukan Circuit Breaking (`gobreaker`), RBAC auth middleware, caching layer Redis, dan meneruskan (proxy) request via gRPC ke service internal.
2. **User/Auth Service (:50051)**: Login, registrasi staff, manajemen master role/pegawai, penugasan dinas/piket poli, dan penertiban token **PASETO**.
3. **Patient Service (:50052)**: Pengelolaan master data pasien, generate MRN unik (Format `10-XX-XX-XX`).
4. **Registration Service (:50053)**: Pendaftaran kunjungan pasien (`encounter`) dengan validasi kode poliklinik resmi dan nomor antrean poliklinik.
5. **Rawat Jalan Service (:50057)**: Operasional poliklinik dokter dan perawat, form triage, tindakan klinis, diagnosis KBM/ICD-10, resep elektronik, antrean poli, replika lokal master klinis, dan **Single Source of Truth (SSOT) Master Poliklinik RS**.
6. **Medical Record Service (:50054)**: Pengelolaan berkas rekam medis, verifikasi koding KBM ke ICD-10/ICD-9, finalisasi severity klaim BPJS, dan Single Source of Truth (SSOT) katalog klinis RS.
7. **Pharmacy Service (:50055)**: Master obat & inventaris farmasi, validasi stok, proses peracikan resep, dan penyerahan obat (dispense).
8. **Billing Service (:50056)**: Penggabungan tagihan tindakan poliklinik dan tagihan obat resep menjadi invoice terpadu, modul kasir lengkap, pelunasan pembayaran, dan laporan rekapitulasi pendapatan.

## 6. Arsitektur "AI-Ready" untuk Estimasi Waktu Tunggu
Untuk memfasilitasi kalkulasi waktu tunggu cerdas tanpa merombak sistem *core*, proyek ini menerapkan **Dependency Injection (SOLID)**.

Pada Go (Service Registration & Pharmacy), terdapat *Interface* utama:
`type QueueEstimator interface { Estimate(data EstimatorPayload) int }`

1. **`StatisticalQueueEstimator`**: Menghitung rata-rata waktu (Moving Average) secara konvensional namun sangat cepat menggunakan tabel agregasi (*Materialized View*) di Database. (Solusi awal sebelum AI diterapkan).
2. **`MLQueueEstimator`**: Melakukan HTTP/gRPC Call ke *endpoint* external AI/Machine Learning. Sangat *plug-and-play* saat model cerdas siap digunakan.

## 7. Observability, Idempotency & Standarisasi API
- **Distributed Tracing (OpenTelemetry & Jaeger)**: Setiap request yang masuk ke API Gateway akan dicatat oleh OpenTelemetry dan diberikan `trace_id` unik. Trace ID ini diteruskan (propagate) ke semua service internal via `context` gRPC. Data *trace* (Span) ini kemudian akan di- *export* ke **Jaeger** untuk divisualisasikan dalam bentuk *Gantt Chart*, sehingga mempermudah deteksi *bottleneck* atau memantau waktu latensi lintas service secara profesional.
- **Idempotency Key (`X-Request-ID`)**: Untuk mencegah ekseskusi ganda (misal user mengklik tombol submit 2 kali), klien disarankan mengirimkan Header `X-Request-ID`. Backend akan menyimpan ID ini di Redis sementara (TTL singkat). Jika ID yang sama diterima lagi, sistem akan langsung memblokir atau mengembalikan *cached response* tanpa memproses ulang operasi database (Mencegah transaksi tagihan/stok ganda).
- **Standar API Response (Custom DTO)**: Semua service akan menggunakan struktur JSON yang sangat konsisten untuk 3 skenario utama:

  **1. Response Sukses**
  ```json
  {
    "request_id": "xxx",
    "trace_id": "abc-123",
    "success": true,
    "message": "Data berhasil diambil",
    "data": { "key": "value" }
  }
  ```

  **2. Response Sukses (Pagination)**
  ```json
  {
    "request_id": "xxx",
    "trace_id": "abc-123",
    "success": true,
    "message": "Data berhasil diambil",
    "data": [{ "key": "value" }],
    "meta": {
       "page": 1,
       "page-size": 10,
       "total_data": 50,
       "total_pages": 5,
       "prev_page": false,
       "next_page": true
    } 
  }
  ```

  **3. Response Error (Global Exception Handling)**
  Untuk mencegah bocornya detail implementasi gRPC (misal: "username already exists") ke pihak luar, sistem menerapkan *Global Exception Handling* di API Gateway.
  - Gateway mencegat error dari gRPC dan memetakannya ke string Bahasa Indonesia yang ramah pengguna (contoh: "Data sudah terdaftar di sistem. Silakan gunakan data lain.").
  - Detail teknis asli (*raw error*) hanya dicetak di Log Backend (menggunakan *structured logging* `slog`) untuk keperluan *debugging*.
  - Error validasi form (`pkg/validator`) juga mengembalikan balasan yang spesifik (misal: "tidak boleh kosong").

  Contoh respons error:
  ```json
  {
    "request_id": "xxx",
    "trace_id": "abc-123",
    "success": false,
    "message": "Data sudah terdaftar di sistem. Silakan gunakan data lain."
  }
  ```
