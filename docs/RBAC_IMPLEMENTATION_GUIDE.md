# Panduan Implementasi Role-Based Access Control (RBAC)
## SIMRS — Codina Mini SIMRS

**Versi Dokumen:** 1.0  
**Terakhir Diperbarui:** 2026-08-23  
**Status:** Living Document — diperbarui seiring progres implementasi

---

## Daftar Isi

1. [Gambaran Umum Arsitektur](#1-gambaran-umum-arsitektur)
2. [Daftar Role & Tanggung Jawab](#2-daftar-role--tanggung-jawab)
3. [Pola Implementasi (Template)](#3-pola-implementasi-template)
4. [Status Implementasi Saat Ini](#4-status-implementasi-saat-ini)
5. [Panduan Frontend — Per Role](#5-panduan-frontend--per-role)
6. [Panduan Backend — Normalisasi Route](#6-panduan-backend--normalisasi-route)
7. [Urutan Prioritas Pengerjaan](#7-urutan-prioritas-pengerjaan)
8. [Checklist Per Role](#8-checklist-per-role)

---

## 1. Gambaran Umum Arsitektur

### Prinsip Dasar

Setiap role memiliki:
- **Layout sendiri** (sidebar menu khusus)
- **Routes sendiri** (path URL khusus)
- **Dashboard sendiri** (halaman utama setelah login)
- **ProtectedRoute** (guard akses di frontend)

Dan di backend:
- **RequireRole group** (hanya role yang diizinkan yang bisa hit endpoint)

### Pola Folder Frontend (wajib diikuti)

```
src/features/
├── auth/               # Login, Register — tidak perlu layout
├── admin/              # SELESAI — template referensi
│   ├── components/
│   │   └── AdminLayout.tsx
│   ├── pages/
│   │   ├── AdminDashboard.tsx
│   │   └── ...
│   └── routes.tsx
│
├── registration/       # Perlu diperbaiki (role: admisi)
│   ├── components/
│   │   └── AdmisiLayout.tsx      <- BUAT INI
│   ├── pages/
│   │   ├── AdmisiDashboard.tsx   <- RENAME/PERBAIKI
│   │   └── ...
│   └── routes.tsx
│
├── emr/                # Perlu diperbaiki (role: dokter, perawat)
│   ├── components/
│   │   ├── DokterLayout.tsx      <- BUAT INI
│   │   └── PerawatLayout.tsx     <- BUAT INI
│   ├── pages/
│   │   ├── DokterDashboard.tsx   <- BUAT INI
│   │   ├── PerawatDashboard.tsx  <- BUAT INI
│   │   └── ...
│   └── routes.tsx
│
├── billing/            # Belum ada (role: kasir)
│   ├── components/
│   │   └── KasirLayout.tsx       <- BUAT INI
│   ├── pages/
│   │   ├── KasirDashboard.tsx    <- BUAT INI
│   │   └── ...
│   └── routes.tsx
│
├── pharmacy/           # Belum ada (role: asisten_apoteker)
│   ├── components/
│   │   └── ApotekerLayout.tsx    <- BUAT INI
│   ├── pages/
│   │   ├── ApotekerDashboard.tsx <- BUAT INI
│   │   └── ...
│   └── routes.tsx
│
└── patient/            # Belum ada (role: pasien)
    ├── components/
    │   └── PatientLayout.tsx     <- BUAT INI
    ├── pages/
    │   ├── PatientDashboard.tsx  <- BUAT INI
    │   └── ...
    └── routes.tsx
```

### Alur Login & Redirect

```
POST /auth/login
  └── Response: { access_token, refresh_token, role, user_id, poli_code? }
        |
        v
LoginPage.tsx -> switch(role):
  super_admin       -> /admin
  admin             -> /admin
  admisi            -> /admisi          (ganti dari /dashboard)
  dokter            -> /dokter          (ganti dari /emr/queue)
  perawat           -> /perawat         (baru)
  kasir             -> /kasir           (baru)
  asisten_apoteker  -> /apoteker        (baru)
  pasien            -> /pasien          (baru)
```

---

## 2. Daftar Role & Tanggung Jawab

Data dari `auth.master_role`:

| # | Role ID | Deskripsi | Warna Tema | Path Utama |
|---|---------|-----------|------------|------------|
| 1 | `super_admin` | Super Administrator Sistem (IT) | Ungu | `/admin` |
| 2 | `admin` | Administrator IT | Biru | `/admin` |
| 3 | `admisi` | Staf Pendaftaran / Admisi | Teal | `/admisi` |
| 4 | `dokter` | Dokter Poliklinik | Hijau | `/dokter` |
| 5 | `perawat` | Perawat Poliklinik | Cyan | `/perawat` |
| 6 | `kasir` | Kasir Pembayaran | Amber | `/kasir` |
| 7 | `asisten_apoteker` | Asisten Apoteker / Operator Farmasi | Violet | `/apoteker` |
| 8 | `rekam_medis` | Petugas Unit Rekam Medis (EMR) | Indigo | `/rekam-medis` |
| 9 | `pasien` | Pasien | Sky | `/pasien` |

---

## 3. Pola Implementasi (Template)

Gunakan implementasi `admin` sebagai template wajib. Setiap role harus mengikuti pola ini:

### 3.1 Template routes.tsx

```tsx
// src/features/{namaRole}/routes.tsx
import type { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { {NamaRole}Layout } from "./components/{NamaRole}Layout";
import { {NamaRole}Dashboard } from "./pages/{NamaRole}Dashboard";

export const {namaRole}Routes: RouteObject[] = [
  {
    path: "/{path-utama}",
    element: <ProtectedRoute allowedRoles={["{role_id}"]} />,  // WAJIB ADA
    children: [
      {
        element: <{NamaRole}Layout />,
        children: [
          {
            index: true,
            element: <{NamaRole}Dashboard />,  // Halaman utama setelah login
          },
          // Tambahkan route lain di sini...
        ],
      },
    ],
  },
];
```

### 3.2 Template {NamaRole}Layout.tsx

```tsx
// src/features/{namaRole}/components/{NamaRole}Layout.tsx
import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, Bell, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function {NamaRole}Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, logout } = useAuth();

  // Sesuaikan menu dengan kebutuhan role
  const navGroups = [
    {
      title: "Menu Utama",
      items: [
        { name: "Dashboard", path: "/{path-utama}", icon: LayoutDashboard },
        // Tambahkan menu lain...
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - ikuti struktur AdminLayout */}
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <Outlet />
      </main>
    </div>
  );
}
```

### 3.3 Mendaftarkan di routes/index.tsx

```tsx
// src/routes/index.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { authRoutes } from "../features/auth/routes";
import { adminRoutes } from "../features/admin/routes";
import { admisiRoutes } from "../features/registration/routes";   // ganti nama export
import { dokterRoutes } from "../features/emr/routes-dokter";
import { perawatRoutes } from "../features/emr/routes-perawat";
import { kasirRoutes } from "../features/billing/routes";
import { apotekerRoutes } from "../features/pharmacy/routes";
import { pasienRoutes } from "../features/patient/routes";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  ...authRoutes,
  ...adminRoutes,
  ...admisiRoutes,
  ...dokterRoutes,
  ...perawatRoutes,
  ...kasirRoutes,
  ...apotekerRoutes,
  ...pasienRoutes,
]);
```

---

## 4. Status Implementasi Saat Ini

| Role | Backend | Layout | Dashboard | Routes | ProtectedRoute | Login Redirect |
|------|---------|--------|-----------|--------|----------------|----------------|
| `super_admin` | OK | OK AdminLayout | OK | OK | OK | OK `/admin` |
| `admin` | OK | OK AdminLayout | OK | OK | OK | OK `/admin` |
| `admisi` | PERLU FIX | BELUM ADA | PARTIAL generic | PERLU FIX no guard | BELUM | SALAH `/dashboard` |
| `dokter` | PERLU FIX | BELUM ADA | BELUM ADA | PARTIAL generic | OK | PERLU FIX `/emr/queue` |
| `perawat` | PERLU FIX | BELUM ADA | BELUM ADA | BELUM ADA | BELUM | BELUM |
| `kasir` | PERLU FIX | BELUM ADA | BELUM ADA | BELUM ADA | BELUM | BELUM |
| `asisten_apoteker` | PERLU FIX | BELUM ADA | BELUM ADA | BELUM ADA | BELUM | BELUM |
| `pasien` | SANGAT MINIM | BELUM ADA | BELUM ADA | BELUM ADA | BELUM | BELUM |

### Isu Kritis yang Ditemukan

1. **`registrationRoutes` tidak ada `ProtectedRoute`** — siapapun bisa akses `/dashboard` jika tahu URL-nya
2. **`DashboardLayout` terlalu generic** — menu filter hanya di client-side, rapuh
3. **Nama role di backend tidak konsisten dengan DB:**
   - `"nurse"` → seharusnya `"perawat"`
   - `"doctor"` → seharusnya `"dokter"`
   - `"pharmacist"` → seharusnya `"asisten_apoteker"`
   - `"cashier"` → seharusnya `"kasir"`
   - `"medical_records"` → tidak ada di DB, harus dihapus

---

## 5. Panduan Frontend — Per Role

---

### 5.1 Role: admisi (Staf Pendaftaran)

**Path utama:** `/admisi`  
**Tema warna:** Teal/Emerald

**Menu Sidebar:**

```
Dashboard (ringkasan: total kunjungan, antrean aktif)
---
Pendaftaran
  - Daftar Kunjungan Hari Ini    /admisi/kunjungan
  - Pendaftaran Pasien Baru      /admisi/baru
Antrean
  - Monitor Antrean              /admisi/antrean
  - Jadwal Praktek               /admisi/jadwal
```

**Halaman yang Perlu Dibuat/Diperbaiki:**

| File | Status | Keterangan |
|------|--------|------------|
| `components/AdmisiLayout.tsx` | BUAT BARU | Sidebar menu admisi |
| `pages/AdmisiDashboard.tsx` | RENAME dari RegistrationDashboard | Tambah widget ringkasan |
| `pages/DaftarKunjunganPage.tsx` | SUDAH ADA | Sudah jalan |
| `pages/NewRegistrationPage.tsx` | SUDAH ADA | Sudah jalan |
| `pages/QueueManagerPage.tsx` | SUDAH ADA | Sudah jalan |
| `pages/JadwalDokterPerawatPage.tsx` | SUDAH ADA | Sudah jalan |
| `routes.tsx` | PERBAIKI | Tambah ProtectedRoute, ganti path |

**routes.tsx Target Akhir:**

```tsx
export const admisiRoutes: RouteObject[] = [
  {
    path: "/admisi",
    element: <ProtectedRoute allowedRoles={["admisi", "admin"]} />,
    children: [
      {
        element: <AdmisiLayout />,
        children: [
          { index: true, element: <AdmisiDashboard /> },
          { path: "kunjungan", element: <DaftarKunjunganPage /> },
          { path: "baru", element: <NewRegistrationPage /> },
          { path: "antrean", element: <QueueManagerPage /> },
          { path: "jadwal", element: <JadwalDokterPerawatPage /> },
        ],
      },
    ],
  },
];
```

---

### 5.2 Role: dokter (Dokter Poliklinik)

**Path utama:** `/dokter`  
**Tema warna:** Hijau/Emerald

**Menu Sidebar:**

```
Dashboard Poli {nama_poli}
---
Antrean Pasien
  - Daftar Antrean Hari Ini      /dokter/antrean
  - Rekam Medis Pasien           /dokter/encounter/:no
Rekam Medis
  - Riwayat Kunjungan            /dokter/riwayat
```

**Halaman yang Perlu Dibuat/Diperbaiki:**

| File | Status | Keterangan |
|------|--------|------------|
| `components/DokterLayout.tsx` | BUAT BARU | Tampilkan nama poli di header |
| `pages/DokterDashboard.tsx` | BUAT BARU | Statistik pasien hari ini |
| `pages/PoliQueuePage.tsx` | SUDAH ADA | Pindahkan ke routes dokter |
| `pages/EncounterPage.tsx` | SUDAH ADA | Pindahkan ke routes dokter |
| `routes-dokter.tsx` | BUAT BARU | Path baru, layout baru |

**routes-dokter.tsx Target Akhir:**

```tsx
export const dokterRoutes: RouteObject[] = [
  {
    path: "/dokter",
    element: <ProtectedRoute allowedRoles={["dokter"]} />,
    children: [
      {
        element: <DokterLayout />,
        children: [
          { index: true, element: <DokterDashboard /> },
          { path: "antrean", element: <PoliQueuePage /> },
          { path: "encounter/:encounterNo", element: <EncounterPage /> },
          { path: "riwayat", element: <RiwayatPage /> },
        ],
      },
    ],
  },
];
```

**Widget Dashboard Dokter (minimal):**

```
[Total Antrean: 12]  [Sedang Diperiksa: 1]  [Selesai: 3]
Tabel ringkasan antrean pasien hari ini
```

---

### 5.3 Role: perawat (Perawat Poliklinik)

**Path utama:** `/perawat`  
**Tema warna:** Cyan/Sky

**Menu Sidebar:**

```
Dashboard Poli {nama_poli}
---
Antrean Pasien
  - Daftar Antrean Hari Ini      /perawat/antrean
Triage
  - Input Triage Pasien          /perawat/triage
```

**Halaman yang Perlu Dibuat:**

| File | Status | Keterangan |
|------|--------|------------|
| `emr/components/PerawatLayout.tsx` | BUAT BARU | Bisa mirip DokterLayout |
| `emr/pages/PerawatDashboard.tsx` | BUAT BARU | Fokus: antrean & triage |
| `emr/pages/TriagePage.tsx` | BUAT BARU | Input vital sign (dummy) |
| `emr/routes-perawat.tsx` | BUAT BARU | Routes khusus perawat |

**routes-perawat.tsx Target Akhir:**

```tsx
export const perawatRoutes: RouteObject[] = [
  {
    path: "/perawat",
    element: <ProtectedRoute allowedRoles={["perawat"]} />,
    children: [
      {
        element: <PerawatLayout />,
        children: [
          { index: true, element: <PerawatDashboard /> },
          { path: "antrean", element: <PoliQueuePage /> },
          { path: "triage", element: <TriagePage /> },
        ],
      },
    ],
  },
];
```

---

### 5.4 Role: kasir (Kasir Pembayaran)

**Path utama:** `/kasir`  
**Tema warna:** Amber/Orange

**Menu Sidebar:**

```
Dashboard Kasir
---
Tagihan
  - Cari Invoice Pasien          /kasir/invoice
  - Proses Pembayaran            /kasir/bayar
Laporan (dummy)
  - Rekap Pembayaran Hari Ini    /kasir/laporan
```

**Halaman yang Perlu Dibuat:**

| File | Status | Keterangan |
|------|--------|------------|
| `billing/components/KasirLayout.tsx` | BUAT BARU | |
| `billing/pages/KasirDashboard.tsx` | BUAT BARU | Total tagihan hari ini |
| `billing/pages/InvoicePage.tsx` | BUAT BARU | Cari dan lihat invoice |
| `billing/pages/PaymentPage.tsx` | BUAT BARU | Proses pembayaran |
| `billing/routes.tsx` | BUAT BARU | |

**Endpoint Backend yang Digunakan:**

```
GET  /billing/invoice/{encounter_no}   -> Lihat invoice
POST /billing/pay                      -> Proses pembayaran
```

---

### 5.5 Role: asisten_apoteker

**Path utama:** `/apoteker`  
**Tema warna:** Indigo/Violet

**Menu Sidebar:**

```
Dashboard Farmasi
---
Resep
  - Daftar Resep Masuk            /apoteker/resep
  - Proses Dispensing             /apoteker/dispense
Inventaris (dummy)
  - Stok Obat                     /apoteker/stok
```

**Halaman yang Perlu Dibuat:**

| File | Status | Keterangan |
|------|--------|------------|
| `pharmacy/components/ApotekerLayout.tsx` | BUAT BARU | |
| `pharmacy/pages/ApotekerDashboard.tsx` | BUAT BARU | Ringkasan resep masuk |
| `pharmacy/pages/ResepPage.tsx` | BUAT BARU | Daftar resep dari dokter |
| `pharmacy/pages/DispensePage.tsx` | BUAT BARU | Proses pengeluaran obat |
| `pharmacy/routes.tsx` | BUAT BARU | |

**Endpoint Backend yang Digunakan:**

```
GET  /pharmacy/prescriptions   -> Daftar resep masuk
POST /pharmacy/dispense        -> Proses dispensing
```

---

### 5.6 Role: pasien

**Path utama:** `/pasien`  
**Tema warna:** Sky/Blue muda

> Catatan: Role pasien paling banyak memerlukan fitur baru. Untuk sementara cukup buat halaman dummy.

**Menu / Navigasi:**

```
Profil Saya
---
Kunjungan Saya
  - Riwayat Kunjungan            /pasien/kunjungan
Resep Saya (dummy)
  - Daftar Resep                 /pasien/resep
```

**Halaman yang Perlu Dibuat:**

| File | Status | Keterangan |
|------|--------|------------|
| `patient/components/PatientLayout.tsx` | BUAT BARU | Desain lebih consumer-friendly |
| `patient/pages/PatientDashboard.tsx` | BUAT BARU | Profil + kunjungan terakhir |
| `patient/pages/RiwayatKunjunganPage.tsx` | BUAT BARU | Dummy data |
| `patient/routes.tsx` | BUAT BARU | |

---

## 6. Panduan Backend — Normalisasi Route

### 6.1 Masalah Inkonsistensi Nama Role

| Backend saat ini | Seharusnya (sesuai DB) | File/Lokasi |
|-----------------|----------------------|-------------|
| `"nurse"` | `"perawat"` | main.go baris 1293, 1432, 1673 |
| `"doctor"` | `"dokter"` | main.go baris 1877, 2009 |
| `"pharmacist"` | `"asisten_apoteker"` | main.go baris 2105 |
| `"cashier"` | `"kasir"` | main.go baris 2155 |
| `"medical_records"` | (HAPUS — tidak ada di DB) | main.go baris 2050 |

### 6.2 Target State Backend Route Groups

```go
// ADMIN & SUPER ADMIN
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("admin", "super_admin"))
    // /admin/users, /admin/system/*, /master/*, /admin/ai/*
})

// ADMISI
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("admisi", "admin"))
    // POST /registrations/new-patient
    // POST /registrations
    // POST /registrations/cancel
    // PUT  /registrations/guarantor
})

// SHARED: bisa lihat data registrasi
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("admisi", "admin", "dokter", "perawat"))
    // GET /registrations/today
    // GET /registrations/dashboard/metrics
})

// DOKTER (aksi klinis eksklusif)
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("dokter", "admin"))
    // POST /emr/start
    // POST /emr/diagnosis-kbm
    // POST /emr/actions
    // POST /emr/verify-icd10
    // GET  /emr/pending-icd10
    // GET  /emr/kbm/*
})

// PERAWAT (triage)
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("perawat", "admin"))
    // POST /emr/triage
    // GET  /emr/my-poli
})

// DOKTER & PERAWAT (baca rekam medis)
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("dokter", "perawat", "admin"))
    // GET /emr/record/{encounter_no}
})

// KASIR
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("kasir", "admin"))
    // GET  /billing/invoice/{encounter_no}
    // POST /billing/pay
})

// ASISTEN APOTEKER
r.Group(func(r chi.Router) {
    r.Use(middleware.RequireRole("asisten_apoteker", "admin"))
    // GET  /pharmacy/prescriptions
    // POST /pharmacy/dispense
})
```

### 6.3 Checklist Normalisasi Backend

- [ ] Ganti `"nurse"` ke `"perawat"` di semua `RequireRole`
- [ ] Ganti `"doctor"` ke `"dokter"` di semua `RequireRole`
- [ ] Ganti `"pharmacist"` ke `"asisten_apoteker"` di semua `RequireRole`
- [ ] Ganti `"cashier"` ke `"kasir"` di semua `RequireRole`
- [ ] Hapus `"medical_records"` (tidak ada di DB)
- [ ] Pisahkan route dokter-only vs perawat-only vs shared
- [ ] Rebuild api-gateway setelah perubahan

---

## 7. Urutan Prioritas Pengerjaan

### Sprint 1 — Perbaikan & Fondasi (PRIORITAS TINGGI)

**Tujuan:** Semua role bisa login dan masuk ke halaman yang benar

1. **Normalisasi Backend** (1-2 jam)
   - Ganti semua nama role di `main.go` agar sesuai DB
   - Rebuild api-gateway

2. **Perbaikan `admisi`** (2-3 jam)
   - Buat `AdmisiLayout.tsx`
   - Tambah `ProtectedRoute` di routes
   - Ubah path ke `/admisi/*`
   - Update redirect di `LoginPage.tsx`

3. **Perbaikan `dokter`** (2-3 jam)
   - Buat `DokterLayout.tsx`
   - Buat `DokterDashboard.tsx` (minimal dummy stats)
   - Ubah path ke `/dokter/*`
   - Update redirect di `LoginPage.tsx`

4. **Update `routes/index.tsx`** (30 menit)
   - Daftarkan semua routes baru

### Sprint 2 — Role Klinis (PRIORITAS MENENGAH)

5. **Buat `perawat`** (2-3 jam)
   - `PerawatLayout.tsx`, `PerawatDashboard.tsx`
   - Routes `/perawat/*`

6. **Buat `kasir`** (2-3 jam)
   - `KasirLayout.tsx`, `KasirDashboard.tsx`
   - `InvoicePage.tsx`, `PaymentPage.tsx` (integrasi API billing)
   - Routes `/kasir/*`

7. **Buat `asisten_apoteker`** (2-3 jam)
   - `ApotekerLayout.tsx`, `ApotekerDashboard.tsx`
   - `ResepPage.tsx`, `DispensePage.tsx` (integrasi API pharmacy)
   - Routes `/apoteker/*`

### Sprint 3 — Portal Pasien (PRIORITAS RENDAH)

8. **Buat `pasien`** (3-4 jam)
   - `PatientLayout.tsx`, `PatientDashboard.tsx`
   - Halaman dummy untuk riwayat kunjungan
   - Routes `/pasien/*`

---

## 8. Checklist Per Role

### Template Checklist (salin per role)

```
[ ] Backend: RequireRole menggunakan nama role yang benar (sesuai DB)
[ ] Frontend: File {NamaRole}Layout.tsx dibuat
[ ] Frontend: File {NamaRole}Dashboard.tsx dibuat (minimal dummy)
[ ] Frontend: routes.tsx dibuat dengan ProtectedRoute
[ ] Frontend: Semua halaman didaftarkan di routes
[ ] Frontend: routes/index.tsx diperbarui (import & spread routes baru)
[ ] Frontend: LoginPage.tsx redirect ke path yang benar
[ ] Test: Login dengan role ini berhasil masuk ke halaman yang benar
[ ] Test: Akses ke path role lain di-redirect ke /unauthorized
[ ] Test: API call dari halaman ini tidak 403
```

### 8.1 Checklist: admisi

- [ ] Backend: Ganti `"nurse"` ke `"perawat"` di baris 1293, 1432
- [ ] Backend: Verifikasi route admisi hanya bisa diakses role `admisi` dan `admin`
- [ ] Frontend: Buat `features/registration/components/AdmisiLayout.tsx`
- [ ] Frontend: Buat/rename `features/registration/pages/AdmisiDashboard.tsx`
- [ ] Frontend: Update `features/registration/routes.tsx` dengan ProtectedRoute + path `/admisi`
- [ ] Frontend: Update `src/routes/index.tsx`
- [ ] Frontend: Update redirect di `LoginPage.tsx` untuk `admisi` ke `/admisi`
- [ ] Test: Login admisi masuk ke `/admisi` (bukan `/dashboard`)
- [ ] Test: Login role lain tidak bisa akses `/admisi`
- [ ] Test: API `/registrations/*` tidak 403

### 8.2 Checklist: dokter

- [ ] Backend: Ganti semua `"doctor"` ke `"dokter"`
- [ ] Backend: Ganti semua `"nurse"` ke `"perawat"`
- [ ] Frontend: Buat `features/emr/components/DokterLayout.tsx`
- [ ] Frontend: Buat `features/emr/pages/DokterDashboard.tsx`
- [ ] Frontend: Buat `features/emr/routes-dokter.tsx` dengan path `/dokter`
- [ ] Frontend: Update `src/routes/index.tsx`
- [ ] Frontend: Update redirect di `LoginPage.tsx` untuk `dokter` ke `/dokter`
- [ ] Test: Login dokter masuk ke `/dokter` (bukan `/emr/queue`)
- [ ] Test: Sidebar menampilkan nama poli dengan benar
- [ ] Test: API `/emr/*` tidak 403

### 8.3 Checklist: perawat

- [ ] Backend: Pastikan `"perawat"` ada di RequireRole group yang relevan
- [ ] Backend: Pisahkan endpoint dokter-only dari perawat
- [ ] Frontend: Buat `features/emr/components/PerawatLayout.tsx`
- [ ] Frontend: Buat `features/emr/pages/PerawatDashboard.tsx`
- [ ] Frontend: Buat `features/emr/pages/TriagePage.tsx` (dummy)
- [ ] Frontend: Buat `features/emr/routes-perawat.tsx` dengan path `/perawat`
- [ ] Frontend: Update `src/routes/index.tsx`
- [ ] Frontend: Update redirect di `LoginPage.tsx` untuk `perawat` ke `/perawat`
- [ ] Test: Login perawat masuk ke `/perawat`
- [ ] Test: API `/emr/triage` tidak 403

### 8.4 Checklist: kasir

- [ ] Backend: Ganti `"cashier"` ke `"kasir"` di baris 2155
- [ ] Frontend: Buat `features/billing/components/KasirLayout.tsx`
- [ ] Frontend: Buat `features/billing/pages/KasirDashboard.tsx`
- [ ] Frontend: Buat `features/billing/pages/InvoicePage.tsx`
- [ ] Frontend: Buat `features/billing/pages/PaymentPage.tsx`
- [ ] Frontend: Buat `features/billing/routes.tsx` dengan path `/kasir`
- [ ] Frontend: Update `src/routes/index.tsx`
- [ ] Frontend: Update redirect di `LoginPage.tsx` untuk `kasir` ke `/kasir`
- [ ] Test: Login kasir masuk ke `/kasir`
- [ ] Test: API `/billing/*` tidak 403

### 8.5 Checklist: asisten_apoteker

- [ ] Backend: Ganti `"pharmacist"` ke `"asisten_apoteker"` di baris 2105
- [ ] Backend: Hapus `"medical_records"` dari baris 2050 (tidak ada di DB)
- [ ] Frontend: Buat `features/pharmacy/components/ApotekerLayout.tsx`
- [ ] Frontend: Buat `features/pharmacy/pages/ApotekerDashboard.tsx`
- [ ] Frontend: Buat `features/pharmacy/pages/ResepPage.tsx`
- [ ] Frontend: Buat `features/pharmacy/pages/DispensePage.tsx`
- [ ] Frontend: Buat `features/pharmacy/routes.tsx` dengan path `/apoteker`
- [ ] Frontend: Update `src/routes/index.tsx`
- [ ] Frontend: Update redirect di `LoginPage.tsx` untuk `asisten_apoteker` ke `/apoteker`
- [ ] Test: Login asisten_apoteker masuk ke `/apoteker`
- [ ] Test: API `/pharmacy/*` tidak 403

### 8.6 Checklist: pasien

- [ ] Backend: Tambah/perkuat endpoint yang relevan untuk pasien
- [ ] Frontend: Buat `features/patient/components/PatientLayout.tsx`
- [ ] Frontend: Buat `features/patient/pages/PatientDashboard.tsx`
- [ ] Frontend: Buat `features/patient/pages/RiwayatKunjunganPage.tsx` (dummy)
- [ ] Frontend: Buat `features/patient/routes.tsx` dengan path `/pasien`
- [ ] Frontend: Update `src/routes/index.tsx`
- [ ] Frontend: Update redirect di `LoginPage.tsx` untuk `pasien` ke `/pasien`
- [ ] Test: Login pasien masuk ke `/pasien`

---

## Catatan Tambahan

### Tentang DashboardLayout.tsx (Generic)

File `src/components/layout/DashboardLayout.tsx` yang saat ini ada sebaiknya **dihapus atau tidak digunakan lagi** setelah semua role punya layout sendiri. Pendekatan "satu layout untuk semua role" menyebabkan:
- Logika `allowedRoles` per menu item menjadi kompleks
- Risiko kebocoran menu antar role  
- Sulit di-maintain seiring penambahan role

### Tentang Shared Components

Beberapa komponen UI boleh di-share antar role, misalnya:
- `PoliQueuePage.tsx` — bisa dipakai oleh dokter & perawat
- `PatientCard.tsx` — bisa dipakai di beberapa halaman
- Namun **Layout dan Routes harus tetap terpisah per role**

### Tentang Halaman /unauthorized

Pastikan ada halaman `/unauthorized` yang proper. Saat ini `ProtectedRoute` sudah redirect ke `/unauthorized` tapi halaman belum dibuat. Buat halaman sederhana ini sebelum mulai implementasi role baru.

---

*Dokumen ini adalah panduan hidup. Perbarui status checklist setiap kali ada progres implementasi.*
