import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  RefreshCw, 
  Eye, 
  Pencil, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Stethoscope, 
  UserCheck, 
  Activity, 
  CreditCard, 
  Loader2 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { getAdmisiStatusBadge } from "../theme";

interface Encounter {
  encounter_no: string;
  mrn: string;
  patient_name: string;
  gender: string;
  date_of_birth: string;
  department_code: string;
  doctor_id: string;
  perawat_id?: string;
  status: string;
  status_pasien: string; // "Baru RS" / "Lama RS"
  registered_time: string;
}

// Format current date to YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

export function PatientRegistrationList() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState(getTodayString());

  // Master Data Cache for rich details
  const [masterPoli, setMasterPoli] = useState<any[]>([]);
  const [masterDoctors, setMasterDoctors] = useState<any[]>([]);
  const [masterNurses, setMasterNurses] = useState<any[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal State
  const [selectedDetail, setSelectedDetail] = useState<Encounter | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Edit Modal State
  const [selectedEdit, setSelectedEdit] = useState<Encounter | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editGuarantor, setEditGuarantor] = useState("Umum / Mandiri");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const fetchMasterData = async () => {
    try {
      const [poliRes, docRes, nurseRes] = await Promise.all([
        api.get('/master/polyclinics?page_size=100'),
        api.get('/master/doctors?page_size=500'),
        api.get('/master/nurses?page_size=500')
      ]);
      if (poliRes.data?.success) setMasterPoli(poliRes.data.data || []);
      if (docRes.data?.success) setMasterDoctors(docRes.data.data || []);
      if (nurseRes.data?.success) setMasterNurses(nurseRes.data.data || []);
    } catch (err) {
      console.error("Failed to load master metadata:", err);
    }
  };

  const fetchEncounters = async () => {
    setLoading(true);
    try {
      const dateParam = filterDate === getTodayString() ? "" : filterDate;
      const response = await api.get('/registrations/today', {
        params: {
          date: dateParam
        }
      });
      if (response.data?.success) {
        setEncounters(response.data.data.encounters || []);
      } else {
        toast.error("Gagal mengambil data registrasi hari ini");
      }
    } catch (error) {
      console.error("Error fetching encounters:", error);
      toast.error("Terjadi kesalahan sistem saat mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchEncounters();
  }, [filterDate]);

  const handleCancelEncounter = async (encounterNo: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan registrasi ${encounterNo}?`)) {
      return;
    }

    try {
      const response = await api.post('/registrations/cancel', {
        encounter_no: encounterNo,
        reason: "Dibatalkan oleh petugas admisi"
      });
      if (response.data?.success) {
        toast.success(`Registrasi ${encounterNo} berhasil dibatalkan`);
        fetchEncounters();
      } else {
        toast.error("Gagal membatalkan registrasi");
      }
    } catch (error) {
      console.error("Error cancelling encounter:", error);
      toast.error("Terjadi kesalahan sistem saat membatalkan");
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEdit) return;
    setIsSubmittingEdit(true);
    try {
      const response = await api.put('/registrations/guarantor', {
        encounter_no: selectedEdit.encounter_no,
        guarantor: editGuarantor
      });
      if (response.data?.success) {
        toast.success(`Data penjamin kunjungan ${selectedEdit.encounter_no} berhasil diperbarui`);
        setIsEditOpen(false);
        fetchEncounters();
      } else {
        toast.error("Gagal memperbarui data kunjungan");
      }
    } catch (error) {
      console.error("Error updating encounter:", error);
      toast.error("Terjadi kesalahan saat menyimpan perubahan");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const getPoliName = (code: string) => {
    const poli = masterPoli.find(p => p.code === code);
    if (poli) return poli.name;
    if (code === '01') return 'Poliklinik Umum';
    if (code === '02') return 'Poliklinik Gigi';
    if (code === '03') return 'Poliklinik Anak';
    return code || '-';
  };

  const getDoctorName = (id: string) => {
    if (!id) return "Dokter Belum Ditugaskan";
    const doc = masterDoctors.find(d => d.id === id);
    return doc?.username || doc?.name || id;
  };

  const getNurseName = (id?: string) => {
    if (!id) return "Perawat Belum Ditugaskan";
    const nurse = masterNurses.find(n => n.id === id);
    return nurse?.username || nurse?.name || id;
  };

  const formatGender = (gender: string) => {
    if (!gender || gender === "-") return "-";
    const g = gender.toLowerCase().trim();
    if (g === "m" || g === "male" || g === "laki-laki" || g === "l") return "Laki-laki";
    if (g === "f" || g === "female" || g === "perempuan" || g === "p") return "Perempuan";
    return gender;
  };

  const getStatusBadge = (status: string) => {
    const badge = getAdmisiStatusBadge(status);
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border", badge.className)}>
        <span className={cn("w-1.5 h-1.5 rounded-full", badge.dotClass)} />
        {badge.label}
      </span>
    );
  };

  const getStatusPasienBadge = (statusPasien: string) => {
    if (statusPasien === "Baru RS") {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">Baru RS</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200/80">Lama RS</span>;
  };

  // Filter encounters by search
  const filteredEncounters = encounters.filter(e => 
    e.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.mrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.encounter_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.gender && e.gender.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (e.date_of_birth && e.date_of_birth.includes(searchTerm))
  );

  // Pagination Calculation
  const totalData = filteredEncounters.length;
  const totalPages = Math.max(1, Math.ceil(totalData / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalData);
  const paginatedEncounters = filteredEncounters.slice(startIndex, endIndex);

  return (
    <div className="card-premium overflow-hidden">
      {/* Header Bar with Search & Date Filters */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Data Kunjungan Pasien</h3>
          <p className="text-xs text-slate-500 mt-0.5">Filter berdasarkan tanggal dan pencarian nomor registrasi, MRN, atau nama.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="w-36 sm:w-40 h-10 text-xs bg-white rounded-xl border-slate-200/80 focus-visible:ring-sky-600 shadow-2xs"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              type="text" 
              placeholder="Cari No. Reg / MRN / Nama..." 
              className="pl-9 h-10 text-xs bg-white rounded-xl border-slate-200/80 focus-visible:ring-sky-600 shadow-2xs"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 px-3.5 text-xs font-semibold rounded-xl border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300 transition-all" 
            onClick={fetchEncounters} 
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="p-0 overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader className="bg-slate-50/70 border-b border-slate-100">
            <TableRow>
              <TableHead className="w-[130px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">No. Registrasi</TableHead>
              <TableHead className="w-[120px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">MRN</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">Nama Pasien</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">Kelamin</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">Tgl Lahir</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">Poli Tujuan</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">Status Pasien</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5">Status Kunjungan</TableHead>
              <TableHead className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                    <span className="text-xs font-medium">Memuat data registrasi...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedEncounters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-28 text-center text-slate-400 text-sm">
                  {searchTerm ? "Tidak ada data registrasi yang sesuai pencarian." : "Belum ada pasien yang didaftarkan pada tanggal ini."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedEncounters.map((encounter) => (
                <TableRow key={encounter.encounter_no} className="hover:bg-slate-50/70 transition-colors">
                  {/* No. Registrasi */}
                  <TableCell className="font-semibold text-slate-800 text-xs">
                    {encounter.encounter_no}
                  </TableCell>

                  {/* MRN - High Legibility Styling */}
                  <TableCell>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-md text-xs tracking-wider inline-block shadow-2xs">
                      {encounter.mrn}
                    </span>
                  </TableCell>

                  {/* Nama Pasien */}
                  <TableCell className="font-bold text-slate-900 text-sm">
                    {encounter.patient_name}
                  </TableCell>

                  {/* Kelamin */}
                  <TableCell className="text-xs text-slate-600 font-medium">
                    {formatGender(encounter.gender)}
                  </TableCell>

                  {/* Tgl Lahir */}
                  <TableCell className="text-xs text-slate-600 font-medium">
                    {encounter.date_of_birth || "-"}
                  </TableCell>

                  {/* Poli Tujuan */}
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                      {getPoliName(encounter.department_code)}
                    </span>
                  </TableCell>

                  {/* Status Pasien */}
                  <TableCell>{getStatusPasienBadge(encounter.status_pasien)}</TableCell>

                  {/* Status Kunjungan */}
                  <TableCell>{getStatusBadge(encounter.status)}</TableCell>

                  {/* Kolom Aksi: Icon Edit, Delete, Info Detail */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Info Detail */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg text-sky-600 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                        title="Info Detail Kunjungan"
                        onClick={() => {
                          setSelectedDetail(encounter);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Edit */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                        title="Edit Kunjungan / Penjamin"
                        onClick={() => {
                          setSelectedEdit(encounter);
                          setEditGuarantor("Umum / Mandiri");
                          setIsEditOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {/* Delete / Cancel */}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={encounter.status === 'CANCELLED'}
                        className="h-8 w-8 p-0 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={encounter.status === 'CANCELLED' ? "Kunjungan telah dibatalkan" : "Batalkan Kunjungan"}
                        onClick={() => handleCancelEncounter(encounter.encounter_no)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {totalData > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-xs text-slate-500">
            Menampilkan <span className="font-semibold text-slate-800">{totalData > 0 ? startIndex + 1 : 0}</span> - <span className="font-semibold text-slate-800">{endIndex}</span> dari{" "}
            <span className="font-semibold text-slate-800">{totalData}</span> data (Halaman{" "}
            <span className="font-semibold text-slate-800">{currentPage}</span> dari{" "}
            <span className="font-semibold text-slate-800">{totalPages}</span>)
          </div>

          <div className="flex items-center gap-2">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-xs text-slate-500">Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 text-xs bg-white border border-slate-200 rounded-lg px-2 text-slate-700 font-medium outline-none focus:ring-1 focus:ring-sky-500"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>{size} / hal</option>
                ))}
              </select>
            </div>

            {/* Prev Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1 text-slate-600 rounded-lg border-slate-200 hover:bg-white hover:border-slate-300 transition-all"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Sebelumnya
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                })
                .map((page, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && page - prev > 1;
                  return (
                    <div key={page} className="flex items-center">
                      {showEllipsis && <span className="px-1 text-slate-400 text-xs">...</span>}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0 text-xs rounded-lg font-semibold",
                          currentPage === page 
                            ? "bg-sky-600 hover:bg-sky-700 text-white shadow-2xs" 
                            : "text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    </div>
                  );
                })}
            </div>

            {/* Next Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1 text-slate-600 rounded-lg border-slate-200 hover:bg-white hover:border-slate-300 transition-all"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            >
              Selanjutnya
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* DETAIL INFO MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 px-6 py-6 text-white relative">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-200 bg-sky-800/60 px-2.5 py-0.5 rounded-full border border-sky-400/30">
                  Info Detail Registrasi
                </span>
                <DialogTitle className="text-xl font-bold mt-2 text-white">
                  {selectedDetail?.patient_name}
                </DialogTitle>
                <DialogDescription className="text-sky-100 text-xs mt-0.5">
                  No. Registrasi: <span className="font-mono font-bold text-white">{selectedDetail?.encounter_no}</span>
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 bg-white max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Patient Identity */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <User className="h-3.5 w-3.5 text-sky-600" />
                <span>Identitas Pasien</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">No. Rekam Medis (MRN)</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{selectedDetail?.mrn}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Jenis Kelamin</span>
                  <span className="font-semibold text-slate-800">{formatGender(selectedDetail?.gender || "")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tanggal Lahir</span>
                  <span className="font-semibold text-slate-800">{selectedDetail?.date_of_birth || "-"}</span>
                </div>
              </div>
            </div>

            {/* Visit Details */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Activity className="h-3.5 w-3.5 text-sky-600" />
                <span>Informasi Layanan & Poliklinik</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Poli Tujuan</span>
                  <span className="font-bold text-sky-700 text-sm">
                    {selectedDetail && getPoliName(selectedDetail.department_code)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status Kunjungan</span>
                  <div className="mt-0.5">
                    {selectedDetail && getStatusBadge(selectedDetail.status)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status Pasien</span>
                  <div className="mt-0.5">
                    {selectedDetail && getStatusPasienBadge(selectedDetail.status_pasien)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Waktu Pendaftaran</span>
                  <span className="font-medium text-slate-700">
                    {selectedDetail?.registered_time ? new Date(selectedDetail.registered_time).toLocaleString('id-ID') : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Assigned Personnel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/50 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-sky-600 text-white shrink-0">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wide block">Dokter Pemeriksa</span>
                  <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                    {selectedDetail && getDoctorName(selectedDetail.doctor_id)}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/50 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-teal-600 text-white shrink-0">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wide block">Perawat Pendamping</span>
                  <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                    {selectedDetail && getNurseName(selectedDetail.perawat_id)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsDetailOpen(false)} 
              className="rounded-xl px-5 text-xs font-semibold border-slate-200 text-slate-700"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT KUNJUNGAN MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-5 text-white">
            <DialogTitle className="text-lg font-bold text-white">
              Edit Data Kunjungan
            </DialogTitle>
            <DialogDescription className="text-amber-100 text-xs">
              Ubah data penjamin / informasi registrasi pasien <strong className="text-white">{selectedEdit?.patient_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 bg-white">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">No. Registrasi</Label>
              <Input value={selectedEdit?.encounter_no || ""} disabled className="bg-slate-50 text-xs font-mono font-semibold" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Poli Tujuan</Label>
              <Input value={selectedEdit ? getPoliName(selectedEdit.department_code) : ""} disabled className="bg-slate-50 text-xs font-semibold text-sky-700" />
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold text-slate-700">Metode Pembayaran / Penjamin</Label>
              <div className="grid grid-cols-3 gap-2.5">
                {["Umum / Mandiri", "BPJS Kesehatan", "Asuransi Lainnya"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setEditGuarantor(method)}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-bold text-center transition-all flex flex-col items-center gap-1.5",
                      editGuarantor === method
                        ? "border-amber-600 bg-amber-50 text-amber-800 shadow-2xs scale-[1.02]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <CreditCard className={cn("h-4 w-4", editGuarantor === method ? "text-amber-600" : "text-slate-400")} />
                    <span>{method}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditOpen(false)} 
              className="rounded-xl px-4 text-xs font-semibold border-slate-200 text-slate-700"
            >
              Batal
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={isSubmittingEdit}
              className="rounded-xl px-5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20"
            >
              {isSubmittingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
