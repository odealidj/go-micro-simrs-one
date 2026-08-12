# Dokumen Serah Terima (Handover) — go-micro-simrs-one

> **Dibuat:** 10 Agustus 2026  
> **Tujuan:** Dokumen ini dirancang agar agen AI, model, atau developer lain dapat melanjutkan pengembangan secara mandiri tanpa perlu bertanya dari awal.

---

## 1. Identitas Proyek

| Field | Detail |
|-------|--------|
| **Nama Proyek** | go-micro-simrs-one |
| **Repository** | `github.com/odealidj/go-micro-simrs-one` |
| **Branch Aktif** | `main` |
| **Commit Terakhir** | `3d74497` — feat: implement full event-driven outbox pattern & billing service |
| **Lokasi Lokal** | `/home/aliube/Workspace/Project-Personal/Go/Gemini/go-micro-simrs-one` |
| **Tujuan Proyek** | SIMRS (Sistem Informasi Manajemen Rumah Sakit) Rawat Jalan — sekaligus sebagai *portfolio showcase* untuk rekruiter |

---

## 2. Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Bahasa | Go (Golang) |
| API Gateway | `go-chi/chi` (REST/JSON → proxy ke gRPC) |
| Komunikasi Internal | gRPC + Protobuf |
| Arsitektur Internal | **Hexagonal Architecture** (Ports & Adapters) |
| Database | PostgreSQL 15 — multi-schema (1 DB fisik, schema per service) |
| Database Access | `sqlc` (type-safe SQL, tanpa ORM) |
| Caching | Redis 7 |
| Message Broker | **Redis Streams** (`XADD`, `XREADGROUP`) |
| Auth Token | **PASETO v4** (`aidanwoods.dev/go-paseto`) |
| Observability | OpenTelemetry + **Jaeger** |
| Containerization | Podman / Docker Compose |
| API Docs | Swagger UI (static file dari `docs/swagger/`) |

---

## 3. Struktur Direktori

```
go-micro-simrs-one/
├── docker-compose.yml          # Semua service + infra (postgres, redis, jaeger)
├── Makefile                    # Perintah operasional
├── docs/
│   └── be/
│       ├── business/process.md     # Dokumen proses bisnis
│       └── technical/architecture.md  # Dokumen teknis
└── src/
    └── be/
        ├── Dockerfile              # Multi-stage build (shared untuk semua service)
        ├── go.work                 # Go workspace (menggabungkan semua module)
        ├── shared/                 # Package bersama
        │   ├── pkg/
        │   │   ├── auth/           # PASETO token manager
        │   │   ├── cache/          # Redis client
        │   │   ├── db/             # PostgreSQL connector
        │   │   ├── middleware/     # TraceID, Idempotency middleware
        │   │   ├── outbox/         # Relay + Consumer (Transactional Outbox)
        │   │   ├── response/       # DTO standar API response
        │   │   └── telemetry/      # OpenTelemetry setup
        │   └── proto/              # gRPC proto + generated Go code
        │       ├── auth/v1/
        │       ├── billing/v1/
        │       ├── emr/v1/
        │       ├── patient/v1/
        │       ├── pharmacy/v1/
        │       └── registration/v1/
        ├── api-gateway/            # Port: 8080
        ├── auth-service/           # Port: 50051
        ├── patient-service/        # Port: 50052
        ├── registration-service/   # Port: 50053
        ├── emr-service/            # Port: 50054
        ├── pharmacy-service/       # Port: 50055
        └── billing-service/        # Port: 50056
```

Setiap service mengikuti struktur Hexagonal:
```
{service}/
├── cmd/server/main.go
├── go.mod
├── sqlc.yaml
└── internal/
    ├── adapters/
    │   ├── db/            # SQLC generated code + migrations
    │   ├── grpc/          # gRPC server handler
    │   └── repository/    # Repository implementation
    └── core/
        ├── domain/        # Domain models/entities
        ├── ports/         # Interface definitions
        └── services/      # Business logic
```

---

## 4. Koneksi & Environment Variables

### Infrastruktur
| Service | Koneksi |
|---------|---------|
| PostgreSQL | `postgres://root:secretpassword@localhost:5432/simrs_db?sslmode=disable` |
| Redis | `localhost:6379` |
| Jaeger UI | `http://localhost:16686` |
| Jaeger OTLP | `localhost:4317` (gRPC), `localhost:4318` (HTTP) |

### Environment Variables per Service (docker-compose)
```yaml
# Common untuk semua service:
DATABASE_URL: postgres://root:secretpassword@postgres:5432/simrs_db?sslmode=disable
JAEGER_ENDPOINT: jaeger:4318
REDIS_HOST: redis:6379   # ⚠️ LIHAT GAP #9 — pharmacy & billing belum ada ini!

# API Gateway (port 8080):
AUTH_SERVICE_ADDR: auth-service:50051
PATIENT_SERVICE_ADDR: patient-service:50052
REGISTRATION_SERVICE_ADDR: registration-service:50053
EMR_SERVICE_ADDR: emr-service:50054
PHARMACY_SERVICE_ADDR: pharmacy-service:50055
BILLING_SERVICE_ADDR: billing-service:50056
```

---

## 5. Cara Menjalankan

```bash
# Jalankan semua service via Docker (selalu rebuild)
make be-run-all

# Hentikan semua service Docker
make be-stop-all

# Jalankan semua service secara lokal (untuk debugging)
make be-run-local-all

# Hentikan semua service lokal
make be-stop-local-all

# Jalankan migrasi database (pastikan infra sudah running)
make migrate-up

# Generate SQLC dari query.sql
make sqlc-generate
```

---

## 6. Alur Sistem (Happy Path)

```
1. POST /api/v1/auth/login               → Auth Service (dapat PASETO token)
2. POST /api/v1/registrations            → Registration Service (dapat encounter_no)
3. POST /api/v1/emr/triage               → EMR Service (perawat isi vital signs)
4. POST /api/v1/emr/diagnosis            → EMR Service (dokter isi diagnosa ICD-10)
5. POST /api/v1/emr/actions              → EMR Service (dokter isi tindakan + tarif)
                                            ↓ [Outbox Event: MedicalActionAdded → emr_stream]
                                            ↓ Billing Consumer otomatis tambah ActionItem ke invoice
6. POST /api/v1/pharmacy/prescriptions   → Pharmacy Service (dokter buat resep)
7. GET  /api/v1/billing/invoice/{enc}   → Billing Service (lihat tagihan)
8. POST /api/v1/billing/pay             → Billing Service (kasir terima pembayaran)
                                            ↓ [Outbox Event: InvoicePaid → billing_stream]
9. POST /api/v1/pharmacy/dispense        → Pharmacy Service (apotek keluarkan obat)
                                            ↓ [Outbox Event: PrescriptionDispensed → pharmacy_stream]
                                            ↓ Billing Consumer otomatis tambah MedicineItem ke invoice
```

---

## 7. Outbox Pattern — Arsitektur

```
[Service] → DB Transaction:
   BEGIN
   INSERT INTO {domain_table} ...
   INSERT INTO {schema}.outbox_events (id, aggregate_type, event_type, payload, status='PENDING')
   COMMIT

[Relay Worker] (background goroutine, interval 5s):
   SELECT * FROM outbox_events WHERE status='PENDING'
   → XADD {stream_name} payload
   → UPDATE outbox_events SET status='SENT'

[Consumer] (Redis Streams XREADGROUP):
   XREADGROUP GROUP {group} {consumer} STREAMS {stream} >
   → Process event
   → XACK {stream} {group} {id}
```

**Stream yang aktif:**
- `emr_stream` — diisi oleh EMR Relay, dibaca oleh Billing Consumer
- `pharmacy_stream` — diisi oleh Pharmacy Relay, dibaca oleh Billing Consumer
- `billing_stream` — diisi oleh Billing Relay (InvoicePaid), konsumernya belum ada

---

## 8. Gap yang Ditemukan (9 Gap)

### 🔴 CRITICAL — Harus diperbaiki segera

---

#### GAP 1: Billing gRPC Server Tidak Mengimplementasikan Method yang Benar

**File:** `src/be/billing-service/internal/adapters/grpc/server.go`

**Masalah:**
- Proto (`billing.proto`) mendefinisikan: `GenerateInvoice` dan `PayInvoice`
- Server.go hanya mengimplementasikan: `CreateInvoice` (method yang **sudah tidak ada di proto**)
- `GenerateInvoice` dan `PayInvoice` **tidak ada di server.go** → fallback ke `UnimplementedBillingServiceServer` → selalu return error

**Kondisi file saat ini:**
```go
// billing-service/internal/adapters/grpc/server.go — BERMASALAH
func (s *BillingGrpcServer) CreateInvoice(ctx context.Context, req *pb.CreateInvoiceRequest) (*pb.CreateInvoiceResponse, error) {
    // method ini tidak ada di proto!
}
// GenerateInvoice dan PayInvoice tidak diimplementasikan!
```

**Yang harus dilakukan:**
Ganti seluruh isi `server.go` dengan implementasi yang benar:
```go
func (s *BillingGrpcServer) GenerateInvoice(ctx context.Context, req *pb.GenerateInvoiceRequest) (*pb.GenerateInvoiceResponse, error) {
    inv, err := s.billingService.GenerateInvoice(ctx, req.EncounterNo)
    if err != nil {
        return &pb.GenerateInvoiceResponse{Success: false, Message: err.Error()}, nil
    }
    // map items dan return response
}

func (s *BillingGrpcServer) PayInvoice(ctx context.Context, req *pb.PayInvoiceRequest) (*pb.PayInvoiceResponse, error) {
    err := s.billingService.PayInvoice(ctx, req.InvoiceId, req.AmountPaid)
    if err != nil {
        return &pb.PayInvoiceResponse{Success: false, Message: err.Error()}, nil
    }
    return &pb.PayInvoiceResponse{Success: true, Message: "Invoice paid successfully"}, nil
}
```

Perlu juga menambahkan query `GetInvoiceItems` di `billing-service/internal/adapters/db/query.sql` dan regenerasi SQLC.

---

#### GAP 2: `REDIS_HOST` Tidak Ada di docker-compose untuk pharmacy-service dan billing-service

**File:** `docker-compose.yml`

**Masalah:**
Pharmacy Service dan Billing Service menjalankan Outbox Relay yang membutuhkan koneksi Redis, tapi `REDIS_HOST` tidak ada di environment variables mereka.

**Kondisi saat ini (bermasalah):**
```yaml
pharmacy-service:
  environment:
    - DATABASE_URL=...
    - JAEGER_ENDPOINT=jaeger:4318
    - PORT=50055
    # REDIS_HOST tidak ada!

billing-service:
  environment:
    - DATABASE_URL=...
    - JAEGER_ENDPOINT=jaeger:4318
    - PORT=50056
    # REDIS_HOST tidak ada!
```

**Fix:**
```yaml
pharmacy-service:
  environment:
    - DATABASE_URL=postgres://root:secretpassword@postgres:5432/simrs_db?sslmode=disable
    - JAEGER_ENDPOINT=jaeger:4318
    - REDIS_HOST=redis:6379  # ← TAMBAHKAN INI
    - PORT=50055
  depends_on:
    - postgres
    - redis      # ← TAMBAHKAN INI
    - jaeger

billing-service:
  environment:
    - DATABASE_URL=postgres://root:secretpassword@postgres:5432/simrs_db?sslmode=disable
    - JAEGER_ENDPOINT=jaeger:4318
    - REDIS_HOST=redis:6379  # ← TAMBAHKAN INI
    - PORT=50056
  depends_on:
    - postgres
    - redis      # ← TAMBAHKAN INI
    - jaeger
```

---

### 🟠 HIGH — Keamanan & Integritas Bisnis

---

#### GAP 3: Idempotency Middleware Ada Tapi Tidak Dipasang

**File:** `src/be/shared/pkg/middleware/idempotency.go` (sudah ada, benar)
**File yang perlu diubah:** `src/be/api-gateway/cmd/server/main.go`

**Masalah:** `IdempotencyMiddleware` sudah terimplementasi dengan baik (Redis SETNX), tapi tidak pernah di-`Use()`.

**Fix — tambahkan di `main.go` API Gateway:**
```go
// Perlu inisialisasi Redis client terlebih dahulu di api-gateway
redisHost := os.Getenv("REDIS_HOST")
if redisHost == "" {
    redisHost = "localhost:6379"
}
redisClient := redis.NewClient(&redis.Options{Addr: redisHost})

// Pasang di route group protected (POST saja):
r.Group(func(r chi.Router) {
    r.Use(middleware.AuthMiddleware(tokenManager))
    r.Use(simrsmiddleware.IdempotencyMiddleware(redisClient, 5*time.Minute))
    // ... semua route POST yang ada
})
```

Tambahkan juga `REDIS_HOST` ke env vars api-gateway di `docker-compose.yml`.

---

#### GAP 4: RBAC Tidak Diimplementasikan

**Dokumen:** 5 role (Admin, Perawat, Dokter, Apoteker, Kasir)
**File yang perlu diubah:** 
- `src/be/auth-service/internal/adapters/db/migrations/` — pastikan kolom `role` ada di tabel `users`
- `src/be/shared/pkg/auth/paseto.go` — tambahkan `role` ke dalam claims token
- `src/be/api-gateway/internal/middleware/auth.go` — tambahkan fungsi `RequireRole(...string)`
- `src/be/api-gateway/cmd/server/main.go` — terapkan `RequireRole` per route

**Implementasi yang dibutuhkan:**

```go
// Di api-gateway/internal/middleware/auth.go
func RequireRole(tokenManager *auth.TokenManager, roles ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            claims := r.Context().Value(ClaimsKey) // di-set oleh AuthMiddleware
            userRole := claims["role"].(string)
            for _, role := range roles {
                if userRole == role {
                    next.ServeHTTP(w, r)
                    return
                }
            }
            http.Error(w, `{"success":false,"message":"Forbidden"}`, http.StatusForbidden)
        })
    }
}
```

**Pemetaan role per route:**
```
POST /registrations          → Admin, Resepsionis
POST /emr/triage             → Perawat
POST /emr/diagnosis          → Dokter
POST /emr/actions            → Dokter
POST /pharmacy/prescriptions → Dokter
GET  /billing/invoice/{enc}  → Kasir, Dokter
POST /billing/pay            → Kasir
POST /pharmacy/dispense      → Apoteker
```

---

#### GAP 5: Apotek Tidak Memvalidasi Status Pembayaran

**Dokumen:** "Obat dapat mulai diproses di Apotek **setelah pasien lunas**"
**File:** `src/be/pharmacy-service/internal/core/services/pharmacy_service.go`

**Masalah:** `DispensePrescription` tidak mengecek status invoice.

**Solusi A (Synchronous — Recommended):**
Tambahkan gRPC call ke Billing Service sebelum dispense:
```go
// Di pharmacy_service.go
func (s *pharmacyServiceImpl) DispensePrescription(ctx context.Context, prescriptionID string) error {
    // 1. Get prescription untuk dapat encounter_no
    presc, err := s.repo.GetPrescription(ctx, prescriptionID)
    if err != nil { return err }
    
    // 2. Cek status invoice ke Billing Service via gRPC
    inv, err := s.billingClient.GenerateInvoice(ctx, &billingpb.GenerateInvoiceRequest{
        EncounterNo: presc.EncounterNo,
    })
    if err != nil || inv.Status != "PAID" {
        return fmt.Errorf("cannot dispense: invoice is not paid yet")
    }
    
    // 3. Lanjutkan dispense
    return s.repo.DispensePrescription(ctx, prescriptionID)
}
```

---

### 🟡 MEDIUM — Kelengkapan Fitur

---

#### GAP 6: Patient Service Tidak Diekspos di API Gateway

**File:** `src/be/api-gateway/cmd/server/main.go`

**Masalah:** Client gRPC ke Patient Service belum diinisialisasi. Endpoint `/patient/*` ada di Swagger tapi tidak ada handler-nya.

**Fix — tambahkan di `main.go`:**
```go
// Connect to Patient gRPC
patientAddr := os.Getenv("PATIENT_SERVICE_ADDR")
if patientAddr == "" { patientAddr = "localhost:50052" }
patientConn, err := grpc.NewClient(patientAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
defer patientConn.Close()
patientClient := patientpb.NewPatientServiceClient(patientConn)

// Tambahkan routes:
r.Post("/patient/register", func(w http.ResponseWriter, req *http.Request) {
    var payload patientpb.RegisterPatientRequest
    // ... handler
})
r.Get("/patient/{mrn}", func(w http.ResponseWriter, req *http.Request) {
    mrn := chi.URLParam(req, "mrn")
    // ... handler
})
```

Import yang diperlukan: `patientpb "github.com/aliube/go-micro-simrs-one/shared/proto/patient/v1"`

---

#### GAP 7: Swagger Tidak Lengkap

**File:** `src/be/api-gateway/docs/swagger/swagger.yaml`

Endpoint berikut **sudah ada di API Gateway** tapi **belum ada di Swagger**:
- `GET /api/v1/health`
- `POST /api/v1/registrations`
- `POST /api/v1/emr/triage`
- `POST /api/v1/emr/diagnosis`
- `GET /api/v1/emr/record/{encounter_no}`
- `POST /api/v1/pharmacy/prescriptions`

---

### 🟢 LOW — Enhancement / Roadmap

---

#### GAP 8: Pagination Response Belum Ada

**File:** `src/be/shared/pkg/response/response.go`

Dokumen mendefinisikan response pagination dengan field `meta`. Perlu tambahkan:
```go
type PaginatedResponse struct {
    RequestID string      `json:"request_id"`
    TraceID   string      `json:"trace_id"`
    Success   bool        `json:"success"`
    Message   string      `json:"message"`
    Data      interface{} `json:"data"`
    Meta      PaginationMeta `json:"meta"`
}

type PaginationMeta struct {
    Page       int  `json:"page"`
    PageSize   int  `json:"page_size"`
    TotalData  int  `json:"total_data"`
    TotalPages int  `json:"total_pages"`
    PrevPage   bool `json:"prev_page"`
    NextPage   bool `json:"next_page"`
}
```

---

#### GAP 9: Queue Estimator (AI-Ready Feature) Belum Ada

**Dokumen:** Interface `QueueEstimator` dengan `StatisticalQueueEstimator` dan `MLQueueEstimator`.

Belum ada implementasi sama sekali. Ini adalah fitur unggulan yang menunjukkan desain software yang extensible. Perlu dibuat:
1. Interface di `shared/pkg/queue/estimator.go`
2. `StatisticalQueueEstimator` yang membaca summary table dari DB
3. Summary/aggregation table di Registration Service migration
4. Integrasi dengan Registration Service untuk memberikan estimasi nomor antrean

---

## 9. Rencana Aksi Berurutan (Recommended Order)

```
Fase 1 — Fix Critical Bugs (agar sistem berfungsi):
  [ ] GAP 1: Fix billing-service/grpc/server.go → implementasi GenerateInvoice + PayInvoice
  [ ] GAP 2: Tambahkan REDIS_HOST ke pharmacy & billing di docker-compose.yml

Fase 2 — Keamanan:
  [ ] GAP 3: Pasang IdempotencyMiddleware di API Gateway + tambah Redis client
  [ ] GAP 4: Implementasi RBAC claims + RequireRole middleware per route
  [ ] GAP 5: Validasi status PAID di pharmacy sebelum dispense

Fase 3 — Kelengkapan:
  [ ] GAP 6: Tambahkan Patient Service routes di API Gateway
  [ ] GAP 7: Lengkapi swagger.yaml dengan semua route

Fase 4 — Enhancement:
  [ ] GAP 8: Tambah PaginatedResponse struct + implementasi di endpoint list
  [ ] GAP 9: Implementasikan QueueEstimator interface + StatisticalQueueEstimator
```

---

## 10. Catatan Penting untuk Agen/Developer Selanjutnya

1. **Go Workspace** — Proyek menggunakan `go.work`. Jangan jalankan `go mod tidy` dari root. Masuk ke direktori service yang bersangkutan terlebih dahulu.

2. **SQLC** — Jika ada perubahan SQL (`query.sql`), jalankan `make sqlc-generate` dari root untuk regenerate kode Go.

3. **Proto** — Jika ada perubahan `.proto`, perlu menjalankan `protoc` secara manual atau via script untuk regenerate `*.pb.go` dan `*_grpc.pb.go`. Tool yang dibutuhkan: `protoc`, `protoc-gen-go`, `protoc-gen-go-grpc`.

4. **Docker Volume** — `swagger.yaml` di-mount sebagai volume (`./src/be/api-gateway/docs:/app/docs`), jadi perubahan Swagger langsung terlihat tanpa rebuild image.

5. **Makefile** — `make be-run-all` sudah dilengkapi `--build` flag sehingga selalu rebuild Docker image.

6. **Symmetric Key PASETO** — Key yang digunakan (hardcoded untuk development): `59454c4c4f57205355424d4152494e452c20424c41434b2057495a4152445259`. Wajib diubah ke environment variable sebelum production.

7. **Database Schema** — Setiap service memiliki schema PostgreSQL sendiri (auth, patient, registration, emr, pharmacy, billing). Tidak ada foreign key atau JOIN antar schema. Relasi menggunakan `mrn` (Medical Record Number) dan `encounter_no` sebagai business key.

8. **Outbox Table Name** — Setiap service punya tabel `outbox_events` di schema-nya masing-masing (bukan shared table).
