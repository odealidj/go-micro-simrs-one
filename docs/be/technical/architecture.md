# Kebutuhan Teknis (Technical Requirements) - SIMRS Rawat Jalan

## 1. Arsitektur Backend (Tech Stack)
- **Bahasa Pemrograman**: Golang (Go)
- **API Gateway**: Bertindak sebagai satu-satunya pintu masuk klien (Front-End/Mobile). Dibangun menggunakan `go-chi/chi` (REST/JSON) dan meneruskan *request* ke service internal.
- **Komunikasi Internal**: Menggunakan **gRPC (Protobuf)** untuk komunikasi *synchronous* antar-service (dari API Gateway ke Service, atau antar Service). Sangat cepat dan latensi rendah.
- **Arsitektur Internal**: Hexagonal Architecture (Ports and Adapters) untuk memisahkan *Business Logic* dari dependensi infrastruktur luar.
- **Database Access Layer**: `sqlc` (Men-generate kode Go secara *type-safe* langsung dari *raw SQL*, tanpa *overhead* lambat dari ORM).
- **Caching**: Redis Cache (Digunakan untuk menyimpan Master Data seperti ICD-10 yang jarang berubah agar mempercepat API).
- **Message Broker**: Redis Streams (`XADD`, `XREADGROUP`) untuk menjamin *At-Least-Once Delivery* dan kapabilitas *Consumer Groups*.
- **API Documentation**: Swagger UI (Setiap service WAJIB mengekspos endpoint `/swagger/*` untuk memudahkan testing API dan integrasi Frontend).

## 2. Arsitektur Database & Distributed Transactions
- **Database**: PostgreSQL (Satu DB fisik, namun dibagi ke dalam Multi-Schema untuk setiap service). Terdapat juga tabel sentral seperti `refresh_tokens` di skema `auth` untuk mengelola sesi berumur panjang.
- **Aturan Relasi**: Tidak boleh ada *JOIN* lintas schema. Integrasi data dikaitkan menggunakan *Business Key* seperti `mrn` dan `encounter_no`.
- **Saga Pattern (Choreography)**: Digunakan untuk membatalkan (*rollback*) transaksi yang melintasi beberapa service melalui pengiriman *event kompensasi* (Misal: membatalkan tagihan kasir jika obat habis).
- **Transactional Outbox Pattern**: Menggunakan tabel `outbox_messages` di database. *Event message* disimpan dalam transaksi SQL yang sama saat data di-save, menjamin 100% konsistensi pengiriman pesan ke Redis.
- **Concurrency & Race Conditions**: Menggunakan `SELECT ... FOR UPDATE` (Pessimistic Locking) dan operasi *Atomic Update* SQL untuk menahan *Race Condition* pada pemotongan stok obat.
- **Global Sequence Generation**: Nomor identitas seperti *MRN* dan *Encounter* dibuat menggunakan operasi *Atomic* dari Redis (`INCR`) untuk mencegah duplikasi nomor antrean saat beban tinggi.

## 3. Version Control & Development Strategy (Git)
- **Branching per Service**: Setiap pengerjaan/pembuatan Microservice baru (atau fitur besar) WAJIB dilakukan di **Branch Baru** (contoh branch: `feature/patient-service`, `feature/emr-service`). 
- Penggabungan kode ke branch utama (`main`) baru dilakukan setelah servis di branch terisolasi tersebut rampung. Hal ini mensimulasikan lingkungan *engineering* profesional.

## 4. Keamanan, Token & Pembagian Hak Akses (RBAC)
Sistem ini membutuhkan otentikasi **PASETO (Platform-Agnostic Security Tokens)**—alternatif modern dan lebih aman dari JWT—dengan skema keamanan berlapis:
- **Access Token & Refresh Token**: Login menghasilkan *access token* berumur pendek (15 menit) dan *refresh token* berumur panjang (7 hari) yang di-*hash* dengan SHA-256 dan disimpan di database. Hal ini memungkinkan rotasi sesi yang aman tanpa memaksa user sering login ulang.
- **Auto-Provisioning Admin**: Pada saat *startup*, `auth-service` akan membaca *Environment Variables* (`INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`) dan secara otomatis membuat akun *Super Admin* jika belum ada, menghilangkan ketergantungan pada *database seeder* manual.

Otorisasi dibedakan untuk beberapa Role:
- **Admin / Resepsionis:** Pendaftaran pasien baru dan lama.
- **Perawat:** Mengisi data pemeriksaan awal (triage/vital signs).
- **Dokter:** Mengisi diagnosa (KBM), tindakan, dan request resep.
- **Rekam Medis:** Melakukan verifikasi dan pemetaan (mapping) dari KBM ke standar ICD-10.
- **Apoteker:** Memproses resep obat dan *dispense* ke pasien.
- **Kasir:** Proses konfirmasi pembayaran (*billing*).

## 5. Microservices Division
1. **API Gateway**: Menerima request REST/JSON dari luar, meneruskan (proxy) request via gRPC ke service internal.
2. **User/Auth Service:** Login, registrasi staff, dan penertiban token **PASETO**.
3. **Patient Service:** Pengelolaan master pasien, generate MRN (Format `10-XX-XX-XX`).
4. **Registration Service:** Kunjungan pasien (`encounter`) dan nomor antrean poliklinik.
5. **EMR Service:** Pemeriksaan perawat, diagnosa (KBM) beserta mapping ICD-10, tindakan, resep, serta *Summary Tables* untuk perhitungan durasi.
6. **Pharmacy Service:** Master data obat, pemotongan stok, proses resep (dispense).
7. **Billing Service:** Pembuatan *invoice* (tagihan) dari EMR dan Apotek.

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
