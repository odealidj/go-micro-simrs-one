# Dokumentasi Teknis: go-micro-simrs-one (SIMRS)

> Sistem Informasi Manajemen Rumah Sakit berbasis Microservices

---

## Daftar Isi

1. [Gambaran Umum Arsitektur](#1-gambaran-umum-arsitektur)
2. [Infrastruktur Global](#2-infrastruktur-global)
3. [Service Catalog](#3-service-catalog)
4. [Entity Relationship Diagram (ERD)](#4-entity-relationship-diagram-erd)
5. [API Endpoint Reference](#5-api-endpoint-reference)
6. [Event Flow (Outbox Pattern)](#6-event-flow-outbox-pattern)
7. [Shared Packages](#7-shared-packages)
8. [Deployment & Port Mapping](#8-deployment--port-mapping)

---

## 1. Gambaran Umum Arsitektur

Sistem SIMRS mengadopsi pola **Microservices** dengan komunikasi internal menggunakan **gRPC**, sementara klien eksternal (Frontend/Mobile) berinteraksi hanya melalui satu pintu yaitu **API Gateway** yang mengekspos **REST HTTP**.

```mermaid
graph TB
    subgraph CLIENT["Client Layer"]
        FE["Frontend / Mobile App"]
    end

    subgraph GATEWAY["API Gateway (HTTP :8080)"]
        GW["api-gateway\nREST · Rate Limiter · Auth JWT\nIdempotency · Circuit Breaker\nSSE · CORS"]
    end

    subgraph SERVICES["Backend Microservices (gRPC)"]
        AUTH["auth-service\n:50051"]
        PATIENT["patient-service\n:50052"]
        REG["registration-service\n:50053"]
        EMR["emr-service\n:50054"]
        PHARMA["pharmacy-service\n:50055"]
        BILLING["billing-service\n:50056"]
    end

    subgraph INFRA["Infrastructure"]
        PG[("PostgreSQL 15\nsimrs_db\n:5432")]
        RDB[("Redis 7\n:6379")]
        JAEGER["Jaeger Tracing\n:16686 UI\n:4318 OTLP"]
    end

    FE -->|HTTP/REST| GATEWAY
    GW -->|gRPC| AUTH
    GW -->|gRPC| PATIENT
    GW -->|gRPC| REG
    GW -->|gRPC| EMR
    GW -->|gRPC| PHARMA
    GW -->|gRPC| BILLING

    AUTH --- PG
    PATIENT --- PG
    PATIENT --- RDB
    REG --- PG
    REG --- RDB
    EMR --- PG
    EMR --- RDB
    PHARMA --- PG
    PHARMA --- RDB
    BILLING --- PG
    BILLING --- RDB

    GW --- RDB
    GW --- JAEGER
    AUTH --- JAEGER
    PATIENT --- JAEGER
    REG --- JAEGER
    EMR --- JAEGER
    PHARMA --- JAEGER
    BILLING --- JAEGER
```

### Prinsip Arsitektur

| Prinsip | Implementasi |
|---|---|
| **Database per Service** | Setiap service memiliki skema tabel sendiri pada database `simrs_db` |
| **Loose Coupling** | Komunikasi antar service via event (Outbox + Redis Streams) |
| **Single Entry Point** | Semua traffic eksternal hanya melalui API Gateway |
| **Resilience** | Circuit Breaker (Sony gobreaker) pada setiap panggilan gRPC di Gateway |
| **Idempotency** | Middleware `X-Request-ID` + Redis cache (TTL 24 jam) |
| **Observability** | Structured logging (`log/slog`) + Jaeger Distributed Tracing |
| **Security** | JWT/Paseto token + RBAC per endpoint |

---

## 2. Infrastruktur Global

### Komponen Infrastruktur

```mermaid
graph LR
    subgraph "Docker Compose Network"
        PG["🐘 PostgreSQL 15-alpine\nHost: postgres\nPort: 5432\nDB: simrs_db\nUser: root"]
        REDIS["🔴 Redis 7-alpine\nHost: redis\nPort: 6379"]
        JAEGER["🔍 Jaeger all-in-one\nHost: jaeger\nUI: :16686\nOTLP HTTP: :4318\nOTLP gRPC: :4317"]
    end
```

### Peran Redis

Redis digunakan untuk **tiga fungsi berbeda**:

```mermaid
graph TD
    REDIS[("Redis :6379")]

    REDIS -->|"Pub/Sub Channel\nqueue:clinic:stream\nqueue:pharmacy:stream"| SSE["SSE Handler\n(Real-time Queue Updates)"]
    REDIS -->|"X-Request-ID key\nTTL: 24 jam"| IDEM["Idempotency Middleware\n(Duplicate Request Prevention)"]
    REDIS -->|"Redis Streams\nXADD / XREADGROUP"| OUTBOX["Outbox Relay\n(Async Event Delivery)"]
```

### Alur Request End-to-End

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as API Gateway
    participant RDB as Redis
    participant SVC as Backend Service
    participant DB as PostgreSQL
    participant JG as Jaeger

    C->>GW: POST /api/v1/... + X-Request-ID
    GW->>GW: TraceID Middleware (inject X-Trace-ID)
    GW->>GW: Rate Limiter (60 req/s per IP)
    GW->>GW: Auth Middleware (validate JWT/Paseto)
    GW->>RDB: Check idempotency key
    alt Cache Hit
        RDB-->>GW: Cached response
        GW-->>C: 200 OK (cached)
    else Cache Miss
        GW->>GW: RBAC Middleware (RequireRole)
        GW->>GW: Circuit Breaker check
        GW->>SVC: gRPC call
        SVC->>DB: Query / Transaction
        DB-->>SVC: Result
        SVC-->>GW: gRPC response
        GW->>RDB: Store idempotency cache
        GW->>JG: Export trace span
        GW-->>C: JSON response
    end
```

---

## 3. Service Catalog

### 3.1 API Gateway

```
Module   : api-gateway
Protocol : HTTP/1.1 + SSE
Port     : 8080 (Docker: 60080)
```

**Middleware Stack (urutan eksekusi):**

```mermaid
flowchart LR
    REQ["Incoming\nRequest"] --> M1
    M1["RequestID\n(chi)"] --> M2
    M2["RealIP\n(chi)"] --> M3
    M3["Logger\n(chi)"] --> M4
    M4["Recoverer\n(chi)"] --> M5
    M5["Timeout\n60s (chi)"] --> M6
    M6["CORS\nHandler"] --> M7
    M7["TraceID\nMiddleware"] --> M8
    M8["Rate Limiter\n60 req/s burst:120"] --> M9
    M9["Auth JWT\n(protected routes)"] --> M10
    M10["Idempotency\nX-Request-ID 24h"] --> M11
    M11["RBAC\nRequireRole"] --> SVC["Service\nHandler"]
```

**Dependencies yang digunakan:**
- `github.com/go-chi/chi/v5` — HTTP Router
- `github.com/go-chi/cors` — CORS Handler
- `github.com/redis/go-redis/v9` — Redis Client (SSE, Idempotency)
- `github.com/sony/gobreaker` — Circuit Breaker
- `google.golang.org/grpc` — gRPC Client ke semua service

---

### 3.2 Auth Service

```
Module   : auth-service
Protocol : gRPC
Port     : 50051 (Docker: 60051)
Database : simrs_db (table: users)
```

**gRPC Methods:**

| Method | Request | Response | Keterangan |
|---|---|---|---|
| `Login` | `username`, `password` | `access_token`, `role` | Validasi kredensial + generate Paseto token |

**Flow Login:**

```mermaid
sequenceDiagram
    participant GW as API Gateway
    participant AS as Auth Service
    participant DB as PostgreSQL

    GW->>AS: Login(username, password)
    AS->>DB: SELECT * FROM users WHERE username = ?
    DB-->>AS: user row
    AS->>AS: bcrypt.Compare(password, hash)
    AS->>AS: paseto.CreateToken(userID, role, 24h)
    AS-->>GW: {access_token, role}
```

---

### 3.3 Patient Service

```
Module   : patient-service
Protocol : gRPC
Port     : 50052 (Docker: 60052)
Database : simrs_db (table: patients)
Peran    : Data Master Pasien
```

> Menyimpan **identitas pasien** (NIK, nama, tanggal lahir) dan menerbitkan **Nomor Rekam Medis (MRN)** yang unik. Berbeda dengan EMR Service, Patient Service hanya mengelola data demografis dan identitas — bukan data klinis.

**gRPC Methods:**

| Method | Request | Response | Keterangan |
|---|---|---|---|
| `RegisterPatient` | `name`, `nik`, `dob` | `mrn`, `success` | Generate MRN unik, simpan ke DB |
| `GetPatientByMRN` | `mrn` | Patient data | Lookup pasien berdasarkan MRN |

---

### 3.4 Registration Service

```
Module   : registration-service
Protocol : gRPC
Port     : 50053 (Docker: 60053)
Database : simrs_db (tables: encounters, outbox_events)
```

**gRPC Methods:**

| Method | Request | Response | Keterangan |
|---|---|---|---|
| `RegisterEncounter` | `mrn`, `department`, `doctor_id` | `encounter_no`, `success` | Daftarkan kunjungan + emit event |

**Outbox Events yang diterbitkan:**

| Event Type | Payload |
|---|---|
| `EncounterRegistered` | `encounter_no`, `mrn` |

---

### 3.5 EMR Service

```
Module   : emr-service
Protocol : gRPC
Port     : 50054 (Docker: 60054)
Database : simrs_db (tables: medical_records, medical_actions,
           clinic_wait_time_aggregates, outbox_events)
Peran    : Modul Poliklinik
Workers  : aggregator_cron.go (update wait time aggregates)
```

> Berfungsi sebagai **modul Poliklinik** — area kerja dokter dan perawat di dalam poli. Mencakup pencatatan pemeriksaan awal (triage/vital signs), input diagnosa ICD-10, pencatatan tindakan medis beserta tarif, dan kalkulasi estimasi waktu tunggu antrean poli berdasarkan data historis multidimensi.

**gRPC Methods:**

| Method | Request | Response | Keterangan |
|---|---|---|---|
| `SubmitTriage` | `encounter_no`, `mrn`, vital signs | `success` | Buat draft rekam medis + data triage |
| `StartEncounter` | `encounter_no` | `success` | Ubah status MR dari DRAFT → ACTIVE |
| `AddDiagnosis` | `encounter_no`, `icd10_code`, `doctor_id`, `dept_code`, `gender`, `age_bracket` | `success` | Simpan diagnosa + update agregat antrean |
| `AddMedicalAction` | `encounter_no`, `action_code`, `action_name`, `price`, `notes` | `success` | Tambahkan tindakan medis + emit event |
| `GetMedicalRecord` | `encounter_no` | Full MR data | Ambil rekam medis lengkap |
| `GetEstimatedWaitTime` | `doctor_id`, `dept_code`, `gender`, `age_bracket` | `estimated_minutes` | Estimasi waktu tunggu poliklinik |

**Outbox Events yang diterbitkan:**

| Event Type | Payload |
|---|---|
| `MedicalActionAdded` | `encounter_no`, `action_code`, `action_name`, `price` |

---

### 3.6 Pharmacy Service

```
Module   : pharmacy-service
Protocol : gRPC
Port     : 50055 (Docker: 60055)
Database : simrs_db (tables: inventory, prescriptions, prescription_items,
           encounter_payments, pharmacy_wait_time_aggregates, outbox_events)
Consumer : billing_consumer.go (listen InvoicePaid dari Billing)
Workers  : aggregator_cron.go (update wait time aggregates)
```

**gRPC Methods:**

| Method | Request | Response | Keterangan |
|---|---|---|---|
| `CreatePrescription` | `encounter_no`, `items[]`, `is_compounded`, demographic data | `prescription_id`, `success` | Buat resep + validasi stok |
| `DispensePrescription` | `prescription_id` | `success` | Keluarkan obat (hanya jika PAID) + deduct stok |
| `RollbackPrescription` | `prescription_id` | `success` | Batalkan resep (Saga compensation) |
| `GetEstimatedWaitTime` | `doctor_id`, `dept_code`, `gender`, `age_bracket`, `is_compounded` | `estimated_minutes` | Estimasi waktu tunggu farmasi |

**Outbox Events yang diterbitkan:**

| Event Type | Payload |
|---|---|
| `PrescriptionDispensed` | `encounter_no`, `prescription_id`, `price` |

**Events yang dikonsumsi:**

| Event Source | Event Type | Aksi |
|---|---|---|
| Billing Service | `InvoicePaid` | Update status payment `encounter_payments` → PAID |

---

### 3.7 Billing Service

```
Module   : billing-service
Protocol : gRPC
Port     : 50056 (Docker: 60056)
Database : simrs_db (tables: invoices, invoice_items, outbox_events)
Consumer : (listen MedicalActionAdded + PrescriptionDispensed)
```

**gRPC Methods:**

| Method | Request | Response | Keterangan |
|---|---|---|---|
| `GenerateInvoice` | `encounter_no` | `invoice_id`, `total_amount` | Buat invoice dari semua tindakan + resep |
| `PayInvoice` | `invoice_id` | `success` | Proses pembayaran + emit event |

**Outbox Events yang diterbitkan:**

| Event Type | Payload |
|---|---|
| `InvoicePaid` | `encounter_no`, `invoice_id`, `paid_at` |

---

## 4. Entity Relationship Diagram (ERD)

> Semua service berbagi satu database `simrs_db` namun mengakses tabel yang berbeda-beda (Database-per-Service pattern secara logical).

### 4.1 Auth Service DB

```mermaid
erDiagram
    users {
        UUID id PK "gen_random_uuid()"
        VARCHAR_255 username UK "NOT NULL"
        VARCHAR_255 password_hash "bcrypt hash"
        VARCHAR_50 role "admin|doctor|nurse|pharmacist|cashier"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
```

---

### 4.2 Patient Service DB

```mermaid
erDiagram
    patients {
        VARCHAR_255 mrn PK "e.g. MRN-1234"
        VARCHAR_255 name "NOT NULL"
        VARCHAR_50 nik "NIK KTP"
        VARCHAR_50 dob "Date of Birth"
        TIMESTAMP created_at
    }
```

---

### 4.3 Registration Service DB

```mermaid
erDiagram
    encounters {
        VARCHAR_255 encounter_no PK "e.g. ENC-1234"
        VARCHAR_255 mrn "FK to patients.mrn (logical)"
        VARCHAR_100 department "e.g. POLI-UMUM"
        VARCHAR_100 doctor_id "e.g. DR-001"
        VARCHAR_50 status "REGISTERED|ACTIVE|COMPLETED"
        TIMESTAMP created_at
    }

    outbox_events_reg {
        VARCHAR_255 id PK
        VARCHAR_100 aggregate_type "e.g. Encounter"
        VARCHAR_100 event_type "e.g. EncounterRegistered"
        JSONB payload
        VARCHAR_50 status "PENDING|PUBLISHED|FAILED"
        TIMESTAMP created_at
    }

    encounters ||--o{ outbox_events_reg : "generates"
```

---

### 4.4 EMR Service DB

```mermaid
erDiagram
    medical_records {
        string id PK
        string encounter_no UK "FK to encounters"
        string mrn "FK to patients"
        string icd10_codes "TEXT[] e.g. A09,J06"
        string notes
        string status "DRAFT|ACTIVE|COMPLETED"
        int blood_pressure_systolic
        int blood_pressure_diastolic
        float temperature "NUMERIC 5,2 Celsius"
        int heart_rate "BPM"
        string doctor_id "dokter penanggung jawab"
        string department_code "kode poli"
        string kbm_code "kode KBM"
        string kbm_name "nama KBM"
        string icd10_mapping_status "PENDING|VERIFIED"
        string gender "M atau F"
        string age_bracket "0-5,6-17,18-60,60+"
        timestamp started_at
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }

    kbm_catalog {
        string kbm_code PK
        string kbm_name
        string description
        string body_system
        timestamp created_at
    }

    kbm_icd10_mappings {
        string kbm_code PK, FK
        string icd10_code PK
        boolean is_primary
        timestamp created_at
    }

    medical_actions {
        string id PK
        string medical_record_id FK
        string action_code "e.g. ACT-001"
        string action_name
        decimal price "NUMERIC 15,2"
        string notes
        timestamp created_at
    }

    clinic_wait_time_aggregates {
        int id PK "SERIAL AUTO"
        string diagnosis "NOT NULL"
        string doctor_id "NOT NULL"
        string department_code "NOT NULL"
        string gender "NOT NULL"
        string age_bracket "NOT NULL"
        int average_wait_minutes
        int sample_count
        timestamp updated_at
    }

    outbox_events_emr {
        string id PK
        string aggregate_type
        string event_type "MedicalActionAdded"
        string payload "JSONB"
        string status "PENDING|PUBLISHED|FAILED"
        timestamp created_at
    }

    medical_records ||--o{ medical_actions : "has"
    medical_records ||--o{ outbox_events_emr : "generates"
    kbm_catalog ||--o{ kbm_icd10_mappings : "has"
```

---

### 4.5 Pharmacy Service DB

```mermaid
erDiagram
    inventory {
        string item_code PK "e.g. MED-001"
        string name
        int stock_quantity "CHECK >= 0"
        decimal price "DECIMAL 10,2"
    }

    prescriptions {
        string id PK "e.g. RX-123"
        string encounter_no "FK to encounters"
        string status "CREATED|DISPENSED|CANCELLED|ROLLBACKED"
        boolean is_compounded "apakah resep racikan"
        string notes
        string kbm_code "KBM dari dokter"
        string kbm_name "Nama KBM"
        string gender "M atau F"
        string age_bracket
        string doctor_id
        string department_code
        timestamp created_at
        timestamp updated_at
    }

    prescription_items {
        string id PK
        string prescription_id FK
        string item_code FK
        int quantity
        decimal price "harga saat resep dibuat"
    }

    encounter_payments {
        string encounter_no PK
        string status "PAID|UNPAID"
        timestamp paid_at
        timestamp updated_at
    }

    pharmacy_wait_time_aggregates {
        int id PK "SERIAL AUTO"
        string diagnosis "NOT NULL"
        string doctor_id "NOT NULL"
        string department_code "NOT NULL"
        string gender "NOT NULL"
        string age_bracket "NOT NULL"
        boolean is_compounded "NOT NULL"
        int average_wait_minutes
        int sample_count
        timestamp updated_at
    }

    outbox_events_pharma {
        string id PK
        string aggregate_type
        string event_type "PrescriptionDispensed"
        string payload "JSONB"
        string status "PENDING|PUBLISHED|FAILED"
        timestamp created_at
    }

    prescriptions ||--o{ prescription_items : "contains"
    inventory ||--o{ prescription_items : "referenced by"
    prescriptions ||--o{ outbox_events_pharma : "generates"
```

---

### 4.6 Billing Service DB

```mermaid
erDiagram
    invoices {
        VARCHAR_255 id PK "e.g. INV-123"
        VARCHAR_255 encounter_no "FK to encounters"
        DECIMAL_10_2 total_amount
        VARCHAR_50 status "UNPAID|PAID"
        TIMESTAMP paid_at
        TIMESTAMP created_at
    }

    invoice_items {
        VARCHAR_255 id PK
        VARCHAR_255 invoice_id FK
        VARCHAR_50 item_type "ACTION|PRESCRIPTION"
        TEXT description
        DECIMAL_10_2 amount
        TIMESTAMP created_at
    }

    outbox_events_billing {
        VARCHAR_255 id PK
        VARCHAR_100 aggregate_type
        VARCHAR_100 event_type "InvoicePaid"
        JSONB payload
        VARCHAR_50 status
        TIMESTAMP created_at
    }

    invoices ||--o{ invoice_items : "contains"
    invoices ||--o{ outbox_events_billing : "generates"
```

---

### 4.7 Relasi Antar Service (Logical ERD)

```mermaid
erDiagram
    patients {
        VARCHAR mrn PK
        VARCHAR name
        VARCHAR nik
        VARCHAR dob
    }

    encounters {
        VARCHAR encounter_no PK
        VARCHAR mrn FK
        VARCHAR department
        VARCHAR doctor_id
        VARCHAR status
    }

    medical_records {
        VARCHAR id PK
        VARCHAR encounter_no FK
        VARCHAR kbm_code
        VARCHAR doctor_id
        VARCHAR gender
        VARCHAR age_bracket
        VARCHAR status
    }

    prescriptions {
        VARCHAR id PK
        VARCHAR encounter_no FK
        VARCHAR status
        VARCHAR kbm_code
        VARCHAR doctor_id
    }

    invoices {
        VARCHAR id PK
        VARCHAR encounter_no FK
        DECIMAL total_amount
        VARCHAR status
    }

    encounter_payments {
        VARCHAR encounter_no PK
        VARCHAR status "synced from billing"
    }

    patients ||--o{ encounters : "has visits"
    encounters ||--o| medical_records : "has record"
    encounters ||--o{ prescriptions : "has prescriptions"
    encounters ||--o{ invoices : "billed via"
    invoices ||--o| encounter_payments : "synced to"
```

---

## 5. API Endpoint Reference

**Base URL:** `http://localhost:60080/api/v1`

### Legend
- 🔓 = Publik (tidak perlu autentikasi)
- 🔐 = Butuh JWT Bearer Token
- 👤 = RBAC: Role yang diizinkan
- ⚡ = SSE (Server-Sent Events)

### 5.1 System & Queue

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| `GET` | `/health` | 🔓 | - | Health check API Gateway |
| `GET` | `/queue/clinic/stream` | 🔓 ⚡ | - | SSE stream antrean poliklinik real-time |
| `GET` | `/queue/pharmacy/stream` | 🔓 ⚡ | - | SSE stream antrean farmasi real-time |
| `GET` | `/queue/clinic/estimate` | 🔓 | - | Estimasi waktu tunggu poli |
| `GET` | `/queue/pharmacy/estimate` | 🔓 | - | Estimasi waktu tunggu farmasi |

**Query params untuk `/queue/clinic/estimate`:**
```
doctor_id, department_code, gender, age_bracket
```

**Query params untuk `/queue/pharmacy/estimate`:**
```
doctor_id, department_code, gender, age_bracket, is_compounded
```

---

### 5.2 Authentication

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| `POST` | `/auth/login` | 🔓 | - | Login, dapatkan JWT token |

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required, min 6 chars)"
}
```

---

### 5.3 Patient Management

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| `POST` | `/patient/register` | 🔐 | 👤 admin, nurse | Daftar pasien baru |
| `GET` | `/patient/{mrn}` | 🔐 | 👤 admin, nurse | Lookup pasien by MRN |

---

### 5.4 Registration (Pendaftaran Kunjungan)

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| `POST` | `/registrations` | 🔐 | 👤 admin, nurse | Daftar kunjungan pasien |

---

### 5.5 EMR (Rekam Medis)

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| `POST` | `/emr/triage` | 🔐 | 👤 doctor, nurse | Input data triage (vital signs) |
| `POST` | `/emr/start` | 🔐 | 👤 doctor, nurse | Mulai encounter (DRAFT → ACTIVE) |
| `POST` | `/emr/diagnosis-kbm` | 🔐 | 👤 doctor, nurse | Tambah diagnosa KBM |
| `GET` | `/emr/kbm/search` | 🔐 | 👤 doctor, nurse, medical_records, admin | Pencarian KBM |
| `GET` | `/emr/kbm/{code}` | 🔐 | 👤 doctor, nurse, medical_records, admin | Detail KBM |
| `GET` | `/emr/kbm/{code}/icd10-suggestions` | 🔐 | 👤 medical_records, admin | Rekomendasi ICD-10 dari KBM |
| `GET` | `/emr/pending-icd10` | 🔐 | 👤 medical_records, admin | Daftar RM yang menunggu verifikasi ICD-10 |
| `POST` | `/emr/verify-icd10` | 🔐 | 👤 medical_records, admin | Verifikasi & simpan mapping ICD-10 |
| `POST` | `/emr/actions` | 🔐 | 👤 doctor, nurse | Tambah tindakan medis |
| `GET` | `/emr/record/{encounter_no}` | 🔐 | 👤 doctor, nurse | Ambil rekam medis lengkap |

---

### 5.6 Pharmacy (Farmasi)

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| `POST` | `/pharmacy/prescriptions` | 🔐 | 👤 pharmacist, admin | Buat resep obat |
| `POST` | `/pharmacy/dispense` | 🔐 | 👤 pharmacist, admin | Keluarkan obat (setelah lunas) |

---

### 5.7 Billing (Kasir)

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| `GET` | `/billing/invoice/{encounter_no}` | 🔐 | 👤 cashier, admin | Generate / lihat invoice |
| `POST` | `/billing/pay` | 🔐 | 👤 cashier, admin | Bayar invoice |

---

## 6. Event Flow (Outbox Pattern)

### Arsitektur Outbox

```mermaid
graph LR
    subgraph "Producer Service"
        SVC["Service Logic"]
        DB_SVC[("Service DB\n(outbox_events)")]
        RELAY["Outbox Relay\n(polling 5s)"]
    end

    subgraph "Message Broker"
        REDIS[("Redis Streams\nXADD")]
    end

    subgraph "Consumer Service"
        CONSUMER["Event Consumer\n(XREADGROUP)"]
        SVC2["Consumer Logic"]
        DB_SVC2[("Consumer DB")]
    end

    SVC -->|"Atomic Transaction"| DB_SVC
    RELAY -->|"Poll PENDING"| DB_SVC
    RELAY -->|"XADD"| REDIS
    RELAY -->|"Mark PUBLISHED"| DB_SVC
    CONSUMER -->|"XREADGROUP"| REDIS
    CONSUMER --> SVC2
    SVC2 --> DB_SVC2
```

### Alur Event Lengkap

```mermaid
sequenceDiagram
    participant RS as Registration Service
    participant RDB as Redis Streams
    participant EMR as EMR Service
    participant PHARMA as Pharmacy Service
    participant BILLING as Billing Service

    Note over RS: Pasien didaftarkan
    RS->>RDB: XADD EncounterRegistered {encounter_no, mrn}
    RDB-->>EMR: Consumer group picks up event
    EMR->>EMR: CreateDraftMR(encounter_no, mrn)

    Note over EMR: Dokter menambah tindakan medis
    EMR->>RDB: XADD MedicalActionAdded {encounter_no, action, price}
    RDB-->>BILLING: Consumer picks up event
    BILLING->>BILLING: Create/update invoice item

    Note over PHARMA: Apoteker keluarkan obat
    PHARMA->>RDB: XADD PrescriptionDispensed {encounter_no, rx_id, price}
    RDB-->>BILLING: Consumer picks up event
    BILLING->>BILLING: Create/update invoice item

    Note over BILLING: Kasir proses pembayaran
    BILLING->>RDB: XADD InvoicePaid {encounter_no, invoice_id}
    RDB-->>PHARMA: Consumer picks up event
    PHARMA->>PHARMA: UpsertEncounterPayment status=PAID

    Note over PHARMA: Setelah PAID → obat bisa dikeluarkan
```

### Peta Event

| Source Service | Event Type | Target Service | Aksi di Target |
|---|---|---|---|
| `registration-service` | `EncounterRegistered` | `emr-service` | `CreateDraftMR` |
| `emr-service` | `MedicalActionAdded` | `billing-service` | Tambah invoice item ACTION |
| `pharmacy-service` | `PrescriptionDispensed` | `billing-service` | Tambah invoice item PRESCRIPTION |
| `billing-service` | `InvoicePaid` | `pharmacy-service` | Set `encounter_payments.status = PAID` |

---

## 7. Shared Packages

Semua shared code berada di module `shared` dan diakses oleh semua service via Go Workspaces.

```mermaid
graph TB
    subgraph SHARED["shared/pkg/"]
        AUTH["auth/\npaseto.go\nTokenManager\n(CreateToken, VerifyToken)"]
        CB["circuitbreaker/\nbreaker.go\nNewGRPCBreaker()\nOpen: 5 consecutive fails\nTimeout: 30s\nHalf-open: 2 requests"]
        MW["middleware/\ntelemetry.go — TraceID inject\nidempotency.go — X-Request-ID Redis\nratelimiter.go — 60 req/s token bucket"]
        OB["outbox/\nrelay.go — Poll DB → Redis XADD\nconsumer.go — Redis XREADGROUP\nmodels.go — Event struct"]
        Q["queue/\nestimator.go — QueueEstimator interface\nstatistical_estimator.go — avg × position\nai_estimator.go — placeholder AI estimator"]
        RES["response/\nresponse.go\nSuccessResponse{}\nErrorResponse{}\nJSON() helper"]
        SD["shutdown/\nshutdown.go\nWaitForSignal() — SIGINT/SIGTERM\nGracefulTimeout: 10s"]
        VAL["validator/\nvalidator.go\nNotEmpty(), MinLength()\nValidateAll() — multi-field validation"]
    end
```

### Detail Shared Packages

| Package | File | Fungsi Utama |
|---|---|---|
| `auth` | `paseto.go` | `TokenManager` — Buat & verifikasi Paseto token simetris (HS256). TTL default 24h. |
| `circuitbreaker` | `breaker.go` | `NewGRPCBreaker(name)` — Buka circuit setelah 5 consecutive failures atau 60% failure rate (min 10 req). Timeout 30s. |
| `middleware` | `telemetry.go` | `TraceIDMiddleware` — Inject `X-Trace-ID` ke setiap request, propagasi ke downstream via context. |
| `middleware` | `idempotency.go` | `IdempotencyMiddleware` — Cache response di Redis dengan key `X-Request-ID` selama 24h. Wajib untuk semua POST. |
| `middleware` | `ratelimiter.go` | `NewRateLimiter(rate, burst)` — Token bucket per IP. Default: 60 req/s, burst 120. |
| `outbox` | `relay.go` | `Relay.Start()` — Polling DB `outbox_events` setiap interval, XADD ke Redis Stream, mark PUBLISHED. |
| `outbox` | `consumer.go` | `Consumer` — XREADGROUP dari Redis Stream, proses event, ACK setelah berhasil. |
| `queue` | `statistical_estimator.go` | `EstimateWaitTime(clinicID, position)` — `position × avgConsultTime`. |
| `response` | `response.go` | `JSON(w, status, data)` — Standard envelope response dengan `RequestID`, `TraceID`, `Success`, `Data`. |
| `shutdown` | `shutdown.go` | `WaitForSignal()` — Listen `SIGINT`/`SIGTERM`, return context yang di-cancel. Timeout graceful 10s. |
| `validator` | `validator.go` | `ValidateAll(map[field]func() error)` — Validasi multi-field sekaligus, return first error. |

---

## 8. Deployment & Port Mapping

### Port Reference

| Service | Internal Port | External Port (Docker) | Protocol |
|---|---|---|---|
| `auth-service` | 50051 | **60051** | gRPC |
| `patient-service` | 50052 | **60052** | gRPC |
| `registration-service` | 50053 | **60053** | gRPC |
| `emr-service` | 50054 | **60054** | gRPC |
| `pharmacy-service` | 50055 | **60055** | gRPC |
| `billing-service` | 50056 | **60056** | gRPC |
| `api-gateway` | 8080 | **60080** | HTTP/REST + SSE |
| `PostgreSQL` | 5432 | **5432** | TCP |
| `Redis` | 6379 | **6379** | TCP |
| `Jaeger UI` | 16686 | **16686** | HTTP |
| `Jaeger OTLP gRPC` | 4317 | **4317** | gRPC |
| `Jaeger OTLP HTTP` | 4318 | **4318** | HTTP |

### Dependency Graph (Docker Compose)

```mermaid
graph TD
    PG["postgres"] 
    RDB["redis"]
    JG["jaeger"]

    AUTH["auth-service"] --> PG
    AUTH --> JG

    PATIENT["patient-service"] --> PG
    PATIENT --> RDB
    PATIENT --> JG

    REG["registration-service"] --> PG
    REG --> RDB
    REG --> JG

    EMR["emr-service"] --> PG
    EMR --> RDB
    EMR --> JG

    PHARMA["pharmacy-service"] --> PG
    PHARMA --> RDB
    PHARMA --> JG

    BILLING["billing-service"] --> PG
    BILLING --> RDB
    BILLING --> JG

    GW["api-gateway"] --> AUTH
    GW --> PATIENT
    GW --> REG
    GW --> EMR
    GW --> PHARMA
    GW --> BILLING
    GW --> RDB
    GW --> JG
```

### Cara Menjalankan

```bash
# Jalankan semua service + infrastruktur
docker-compose up --build

# Akses API Gateway
curl http://localhost:60080/api/v1/health

# Akses Jaeger Tracing UI
open http://localhost:16686

# Login
curl -X POST http://localhost:60080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret123"}'
```

### Alur Bisnis Lengkap (Happy Path)

```mermaid
flowchart TD
    A["👤 Admin/Nurse\nDaftar Pasien\nPOST /patient/register"] -->|"MRN"| B

    B["👤 Admin/Nurse\nDaftar Kunjungan\nPOST /registrations"] -->|"encounter_no"| C

    C["🔔 Event: EncounterRegistered\n(Redis Stream)"] -->|"Auto"| D

    D["EMR Service\nBuat Draft Rekam Medis\n(background event consumer)"] --> E

    E["👨‍⚕️ Nurse\nInput Triage\nPOST /emr/triage"] --> F

    F["👨‍⚕️ Doctor\nMulai Konsultasi\nPOST /emr/start"] --> G

    G["👨‍⚕️ Doctor\nInput Diagnosa KBM\nPOST /emr/diagnosis-kbm"] --> G2

    G2["👨‍⚕️ Medical Records\nVerifikasi ICD-10\nPOST /emr/verify-icd10"] --> H

    H["👨‍⚕️ Doctor\nTambah Tindakan\nPOST /emr/actions"] -->|"Event: MedicalActionAdded"| I

    I["💰 Billing Service\nUpdate Invoice Item\n(background)"] --> J

    J["💊 Pharmacist\nBuat Resep\nPOST /pharmacy/prescriptions"] --> K

    K["🏦 Cashier\nGenerate Invoice\nGET /billing/invoice/{encounter_no}"] --> L

    L["🏦 Cashier\nProses Pembayaran\nPOST /billing/pay"] -->|"Event: InvoicePaid"| M

    M["💊 Pharmacy Service\nUpdate status PAID\n(background)"] --> N

    N["💊 Pharmacist\nKeluarkan Obat\nPOST /pharmacy/dispense"] --> O

    O["✅ Kunjungan Selesai"]
```

---

*Dokumen ini dihasilkan dari analisa kode pada: 2026-08-12*  
*Module: `github.com/aliube/go-micro-simrs-one`*
