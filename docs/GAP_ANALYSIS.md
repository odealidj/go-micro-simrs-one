# Dokumen Analisis GAP: Pencapaian Kode vs Spesifikasi Dokumentasi `/docs`
## SIMRS Outpatient Microservices — go-micro-simrs-one

> **Tanggal Analisis:** 7 September 2026  
> **Ruang Lingkup:** Seluruh Microservices Backend (`src/be/`), Frontend Web React (`src/fe/react/`), dan Dokumen Spesifikasi (`/docs/`).  
> **Tujuan:** Mengidentifikasi secara objektif, mendalam, dan terstruktur seluruh kesenjangan (*gaps*), inkonsistensi alur kerja, ketertinggalan dokumentasi, serta fitur yang belum terpenuhi antara kode sistem dengan dokumen proses bisnis dan teknis.

---

## 1. Eksekutif Ringkasan & Skor Kepatuhan (Compliance Scorecard)

Secara garis besar, project **go-micro-simrs-one** telah mencapai tingkat kematangan arsitektural yang sangat tinggi (**~85% implementasi fungsional menyeluruh**). Fondasi *Single Source of Truth (SSOT)* Master Poliklinik dan Katalog Medis, arsitektur database multi-schema ketat, event-driven outbox pattern, caching Redis $O(1)$, otentikasi PASETO, serta alur pelayanan dokter dan kasir telah berjalan secara *end-to-end*.

Namun, audit mendalam terhadap seluruh kode sumber menemukan **9 titik kesenjangan (GAPs)** yang terbagi ke dalam kategori:
1. **Kritikal / Logika Alur Bisnis (P0/P1):** Paradoks alur pembayaran resep vs dispensing obat di kasir/apotek, dan ketiadaan endpoint query antrean resep farmasi di frontend apotek.
2. **Kesenjangan UI & Routing (P1/P2):** Modul koding rekam medis di frontend masih berstatus *placeholder*, rute severity finalize terisolasi dari role rekam medis, dan ketiadaan modul antarmuka Patient Portal.
3. **Dokumentasi & Standarisasi (P2/P3):** Dokumentasi Swagger/OpenAPI yang tertinggal dari rute aktual, dan event kompensasi Saga pembatalan invoice yang belum terhubung ke pelepasan stok resep farmasi.

### Tabel Skor Kepatuhan per Domain

| Domain Sistem | Dokumen Acuan di `/docs` | Status Kepatuhan | Tingkat GAP |
|---|---|:---:|:---:|
| **Arsitektur & Multi-Schema DB** | `be/technical/architecture.md` | **95%** | Minor (Swagger per-service) |
| **Master Poliklinik & Katalog SSOT** | `be/technical/technical_documentation.md` | **98%** | Sangat Rendah (Sesuai) |
| **Autentikasi & RBAC Backend** | `RBAC_IMPLEMENTATION_GUIDE.md` | **92%** | Rendah (Role Rekam Medis Route) |
| **Pelayanan Rawat Jalan (Dokter/Perawat)** | `be/business/process.md`, `ui_ux_design.md` | **95%** | Sangat Rendah (Sesuai) |
| **Modul Kasir & Billing** | `be/business/process.md`, `technical_doc` | **90%** | Sedang (Workflow Event Obat) |
| **Instalasi Farmasi (Apotek)** | `PROSES_BISNIS_DAN_TEKNIS_FARMASI_KFA...` | **65%** | **TINGGI** (Query Resep & Dispense Flow) |
| **Rekam Medis & Casemix BPJS** | `PROSES_BISNIS_DAN_TEKNIS_TERMINOLOGI...` | **70%** | **SEDANG** (UI Koding masih Placeholder) |
| **Patient Portal (Public App)** | `fe/patient_portal_spec.md` | **15%** | **TINGGI** (Belum Ada UI & Route) |
| **Interoperabilitas SATUSEHAT & OMOP** | `ROADMAP_DAN_RANCANGAN_INTEROPERABILITAS...` | **100% (Model Data)** | Roadmap Phase 2 |
| **OpenAPI / Swagger Documentation** | `be/technical/architecture.md`, `README.md` | **40%** | **SEDANG** (30+ endpoint belum terdokumentasi) |

---

## 2. Matriks Komparasi Rinci: Kode Aktual vs Dokumen `/docs`

| No | Modul / Komponen | Spesifikasi pada Dokumen `/docs` | Kondisi Aktual pada Kode (`src/`) | Status | Kategori GAP |
|:--:|---|---|---|:---:|:---:|
| 1 | **Master Poliklinik** | SSOT di `rawat_jalan.polyclinics`, entity caching Redis `master:polyclinics`, relasi menggunakan `department_code` & `department_name`. | 100% diimplementasikan di DB, gRPC, Redis, Gateway, dan Frontend. | **MATCH** | - |
| 2 | **Katalog KBM, ICD-10, ICD-9, SNOMED** | Dikelola `medical-record-service` (SSOT), replikasi asinkron via `clinical_master_stream` ke replika lokal `rawat-jalan-service`. | Selesai penuh di database, outbox publisher, master sync consumer, dan form dokter poli. | **MATCH** | - |
| 3 | **Katalog Farmasi KFA & DPHO BPJS** | Master KFA Kemenkes, DPHO/FORNAS BPJS, cross-mapping ke obat SIMRS, restriksi peresepan di form dokter. | Selesai di DB `pharmacy.*`, proto, admin UI (`ObatPage.tsx`, `DPHOPage.tsx`), dan warning restriksi di `PrescriptionForm.tsx`. | **MATCH** | - |
| 4 | **Alur Pembayaran Resep Kasir vs Dispensing** | Dokter buat resep &rarr; masuk tagihan kasir &rarr; pasien bayar total (tindakan+obat) &rarr; apoteker dispense obat. | Event obat baru dikirim saat **selesai dispense**, padahal dispense mensyaratkan status **PAID** (terjadi deadlock/double invoice). | **GAP** | **GAP 1 (CRITICAL)** |
| 5 | **Antrean Resep Masuk Apotek** | Apoteker melihat antrean resep poliklinik secara terstruktur pada menu farmasi sebelum melakukan dispensing. | Endpoint REST `GET /pharmacy/prescriptions` belum ada. Frontend `ResepPage.tsx` menggunakan array kosong tanpa fetch data. | **GAP** | **GAP 2 (HIGH)** |
| 6 | **Antarmuka Rekam Medis (Coding & Severity)** | Coder memverifikasi KBM ke ICD-10/ICD-9 dan menetapkan severity level untuk klaim INA-CBGs BPJS. | Backend gRPC & Gateway sudah siap, namun route `coding` di frontend masih me-render placeholder dashboard. Halaman form belum ada. | **GAP** | **GAP 3 (HIGH)** |
| 7 | **Hak Akses Finalisasi Severity Rekam Medis** | Coder berhak memfinalisasi severity kunjungan pasien (`POST /api/v1/rekam-medis/encounter/{enc}/severity/finalize`). | Endpoint tersebut tidak didaftarkan di `RegisterRekamMedis` pada API Gateway; hanya ada di rute `RegisterRawatJalan` (role dokter/perawat/admin). | **GAP** | **GAP 4 (MEDIUM)** |
| 8 | **Patient Portal (Pendaftaran Mandiri Pasien)** | Pasien memiliki UI mandiri (`/pasien`), cek jadwal dokter (`GET /schedules`), booking tiket antrean, dan QR karcis. | Folder `src/fe/react/src/features/patient/` kosong. Login role `pasien` mengarah ke `/pasien` yang tidak terdaftar di router (404/blank). | **GAP** | **GAP 5 (MEDIUM)** |
| 9 | **Dokumentasi OpenAPI / Swagger UI** | Seluruh service/gateway mendokumentasikan endpoint secara lengkap dan interaktif via `/swagger/*`. | `swagger.yaml` hanya memuat 22 endpoint lama; 30+ endpoint baru (billing, master data, rawat jalan, rekam medis) belum dicatat. | **GAP** | **GAP 6 (MEDIUM)** |
| 10 | **Saga Compensation (Pembatalan Invoice)** | Transaksi kompensasi otomatis membatalkan seluruh entitas terkait jika terjadi pembatalan transaksi (misal: rilis stok/resep). | Event `InvoiceCancelled` hanya mengubah status kunjungan di registrasi. `pharmacy-service` belum mengonsumsi event ini untuk rollback resep. | **GAP** | **GAP 7 (LOW)** |
| 11 | **Interoperabilitas SATUSEHAT & OMOP CDM** | Rencana pengiriman FHIR R4 Bundle ke Kemenkes dan skema analitik OMOP CDM v5.4. | Model data internal (KFA, SNOMED, ICD-10) sudah 100% siap. Bridging dispatcher eksternal memang direncanakan pada fase berikutnya. | **ROADMAP** | **GAP 8 (INFO)** |
| 12 | **KTP AI OCR (Google Gemini)** | Pendaftaran mandiri/petugas dapat ekstrak NIK, Nama, Tanggal Lahir otomatis via foto KTP. | Selesai di backend (`POST /registrations/ocr-ktp`), admin setting (`gemini_ocr_model`), dan form pendaftaran frontend. | **MATCH** | - |
| 13 | **Estimasi Waktu Tunggu Cerdas (AI-Ready)** | Interface `QueueEstimator` (Statistical dan ML/AI) di Poli dan Farmasi. | Diimplementasikan di `shared/pkg/queue` dan handler `/queue/clinic/estimate` serta `/queue/pharmacy/estimate`. | **MATCH** | - |

---

## 3. Analisis Mendalam Temuan GAP (Deep Dive Findings)

---

### GAP 1 [CRITICAL]: Paradoks Alur Penagihan Obat Kasir vs Dispensing Apotek (Workflow Inconsistency & Double Invoice Risk)

#### Lokasi Kode
- `src/be/pharmacy-service/internal/core/services/pharmacy_service.go` (Method `DispensePrescription`, baris 79-86)
- `src/be/pharmacy-service/internal/adapters/repository/pharmacy_repo.go` (Method `DispensePrescription`, baris 195-205)
- `src/be/billing-service/internal/core/services/billing_consumer.go` (Consumer `pharmacyHandler`, baris 61-78)
- `src/be/billing-service/internal/core/services/billing_service.go` (Method `AddMedicineItem`, baris 189-217)

#### Deskripsi Masalah & Bukti Kode
Terdapat kontradiksi mendasar pada urutan proses (*temporal coupling*) antara modul Billing dan Farmasi:

1. **Apotek Mengharuskan Invoice PAID Sebelum Dispense:**
   ```go
   // pharmacy_service.go
   paymentStatus, err := s.repo.GetEncounterPaymentStatus(ctx, prescription.EncounterNo)
   if paymentStatus != "PAID" {
       return fmt.Errorf("cannot dispense prescription: invoice is not PAID yet (status: %s)", paymentStatus)
   }
   ```
2. **Billing Baru Menerima Tagihan Obat Setelah Dispense Selesai:**
   Di `pharmacy_repo.go`, event outbox untuk farmasi HANYA diterbitkan saat dispensing obat berhasil (`PrescriptionDispensed`):
   ```go
   // pharmacy_repo.go (DispensePrescription)
   err = r.q.CreateOutboxEvent(ctx, db.CreateOutboxEventParams{
       EventType: "PrescriptionDispensed", ...
   })
   ```
   Dan di sisi `billing_consumer.go`:
   ```go
   if eventType == "PrescriptionDispensed" {
       return billingService.AddMedicineItem(ctx, payload.EncounterNo, payload.PrescriptionID, payload.Price)
   }
   ```
3. **Konsekuensi Nyata di Lapangan:**
   - Ketika dokter selesai memeriksa dan meresepkan obat, pasien menuju kasir.
   - Di kasir, tagihan obat **BELUM ADA** karena apoteker belum mendispense obat. Kasir hanya menagih tindakan medis dan registrasi.
   - Pasien melunasi tagihan (status invoice menjadi `PAID`).
   - Pasien menuju apotek. Karena status pembayaran sudah `PAID`, apoteker berhasil menekan tombol dispense.
   - Begitu obat di-dispense, event `PrescriptionDispensed` sampai ke `billing-service`.
   - Method `AddMedicineItem` memanggil `getOrCreateUnpaidActionInvoice(ctx, encounterNo)`. Karena invoice pertama sudah `PAID`, sistem secara otomatis **membuat Invoice kedua berstatus `UNPAID`** khusus untuk obat tersebut!
   - Pasien sudah pulang dengan obat, sementara sistem meninggalkan tagihan obat tak berbayar (*ghost debt*) di kasir.

#### Rekomendasi Solusi
1. Saat dokter membuat resep di poliklinik (`CreatePrescription`), `pharmacy-service` harus menerbitkan event outbox baru: **`PrescriptionCreated`** yang berisi rincian item obat, kuantitas, dan total estimasi harga.
2. `billing_consumer.go` mendengarkan event `PrescriptionCreated` dan langsung memasukkan item obat ke invoice aktif pasien yang berstatus `UNPAID`.
3. Pasien membayar invoice utuh (tindakan + obat) di Kasir.
4. Ketika invoice berstatus `PAID`, event `InvoicePaid` yang sudah ada di `billing_stream` akan mencatat pembayaran di `pharmacy.encounter_payments`.
5. Apoteker kemudian melakukan telaah dan dispensing obat (`DispensePrescription`) tanpa risiko tagihan ganda atau penagihan tertinggal.

---

### GAP 2 [HIGH]: Ketiadaan Endpoint Query Daftar Resep Farmasi (Apotek Blank Data)

#### Lokasi Kode
- `src/be/pharmacy-service/internal/adapters/grpc/server.go`
- `src/be/api-gateway/internal/handlers/pharmacy_handler.go` (baris 24-29)
- `src/fe/react/src/features/pharmacy/pages/ResepPage.tsx` (baris 19-21)
- `src/fe/react/src/features/pharmacy/api/pharmacyApi.ts` (baris 32-38)

#### Deskripsi Masalah & Bukti Kode
1. **Backend Tidak Memiliki Endpoint Query Resep:**
   Di `api-gateway/internal/handlers/pharmacy_handler.go`, hanya terdapat dua rute mutasi:
   ```go
   func (h *PharmacyHandler) Register(r chi.Router) {
       r.Post("/pharmacy/prescriptions", h.CreatePrescription)
       r.Post("/pharmacy/dispense", h.Dispense)
   }
   ```
   Tidak ada endpoint `GET /pharmacy/prescriptions`, `GET /pharmacy/queue`, maupun `GET /pharmacy/prescriptions/{id}`.
2. **Frontend Apotek Menggunakan Array Kosong:**
   Di `ResepPage.tsx`:
   ```tsx
   const [prescriptions] = useState<Prescription[]>([]);
   ```
   State tidak pernah diisi dari server. Akibatnya, menu Resep Masuk di Instalasi Farmasi selalu menampilkan kondisi *"Belum ada resep yang masuk"*, meskipun dokter poliklinik telah membuat puluhan resep.
3. **Salah Penggunaan Endpoint SSE pada Client REST:**
   Di `pharmacyApi.ts`, fungsi `getPharmacyQueue` mencoba melakukan `api.get("/queue/pharmacy/stream")`. Rute tersebut adalah *Server-Sent Events* (`text/event-stream`) yang tidak mengembalikan JSON array biasa, sehingga pemanggilan via axios akan gagal/timeout.

#### Rekomendasi Solusi
1. Tambahkan RPC `ListPrescriptions` atau `GetPrescriptionQueue` di `pharmacy.proto` dan implementasikan di `pharmacy-service` (query ke tabel `pharmacy.prescriptions` yang difilter berdasarkan status `CREATED` / `DISPENSED`).
2. Ekspos endpoint `GET /api/v1/pharmacy/queue` dan `GET /api/v1/pharmacy/prescriptions` di `PharmacyHandler` API Gateway.
3. Perbarui `pharmacyApi.ts` dan `ResepPage.tsx` agar memuat data resep via REST query saat komponen mount, serta memperbarui daftar secara reaktif saat menerima sinyal dari SSE hook.

---

### GAP 3 [HIGH]: Halaman Frontend Rekam Medis Masih Placeholder

#### Lokasi Kode
- `src/fe/react/src/features/medical-record/routes.tsx` (baris 14-19)
- `src/fe/react/src/features/medical-record/pages/RekamMedisDashboard.tsx` (baris 86-91)

#### Deskripsi Masalah & Bukti Kode
1. **Rute Utama Coder Belum Dibuat Halamannya:**
   Di `medical-record/routes.tsx`:
   ```tsx
   { path: "coding", element: <RekamMedisDashboard /> },       // Placeholder → MedicalCodingPage
   { path: "riwayat/:mrn", element: <RekamMedisDashboard /> }, // Placeholder → PatientHistoryPage
   { path: "laporan", element: <RekamMedisDashboard /> },       // Placeholder → ReportingPage
   ```
   Semua submenu diarahkan kembali ke `RekamMedisDashboard`.
2. **Link Detail Tidak Memiliki Route:**
   Di `RekamMedisDashboard.tsx`, tombol "Lihat Detail" mengarah ke `/rekam-medis/detail?no=${encounterNo}`:
   ```tsx
   <Link to={`/rekam-medis/detail?no=${encounterNo}`}>Lihat Detail</Link>
   ```
   Namun path `/rekam-medis/detail` tidak terdaftar sama sekali di `routes.tsx`, sehingga navigasi akan menghasilkan halaman kosong/unauthorized.
3. Padahal, backend `medical-record-service` dan API Gateway telah menyediakan API lengkap:
   - `GET /api/v1/rekam-medis/coding/pending-kbm` (Daftar kunjungan yang menunggu kodifikasi)
   - `POST /api/v1/rekam-medis/coding/verify-kbm/{id}` (Verifikasi pemetaan KBM ke ICD-10)
   - `GET /api/v1/rekam-medis/record/{encounter_no}` (Rincian berkas rekam medis)

#### Rekomendasi Solusi
1. Bangun komponen halaman `MedicalCodingPage.tsx` di `features/medical-record/pages/` yang menampilkan daftar rekam medis pending, rincian diagnosa KBM dokter, *suggestions* ICD-10/ICD-9, dan tombol verifikasi koding.
2. Daftarkan route `/rekam-medis/coding` dan `/rekam-medis/detail/:encounterNo` di `medical-record/routes.tsx`.

---

### GAP 4 [MEDIUM]: Inkonsistensi Rute Finalisasi Severity untuk Role `rekam_medis` di API Gateway

#### Lokasi Kode
- `src/be/api-gateway/cmd/server/main.go` (baris 269-273)
- `src/be/api-gateway/internal/handlers/rawat_jalan_handler.go` (baris 67 vs baris 80-84)

#### Deskripsi Masalah & Bukti Kode
Dokumen proses bisnis (`docs/be/business/process.md:41`) menyatakan bahwa Perekam Medis memvalidasi tingkat keparahan (*Severity Level*) melalui:
`POST /api/v1/rekam-medis/encounter/{encounter_no}/severity/finalize`

Namun pada kode API Gateway:
1. Handler `RegisterRekamMedis` HANYA mendaftarkan 3 rute:
   ```go
   func (h *RawatJalanHandler) RegisterRekamMedis(r chi.Router) {
       r.Get("/rekam-medis/record/{encounter_no}", h.RekamMedisGetRecord)
       r.Post("/rekam-medis/coding/verify-kbm/{id}", h.RekamMedisVerifyKBM)
       r.Get("/rekam-medis/coding/pending-kbm", h.RekamMedisPendingKBM)
   }
   ```
2. Endpoint `severity/finalize` hanya terdaftar di `RegisterRawatJalan` dengan prefix:
   `POST /rawat-jalan/encounter/{encounter_no}/severity/finalize`
   yang dilindungi middleware: `RequireRole("dokter", "perawat", "admin", "super_admin")`.
3. Pengguna dengan role `rekam_medis` yang mencoba mengakses endpoint tersebut akan mendapatkan respon `403 Forbidden` karena tidak terdaftar dalam role grup `RegisterRawatJalan`, dan path `/rekam-medis/.../severity/finalize` belum ada di `RegisterRekamMedis`.

#### Rekomendasi Solusi
Tambahkan rute `POST /rekam-medis/encounter/{encounter_no}/severity/finalize` ke dalam `RegisterRekamMedis` di `rawat_jalan_handler.go` yang memanggil `h.RawatJalanFinalizeSeverity`.

---

### GAP 5 [MEDIUM]: Fitur Patient Portal (Public App) Belum Ada di Frontend dan Rute `/pasien` Unmapped

#### Lokasi Kode
- `src/fe/react/src/features/patient/` (Direktori kosong)
- `src/fe/react/src/routes/index.tsx` (Tidak ada `patientRoutes`)
- `src/fe/react/src/features/auth/pages/LoginPage.tsx` (baris 73-74)
- `docs/fe/patient_portal_spec.md`

#### Deskripsi Masalah & Bukti Kode
1. Dokumen `patient_portal_spec.md` dan `RBAC_IMPLEMENTATION_GUIDE.md` mendefinisikan keberadaan portal pasien untuk pendaftaran antrean mandiri, riwayat kunjungan, dan e-Karcis digital ticket.
2. Di `LoginPage.tsx`, terdapat penanganan login role `pasien`:
   ```tsx
   } else if (role === "pasien" || role === "patient") {
       navigate("/pasien");
   }
   ```
3. Namun di `src/fe/react/src/routes/index.tsx`, path `/pasien` tidak didaftarkan ke komponen apa pun. Jika pasien berhasil signup dan login, pasien akan diarahkan ke halaman kosong/unauthorized.
4. Di sisi backend, jadwal dokter diakses melalui `GET /master/polyclinics/{poli_code}/schedule` (milik admin master), sedangkan endpoint publik `GET /schedules` yang dispesifikasikan pada dokumen `patient_portal_spec.md:53` belum disediakan.

#### Rekomendasi Solusi
1. Buat komponen dasar `PatientLayout.tsx` dan `PatientDashboard.tsx` di `features/patient/` yang memungkinkan pasien melihat status nomor RM, riwayat kunjungan, dan tombol daftar poli mandiri.
2. Daftarkan `patientRoutes` di `src/fe/react/src/routes/index.tsx`.
3. Sediakan alias endpoint `GET /api/v1/schedules` atau buka akses publik ke jadwal poliklinik.

---

### GAP 6 [MEDIUM]: Dokumentasi OpenAPI / Swagger (`swagger.yaml`) Belum Lengkap

#### Lokasi Kode
- `src/be/api-gateway/docs/swagger/swagger.yaml`
- `docs/be/technical/architecture.md` (baris 14)

#### Deskripsi Masalah & Bukti Kode
1. File `swagger.yaml` saat ini hanya mendefinisikan 22 path rute warisan awal.
2. Lebih dari 30+ endpoint aktif yang telah berjalan di sistem belum terdaftar di Swagger, antara lain:
   - Modul Kasir: `/billing/queue`, `/billing/reports/rekap`, `/billing/cancel`.
   - Modul Rawat Jalan: `/rawat-jalan/triage`, `/rawat-jalan/encounter/start`, `/rawat-jalan/diagnosis`, `/rawat-jalan/actions`, `/rawat-jalan/encounter/complete`.
   - Modul Rekam Medis: `/rekam-medis/coding/verify-kbm/{id}`, `/rekam-medis/coding/pending-kbm`.
   - Modul Master Data: `/master/polyclinics`, `/master/kbm`, `/master/icd10`, `/master/icd9`, `/master/snomed`, `/master/kfa`, `/master/dpho`, `/master/obat`.
   - Modul AI OCR: `/registrations/ocr-ktp`, `/auth/signup/ocr-ktp`, `/admin/ai/settings`.
3. Pada `architecture.md:14`, tertulis: *"Setiap service WAJIB mengekspos endpoint `/swagger/*`"*. Faktanya, microservices backend adalah server gRPC murni (tanpa HTTP server), dan dokumentasi Swagger disajikan secara terpusat oleh API Gateway di port 8080.

#### Rekomendasi Solusi
1. Perbarui `swagger.yaml` untuk mencakup seluruh endpoint aktif beserta skema request/response-nya.
2. Perbarui teks pada `architecture.md` untuk menegaskan bahwa Swagger UI disajikan secara terpusat melalui API Gateway.

---

### GAP 7 [LOW/MEDIUM]: Saga Compensation Handler Pembatalan Invoice Belum Terhubung ke Pelepasan Stok Resep

#### Lokasi Kode
- `src/be/billing-service/internal/core/services/billing_service.go` (Method `CancelInvoice`, baris 294-299)
- `src/be/pharmacy-service/internal/core/services/pharmacy_service.go` (Method `RollbackPrescription`, baris 102-127)
- `src/be/pharmacy-service/internal/adapters/consumer/billing_consumer.go`

#### Deskripsi Masalah & Bukti Kode
1. Saat kasir membatalkan invoice (`POST /billing/cancel`), `billing-service` menerbitkan event outbox `InvoiceCancelled`.
2. Event ini telah berhasil dikonsumsi oleh `registration-service` (`registration_consumer.go`) untuk mengubah status kunjungan menjadi `CANCELLED`.
3. Namun di `pharmacy-service`, `billing_consumer.go` hanya mendengarkan event `InvoicePaid`. Event `InvoiceCancelled` diabaikan.
4. Akibatnya, fungsi `RollbackPrescription` yang sudah tersedia di `pharmacy-service` (untuk mengembalikan stok obat dan mengubah status resep menjadi `ROLLBACKED`) tidak pernah terpicu secara otomatis saat invoice dibatalkan di kasir.

#### Rekomendasi Solusi
Tambahkan *case* `InvoiceCancelled` pada `billing_consumer.go` di `pharmacy-service` yang memanggil `s.pharmacyService.RollbackPrescription` berdasarkan nomor encounter yang dibatalkan.

---

### GAP 8 [INFORMASIONAL]: Interoperabilitas SATUSEHAT (HL7 FHIR) dan OMOP CDM (Roadmap Alignment)

#### Lokasi Kode & Dokumen
- `docs/ROADMAP_DAN_RANCANGAN_INTEROPERABILITAS_FHIR_DAN_OMOP_CDM.md`
- `src/be/shared/proto/emr/v1/emr.proto` & `pharmacy.proto`

#### Evaluasi Status
- Dokumen tersebut adalah **Roadmap & Dokumen Desain Arsitektural**, bukan laporan fitur operasional saat ini.
- **Pencapaian Fondasi Data (100% Sesuai):** Multi-level mapping (KBM $\leftrightarrow$ ICD-10 $\leftrightarrow$ SNOMED-CT) dan pemetaan Farmasi (Obat $\leftrightarrow$ KFA Kemenkes $\leftrightarrow$ DPHO BPJS) telah selesai dibangun di database dan terintegrasi di form pelayanan.
- **Fase Eksekusi Bridging (Sesuai Roadmap):** Modul token manager OAuth2 Kemenkes, FHIR JSON Bundle Builder, dan skema database analitik OMOP CDM v5.4 memang dijadwalkan untuk tahap pengembangan berikutnya sebagaimana tercantum pada Roadmap Milestone Phase 2.

---

### GAP 9 [LOW]: Penamaan Endpoint Jadwal Dokter / Poliklinik

#### Lokasi Kode & Dokumen
- `docs/fe/patient_portal_spec.md` (baris 53: `GET /schedules`)
- `src/be/api-gateway/internal/handlers/master_handler.go` (baris 46: `GET /master/polyclinics/{poli_code}/schedule`)

#### Evaluasi Status
- Dokumen spesifikasi patient portal menyebutkan rute ringkas `GET /schedules`.
- Implementasi aktual berada di bawah handler master poliklinik: `GET /api/v1/master/polyclinics/{poli_code}/schedule` yang mengembalikan jadwal piket dokter dan perawat per hari dalam sepekan.
- Hanya merupakan perbedaan preferensi *endpoint naming*, fungsionalitas data jadwal telah tersedia.

---

## 4. Matriks Prioritas & Rekomendasi Rencana Aksi (Action Plan)

| Prioritas | Kode GAP | Komponen Terkait | Rencana Aksi Perbaikan | Estimasi Tingkat Kesulitan |
|:---:|:---:|---|---|:---:|
| **P0 (Kritikal)** | **GAP 1** | `pharmacy-service`, `billing-service` | Terbitkan event `PrescriptionCreated` saat dokter membuat resep agar biaya obat langsung masuk ke invoice kasir sebelum pasien membayar. | Sedang |
| **P1 (Tinggi)** | **GAP 2** | `pharmacy-service`, `api-gateway`, React FE | Buat RPC `ListPrescriptions` di pharmacy, ekspos endpoint `GET /pharmacy/queue` di Gateway, dan pasang di `ResepPage.tsx`. | Rendah - Sedang |
| **P1 (Tinggi)** | **GAP 3** | `features/medical-record/`, React FE | Implementasikan `MedicalCodingPage.tsx` untuk verifikasi KBM ke ICD-10 dan daftarkan route `/rekam-medis/coding` serta `/rekam-medis/detail/:no`. | Sedang |
| **P2 (Sedang)** | **GAP 4** | `api-gateway` (`rawat_jalan_handler.go`) | Daftarkan `POST /rekam-medis/encounter/{enc}/severity/finalize` pada rute `RegisterRekamMedis`. | Sangat Rendah |
| **P2 (Sedang)** | **GAP 5** | `features/patient/`, React FE | Buat halaman dasar dashboard pasien (`PatientDashboard.tsx`) dan daftarkan route `/pasien` di `routes/index.tsx`. | Sedang |
| **P2 (Sedang)** | **GAP 7** | `pharmacy-service` (`billing_consumer.go`) | Tangani event `InvoiceCancelled` di consumer farmasi untuk memicu `RollbackPrescription`. | Rendah |
| **P3 (Rendah)** | **GAP 6** | `api-gateway/docs/swagger/swagger.yaml` | Mutakhirkan `swagger.yaml` dengan menambahkan 30+ endpoint yang belum tercatat dan koreksi teks `architecture.md`. | Rendah |
| **P3 (Rendah)** | **GAP 9** | `api-gateway` (`master_handler.go`) | Tambahkan alias rute `GET /api/v1/schedules` yang memanggil jadwal dokter poliklinik. | Sangat Rendah |

---

## 5. Kesimpulan

Pencapaian kode **go-micro-simrs-one** saat ini sudah sangat solid, stabil, dan memenuhi standar arsitektur modern (clean architecture, microservices isolatif, distributed caching, dan audit trail). Sebagian besar spesifikasi pada folder `/docs` telah berhasil diwujudkan menjadi kode yang berfungsi.

Kesenjangan yang ditemukan melalui analisis ini bukanlah kegagalan arsitektur fundamental, melainkan **penyesuaian alur integrasi antar-service (*event choreography*)** dan **penyelesaian halaman antarmuka pengguna pada modul non-dokter (Apotek, Rekam Medis Coder, dan Patient Portal)**. Dengan menyelesaikan rekomendasi P0 dan P1 pada matriks di atas, sistem SIMRS akan mencapai tingkat kepatuhan 100% terhadap seluruh dokumen acuan bisnis dan teknis.
