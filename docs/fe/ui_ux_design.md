# Rancangan UI/UX & Spesifikasi Form - SIMRS Rawat Jalan

Dokumen ini memetakan alur antarmuka pengguna (UI/UX) beserta **struktur form** yang sangat spesifik dan referensi *mockup* untuk setiap modul. Hal ini dirancang untuk memastikan integrasi yang mulus (*seamless*) dengan Backend API.

---

## 1. Modul Autentikasi & Registrasi (Login & Sign Up)

Modul ini adalah pintu masuk sistem. Desain difokuskan pada kebersihan antarmuka, validasi instan, dan penanganan error secara *graceful*.

![Login Page Mockup](/home/aliube/.gemini/antigravity/brain/075aa9a4-f4cd-42d3-90e9-882df7411e02/login_page_mockup_1786539057775.png)

### 📋 Form: Login Karyawan (`POST /api/v1/auth/login`)
| Field | UI Component | Tipe Data | Validasi Frontend | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Username** | Text Input | `string` | Wajib diisi, min 4 karakter | |
| **Password** | Password Input (Togle Eye) | `string` | Wajib diisi | Menyembunyikan karakter default |

### 📋 Form: Registrasi Pasien Mandiri (`POST /api/v1/auth/signup/patient`)
| Field | UI Component | Tipe Data | Validasi Frontend | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **NIK** | Number Input (Masked) | `string` | Wajib, Tepat 16 Digit | Gunakan format auto-spacing |
| **Nama Lengkap** | Text Input | `string` | Wajib, min 3 karakter | |
| **Tanggal Lahir** | Date Picker | `string` | Wajib, format `YYYY-MM-DD` | Pasien tidak boleh memilih tanggal di masa depan |
| **Username** | Text Input | `string` | Wajib, alfanumerik | Unik untuk login aplikasi mobile pasien |
| **Password** | Password Input | `string` | Wajib, min 8 karakter | Minimal 1 huruf besar dan 1 angka |

---

## 2. Modul Pelayanan Poliklinik (Perawat & Dokter)

Modul Electronic Medical Record (EMR) memegang peranan sangat penting. Sistem menerapkan *Split-Screen* untuk mengoptimalkan ruang kerja dokter.

![EMR Dashboard Mockup](/home/aliube/.gemini/antigravity/brain/075aa9a4-f4cd-42d3-90e9-882df7411e02/emr_dashboard_mockup_1786539269735.png)

### 📋 Form: Triage / Pemeriksaan Perawat (`POST /api/v1/emr/triage`)
| Field | UI Component | Tipe Data | Validasi Frontend | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Tekanan Darah (Sistolik)** | Number Input | `int32` | Opsional, 0-300 | Satuan mmHg |
| **Tekanan Darah (Diastolik)** | Number Input | `int32` | Opsional, 0-200 | Satuan mmHg |
| **Suhu Tubuh** | Decimal Input | `float64` | Opsional, 30.0-45.0 | Satuan Celcius |
| **Detak Jantung** | Number Input | `int32` | Opsional, 0-250 | Satuan BPM |
| **Catatan Perawat** | Text Area | `string` | Opsional | Keluhan penyerta |

### 📋 Form: Diagnosa Dokter (`POST /api/v1/emr/diagnosis-kbm`)
| Field | UI Component | Tipe Data | Validasi Frontend | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Kode KBM (Pencarian)** | Autocomplete Search | `string` | Wajib Dipilih | Memanggil `GET /emr/kbm/search?q=...&dept_code=...` dengan Debounce 300ms |
| **Catatan Medis** | Rich Text Editor | `string` | Opsional | SOAP (Subjective, Objective, Assessment, Plan) |

---

## 3. Modul Apotek (Pharmacy)

Apotek berjalan dengan alur *Kanban Board*. Setiap kartu resep obat merepresentasikan data dari `GET /queue/pharmacy/stream`. Apoteker tidak diperkenankan memproses resep yang belum dibayar di kasir.

![Pharmacy Kanban Mockup](/home/aliube/.gemini/antigravity/brain/075aa9a4-f4cd-42d3-90e9-882df7411e02/pharmacy_kanban_mockup_1786539288166.png)

### 📋 Form: Konfirmasi Dispense Obat (`POST /api/v1/pharmacy/dispense`)
Form ini dimunculkan di dalam sebuah *Modal Dialog* saat apoteker mengklik "Selesai" pada sebuah kartu resep.
| Field | UI Component | Tipe Data | Validasi Frontend | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Catatan Edukasi Pasien** | Text Area | `string` | Opsional | Aturan minum tambahan atau peringatan alergi |
| **Apoteker Penanggung Jawab** | Dropdown / Readonly | `string` | Otomatis dari User Login | |

---

## 4. Modul Kasir (Billing)

Fokus utama adalah memisahkan penagihan dengan jelas antara jasa pelayanan (tindakan) dan barang (obat).

### 📋 Form: Pelunasan (`POST /api/v1/billing/pay`)
| Field | UI Component | Tipe Data | Validasi Frontend | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Metode Pembayaran** | Radio Button Group | `string` | Wajib (Cash / QRIS / Transfer) | |
| **Jumlah Uang Diterima** | Currency Input | `float64` | Wajib, >= Total Tagihan | Munculkan *auto-calculate* untuk Uang Kembalian |

---

## 5. Modul Rekam Medis (ICD-10 Mapping)

Petugas rekam medis melakukan kodifikasi data penyakit berbekal *suggestions* (rekomendasi) yang dihasilkan oleh sistem. 

### 📋 Form: Verifikasi ICD-10 (`POST /api/v1/emr/verify-icd10`)
| Field | UI Component | Tipe Data | Validasi Frontend | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **ICD-10 Codes** | Multi-Select Tags | `[]string` | Wajib, minimal 1 | Sistem menyarankan dari `GET /emr/kbm/{code}/icd10-suggestions`. Petugas bebas menambah kode lain. |
| **Catatan Rekam Medis** | Text Input | `string` | Opsional | Alasan revisi kodifikasi (jika ada) |

---

> [!TIP]
> **Komponen Reusable yang Harus Dibuat Frontend:**
> 1. `DebouncedAsyncSelect`: Komponen *dropdown* yang menunda *request* API hingga pengguna selesai mengetik (sangat penting untuk optimasi pencarian KBM).
> 2. `CurrencyFormatter`: Komponen HOC (Higher-Order Component) yang otomatis merubah angka raw (100000) menjadi format Rupiah (Rp 100.000) di tampilan kasir tanpa merubah nilai aslinya di state.
> 3. `SSEProvider`: Custom hook (misal: `useSSE`) untuk me-manage koneksi ke *Server-Sent Events* (/stream) dan otomatis memulihkan koneksi jika terputus.
