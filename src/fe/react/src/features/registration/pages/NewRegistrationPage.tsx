import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Search, CreditCard, UserCircle, Camera, UploadCloud, X, Loader2, Check, Activity, Clock, Stethoscope, UserCheck, UserPlus, ChevronLeft, ChevronRight, Plus, AlertCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getHospitalTodayDate } from "@/lib/dateUtils";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { AdmisiPageHeader } from "../components/AdmisiPageHeader";
import { admisiTheme } from "../theme";

interface Patient {
  mrn: string;
  name: string;
  date_of_birth: string;
  gender: string;
  address: string;
}

export function NewRegistrationPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Recent Registrations Sidebar State
  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  const [summaryFilter, setSummaryFilter] = useState("");
  
  // Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedPoli, setPoli] = useState("");
  const [selectedDoctor, setDoctor] = useState("");
  const [selectedNurse, setNurse] = useState("");
  const [selectedPayment, setPayment] = useState("Umum / Mandiri");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Master Data State
  const [masterPoli, setMasterPoli] = useState<any[]>([]);
  const [masterDoctors, setMasterDoctors] = useState<any[]>([]);
  const [masterNurses, setMasterNurses] = useState<any[]>([]);
  const [isFetchingMaster, setIsFetchingMaster] = useState(false);

  // New Patient State
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    nik: "", name: "", date_of_birth: "", gender: "Laki-laki", address: "", email: "", phone: ""
  });
  
  // OCR & Photo State
  const searchKtpInputRef = useRef<HTMLInputElement>(null);
  const [isSearchingKtp, setIsSearchingKtp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ktpPhotoPreview, setKtpPhotoPreview] = useState<string | null>(null);
  const [patientPhotoPreview, setPatientPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients(searchQuery, currentPage, pageSize);
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchRecentRegistrations();
    fetchMasterData();
  }, []);

  const formatGender = (gender?: string) => {
    if (!gender) return "-";
    const g = gender.trim().toUpperCase();
    if (g === "M" || g === "MALE" || g === "LAKI-LAKI" || g === "L") return "Laki-laki";
    if (g === "F" || g === "FEMALE" || g === "PEREMPUAN" || g === "P") return "Perempuan";
    return gender;
  };

  const [todayPiketList, setTodayPiketList] = useState<any[]>([]);

  const fetchMasterData = async () => {
    setIsFetchingMaster(true);
    try {
      const todayStr = getHospitalTodayDate();
      const [poliRes, docRes, nurseRes, piketRes] = await Promise.all([
        api.get('/master/polyclinics?page_size=100'),
        api.get('/master/doctors?page_size=500'),
        api.get('/master/nurses?page_size=500'),
        api.get(`/master/jadwal-piket?date=${todayStr}`)
      ]);
      if (poliRes.data?.success) setMasterPoli(poliRes.data.data || []);
      if (docRes.data?.success) setMasterDoctors(docRes.data.data || []);
      if (nurseRes.data?.success) setMasterNurses(nurseRes.data.data || []);
      if (piketRes.data?.success) setTodayPiketList(piketRes.data.data || []);
    } catch (err) {
      console.error("Failed to fetch master data:", err);
      toast.error("Gagal mengambil data master Poliklinik/Dokter");
    } finally {
      setIsFetchingMaster(false);
    }
  };

  const fetchPatients = async (query: string, page: number = 1, size: number = pageSize) => {
    setIsSearching(true);
    try {
      const response = await api.get(`/patients`, {
        params: { search: query, page, page_size: size }
      });
      const data = response.data;
      if (data.success && data.data) {
        const results = Array.isArray(data.data) ? data.data : [data.data];
        setPatientsList(results.map((p: any) => ({
          mrn: p.mrn,
          name: p.name,
          date_of_birth: p.date_of_birth || p.dob || "-",
          gender: p.gender || "-",
          address: p.address || "-",
        })));
        if (data.meta) {
          setTotalPages(data.meta.total_pages || 1);
          setTotalData(data.meta.total_data || 0);
        }
      } else {
        setPatientsList([]);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      toast.error("Gagal mengambil data pasien");
    } finally {
      setIsSearching(false);
    }
  };

  const fetchRecentRegistrations = async () => {
    try {
      const response = await api.get('/registrations/today');
      const data = response.data;
      if (data && data.success && data.data) {
        // The API returns { encounters: [...], total: X }
        const allEncounters = data.data.encounters || [];
        setRecentRegistrations(allEncounters.slice(0, 250));
      }
    } catch (err) {
      console.error("Failed to fetch recent registrations:", err);
    }
  };

  const handleSearchPatient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCurrentPage(1);
    fetchPatients(searchQuery, 1, pageSize);
  };

  const handleSearchKtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsSearchingKtp(true);
    const formData = new FormData();
    formData.append("ktp", file);

    try {
      const response = await api.post(`/registrations/ocr-ktp`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const data = response.data;
      if (response.status === 200 && data.success && data.data) {
        const ocrData = data.data;
        if (ocrData.nik) {
          setSearchQuery(ocrData.nik);
          setCurrentPage(1);
          fetchPatients(ocrData.nik, 1, pageSize);
        } else {
          toast.error("Gagal membaca NIK dari KTP");
        }
      } else {
        toast.error("Gagal memproses KTP: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat memproses KTP");
    } finally {
      setIsSearchingKtp(false);
    }
  };

  const openRegisterModal = (patient: Patient) => {
    setSelectedPatient(patient);
    setPoli("");
    setDoctor("");
    setNurse("");
    setPayment("Umum / Mandiri");
    setIsRegisterModalOpen(true);
    const todayStr = getHospitalTodayDate();
    api.get(`/master/jadwal-piket?date=${todayStr}`)
      .then((res) => {
        if (res.data?.success) setTodayPiketList(res.data.data || []);
      })
      .catch(() => {});
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPatient(true);
    
    const newPat: Patient = {
      mrn: "NEW", // Marker for new patient
      name: newPatientForm.name,
      date_of_birth: newPatientForm.date_of_birth,
      gender: newPatientForm.gender,
      address: newPatientForm.address,
    };
    
    closeNewPatientModal();
    openRegisterModal(newPat);
    setIsCreatingPatient(false);
  };

  const closeNewPatientModal = () => {
    setIsNewPatientModalOpen(false);
    setKtpPhotoPreview(null);
    setPatientPhotoPreview(null);
  };

  const handleKtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const reader = new FileReader();
    reader.onload = (event) => setKtpPhotoPreview(event.target?.result as string);
    reader.readAsDataURL(file);

    setIsOcrProcessing(true);
    const formData = new FormData();
    formData.append("ktp", file);

    try {
      const response = await api.post(`/registrations/ocr-ktp`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      const data = response.data;
      if (response.status === 200 && data.success && data.data) {
        const ocrData = data.data;
        setNewPatientForm(prev => ({
          ...prev,
          nik: ocrData.nik || prev.nik,
          name: ocrData.name || prev.name,
          date_of_birth: ocrData.dob || prev.date_of_birth,
          gender: ocrData.gender || prev.gender,
          address: ocrData.address || prev.address
        }));
        toast.success("Berhasil membaca data dari KTP");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memproses foto KTP: " + (err.response?.data?.message || err.message || "Terjadi kesalahan internal."));
      setKtpPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsOcrProcessing(false);
    }
  };
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => setPatientPhotoPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRegister = async () => {
    try {
      if (!selectedPoli) {
        toast.error("Harap pilih poliklinik tujuan terlebih dahulu.");
        return;
      }

      if (!assignedDoctor) {
        toast.error(`Pendaftaran ditolak: Tidak ada dokter yang bertugas di poliklinik ini pada hari ${currentDayName}.`);
        return;
      }

      setIsSubmitting(true);
      let guarantor = "Umum";
      if (selectedPayment === "BPJS Kesehatan") guarantor = "BPJS";
      else if (selectedPayment === "Asuransi Lainnya") guarantor = "Asuransi";

      const doctorIdToSend = assignedDoctor?.id || selectedDoctor;
      const perawatIdToSend = assignedNurse?.id || selectedNurse;

      let response;
      if (selectedPatient?.mrn === "NEW") {
        response = await api.post(`/registrations/new-patient`, {
          name: newPatientForm.name,
          nik: newPatientForm.nik,
          dob: newPatientForm.date_of_birth,
          gender: newPatientForm.gender,
          birth_place: "",
          address: newPatientForm.address,
          email: newPatientForm.email,
          department_code: selectedPoli,
          doctor_id: doctorIdToSend,
          perawat_id: perawatIdToSend,
          guarantor: guarantor
        });
      } else {
        response = await api.post(`/registrations`, {
          mrn: selectedPatient?.mrn,
          department_code: selectedPoli,
          doctor_id: doctorIdToSend,
          perawat_id: perawatIdToSend,
          guarantor: guarantor
        });
      }
      
      const data = response.data;
      if (response.status === 200 && data.success) {
        toast.success(selectedPatient?.mrn === "NEW" ? "Pasien Baru dan Pendaftaran berhasil disimpan!" : "Pendaftaran berhasil disimpan!");
        setIsRegisterModalOpen(false);
        setNewPatientForm({ nik: "", name: "", date_of_birth: "", gender: "Laki-laki", address: "", email: "", phone: "" });
        
        // Refresh both lists
        fetchPatients(searchQuery, currentPage);
        fetchRecentRegistrations();
      } else {
        toast.error("Gagal mendaftar: " + (data.message || "Unknown error"));
      }
    } catch (error: any) {
      console.error("Failed to register:", error);
      toast.error("Gagal mendaftar: " + (error.response?.data?.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hari kerja saat ini (1 = Senin, ..., 6 = Sabtu, 7 = Minggu)
  const currentDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const dayNames: Record<number, string> = {
    1: "Senin",
    2: "Selasa",
    3: "Rabu",
    4: "Kamis",
    5: "Jumat",
    6: "Sabtu",
    7: "Minggu",
  };
  const currentDayName = dayNames[currentDayOfWeek] || "Hari Ini";

  // Helper untuk mengecek apakah tenaga medis memiliki jadwal dinas hari ini
  const isPersonnelScheduledToday = (personnel: any) => {
    if (!personnel?.days_of_week) return false;
    if (Array.isArray(personnel.days_of_week)) {
      return personnel.days_of_week.includes(currentDayOfWeek);
    }
    return false;
  };

  // Poliklinik beserta status operasionalnya hari ini (Prioritas 1: Piket, Prioritas 2: Jadwal Reguler)
  const polyclinicOptions = masterPoli.map(poli => {
    const piketForPoli = todayPiketList.find(p => p.poli_code === poli.code);
    const hasDoctorToday = Boolean(piketForPoli) || masterDoctors.some(
      d => d.poli_code === poli.code && isPersonnelScheduledToday(d)
    );
    const hasNurseToday = Boolean(piketForPoli?.perawat_id) || masterNurses.some(
      n => n.poli_code === poli.code && isPersonnelScheduledToday(n)
    );
    return {
      ...poli,
      isOpenToday: hasDoctorToday,
      hasNurseToday: hasNurseToday,
      isPiket: Boolean(piketForPoli),
      piketData: piketForPoli,
    };
  });

  // Dokter dan Perawat yang AKTIF BERTUGAS HARI INI di poliklinik terpilih
  const piketSelected = todayPiketList.find(p => p.poli_code === selectedPoli);

  const assignedDoctor = piketSelected ? {
    id: piketSelected.dokter_id,
    username: piketSelected.dokter_name,
    spesialisasi: piketSelected.dokter_spesialisasi || "Dokter Piket",
    isPiket: true,
    shift_start: piketSelected.shift_start,
    shift_end: piketSelected.shift_end,
    keterangan: piketSelected.keterangan,
  } : masterDoctors.find(
    d => d.poli_code === selectedPoli && isPersonnelScheduledToday(d)
  );

  const assignedNurse = (piketSelected && piketSelected.perawat_id) ? {
    id: piketSelected.perawat_id,
    username: piketSelected.perawat_name,
    isPiket: true,
    shift_start: piketSelected.shift_start,
    shift_end: piketSelected.shift_end,
  } : masterNurses.find(
    n => n.poli_code === selectedPoli && isPersonnelScheduledToday(n)
  );

  const handlePoliChange = (poliCode: string) => {
    setPoli(poliCode);
    const piket = todayPiketList.find(p => p.poli_code === poliCode);
    if (piket) {
      setDoctor(piket.dokter_id);
      setNurse(piket.perawat_id || "");
    } else {
      const doc = masterDoctors.find(
        d => d.poli_code === poliCode && isPersonnelScheduledToday(d)
      );
      const nurse = masterNurses.find(
        n => n.poli_code === poliCode && isPersonnelScheduledToday(n)
      );
      setDoctor(doc?.id || "");
      setNurse(nurse?.id || "");
    }
  };

  return (
    <div className={admisiTheme.layout.container}>
      {/* Page Header */}
      <AdmisiPageHeader
        title="Pendaftaran Pasien"
        description="Kelola data pasien, pencarian rekam medis, dan pendaftaran kunjungan rawat jalan."
        badge="Admisi Pasien"
        icon={UserPlus}
        actions={
          <Button 
            onClick={() => setIsNewPatientModalOpen(true)} 
            className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md shadow-sky-600/20 font-bold px-5 h-11 transition-all"
          >
            <UserCircle className="mr-2 h-5 w-5" />
            Pasien Baru
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch flex-1 min-h-0">
        {/* Left Column - Patient Directory (8 cols) */}
        <div className="xl:col-span-8 flex flex-col flex-1 min-h-0">
          <Card className="card-premium overflow-hidden flex flex-col flex-1 h-full min-h-0">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100/80 p-4 sm:p-5 shrink-0">
              <form onSubmit={handleSearchPatient} className="relative flex gap-3">
                <div className="relative flex-1 max-w-2xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan No. RM, Nama, atau NIK..." 
                    className="pl-12 pr-12 h-12 bg-white border-slate-200/80 text-slate-900 placeholder:text-slate-400 focus-visible:ring-sky-600 focus-visible:border-sky-600 rounded-xl shadow-xs"
                  />
                  <Button 
                    type="button" variant="ghost" size="icon" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-sky-600 rounded-full"
                    onClick={() => searchKtpInputRef.current?.click()} title="Scan KTP"
                  >
                    {isSearchingKtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                  <input 
                    type="file" ref={searchKtpInputRef} className="hidden" 
                    accept="image/*" capture="environment" onChange={handleSearchKtpUpload} 
                  />
                </div>
                <Button type="submit" disabled={isSearching} className="h-12 px-7 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition-all font-bold">
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cari Pasien"}
                </Button>
              </form>
            </CardHeader>
            
            {/* Main Patient Table */}
            <div className="p-0 overflow-x-auto overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0">
              <Table className="w-full">
                <TableHeader className="bg-slate-50/70 border-b border-slate-100 shrink-0">
                  <TableRow>
                    <TableHead className="w-[140px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">No. RM</TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">Nama Pasien</TableHead>
                    <TableHead className="w-[130px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">Tgl Lahir</TableHead>
                    <TableHead className="w-[120px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">Kelamin</TableHead>
                    <TableHead className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 w-[130px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientsList.length > 0 ? (
                    patientsList.map((patient, idx) => {
                      const isRegisteredToday = recentRegistrations.some(enc => enc.mrn === patient.mrn);
                      return (
                        <TableRow key={idx} className="hover:bg-sky-50/40 transition-colors border-b border-slate-100/80">
                          <TableCell className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-md text-xs tracking-wider inline-block shadow-2xs">
                              {patient.mrn}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-4 font-semibold text-slate-900 text-xs">
                            <div className="flex items-center gap-2">
                              <span>{patient.name}</span>
                              {isRegisteredToday && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                  Terdaftar
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 font-mono text-xs text-slate-600">
                            {patient.date_of_birth || "-"}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-xs text-slate-600 font-medium">
                            {formatGender(patient.gender)}
                          </TableCell>
                          <TableCell className="py-3 px-4 text-right">
                            {isRegisteredToday ? (
                              <Button 
                                onClick={() => openRegisterModal(patient)} 
                                size="sm" 
                                variant="outline" 
                                className="h-8 text-xs font-semibold px-3 border-sky-200 text-sky-700 bg-sky-50/50 hover:bg-sky-100 hover:text-sky-800 rounded-lg whitespace-nowrap transition-colors shadow-2xs gap-1.5" 
                                title="Sudah terdaftar hari ini, klik untuk daftar poli lain"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Poli Lain
                              </Button>
                            ) : (
                              <Button 
                                onClick={() => openRegisterModal(patient)} 
                                size="sm" 
                                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/20 font-semibold text-xs transition-all gap-1.5"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Daftarkan
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-16 text-center text-slate-500 text-xs">
                        {isSearching ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                            <span>Mencari data pasien...</span>
                          </div>
                        ) : (
                          "Tidak ada pasien ditemukan."
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Unified SIMRS Pagination Bar */}
            <div className="mt-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/40 rounded-b-2xl shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                {totalData > 0 ? (
                  <>
                    Menampilkan <span className="font-semibold text-slate-700">{((currentPage - 1) * pageSize) + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(currentPage * pageSize, totalData)}</span> dari <span className="font-semibold text-slate-700">{totalData}</span> data
                    {totalPages > 1 && <span className="text-slate-400 ml-1.5">(Halaman {currentPage} dari {totalPages})</span>}
                  </>
                ) : (
                  <span>Total: 0 data</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Rows Per Page Selector */}
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
                  disabled={currentPage <= 1 || isSearching}
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
                  disabled={currentPage >= totalPages || isSearching}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                >
                  Selanjutnya
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Summary Sidebar (4 cols) */}
        <div className="xl:col-span-4 flex flex-col flex-1 min-h-0">
          <Card className="card-premium overflow-hidden flex flex-col flex-1 h-full min-h-0">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 sm:p-5 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Pendaftaran Hari Ini</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">Pasien yang terdaftar hari ini</CardDescription>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full">
                  {recentRegistrations.length} Pasien
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col space-y-4 min-h-0">
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Cari pasien / poli..." 
                  value={summaryFilter}
                  onChange={(e) => setSummaryFilter(e.target.value)}
                  className="pl-9 h-10 text-xs bg-slate-50 border-slate-200/80 rounded-xl focus-visible:ring-sky-600"
                />
              </div>
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0">
                {recentRegistrations.length > 0 ? (
                  recentRegistrations
                    .filter(enc => 
                      (enc.patient_name || '').toLowerCase().includes(summaryFilter.toLowerCase()) || 
                      (enc.mrn || '').toLowerCase().includes(summaryFilter.toLowerCase()) ||
                      (enc.department_code === '01' ? 'poli umum' : enc.department_code === '02' ? 'poli gigi' : enc.department_code === '03' ? 'poli anak' : (enc.department_code || '').toLowerCase()).includes(summaryFilter.toLowerCase())
                    )
                    .map((enc, idx) => (
                    <div key={idx} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all group relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-slate-800 text-sm">
                          {enc.patient_name && enc.patient_name !== '-' ? enc.patient_name : (enc.mrn ? `Pasien (${enc.mrn})` : 'Pasien')}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(enc.registered_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-slate-500">MRN: <span className="font-medium text-slate-700">{enc.mrn}</span></div>
                        <div className="text-[11px] text-slate-500 text-right">{enc.gender || '-'} • {enc.date_of_birth || '-'}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-auto">
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {enc.department_code === '01' ? 'Poli Umum' : enc.department_code === '02' ? 'Poli Gigi' : enc.department_code === '03' ? 'Poli Anak' : enc.department_code}
                        </span>
                        <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-md border", enc.status_pasien === 'Baru RS' ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-slate-50 text-slate-600 border-slate-200")}>
                          {enc.status_pasien || "Lama"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 py-14 text-slate-400">
                    <Activity className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Belum ada pendaftaran</p>
                  </div>
                )}
              </div>
            </CardContent>
            <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/40 rounded-b-2xl shrink-0">
              <Button variant="outline" className="w-full font-semibold text-sky-600 border-sky-200 hover:bg-sky-50 rounded-xl" onClick={() => navigate('/admisi/kunjungan')}>
                Lihat Semua Kunjungan
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Register Visit Modal */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl md:max-w-3xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl w-[95vw]">
          <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 px-6 py-8 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsRegisterModalOpen(false)} 
              className="absolute top-4 right-4 text-white hover:bg-white/20 hover:text-white rounded-full z-10 transition-colors"
            >
              <X className="h-5 w-5" />
            </Button>

            <DialogTitle className="text-2xl font-bold">Pendaftaran Kunjungan</DialogTitle>
            <DialogDescription className="text-sky-100 mt-2 text-base">
              Atur tujuan poliklinik dan penjamin untuk pasien <strong className="text-white">{selectedPatient?.name}</strong>.
            </DialogDescription>
          </div>
          <div className="p-6 space-y-8 bg-slate-50/50">
            {/* Poli Selection & Assigned Medical Personnel */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tujuan Poliklinik</h3>
                {isFetchingMaster && <span className="text-xs text-sky-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Memuat data...</span>}
              </div>

              {/* Poli Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-700 font-medium text-sm">Poli Tujuan</Label>
                  <span className="text-[10px] text-sky-700 font-bold bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">Pilih Poli</span>
                </div>
                <select 
                  value={selectedPoli} 
                  onChange={(e) => handlePoliChange(e.target.value)}
                  disabled={isFetchingMaster}
                  className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-slate-800 font-medium outline-none focus:ring-2 focus:ring-sky-600 shadow-2xs transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="">-- Pilih Poliklinik Tujuan --</option>
                  {polyclinicOptions.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.name} {p.isPiket ? "✓ (Dokter Piket Aktif)" : p.isOpenToday ? "✓ (Dokter Jaga Aktif)" : `✕ (Tutup / Tidak Ada Jadwal Hari ${currentDayName})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Direct Personnel Display */}
              {selectedPoli ? (
                <div className="space-y-3 pt-1">
                  {!assignedDoctor && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/90 flex items-start gap-3 shadow-2xs text-amber-900">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">
                          Tidak Ada Jadwal Dokter Hari Ini ({currentDayName})
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                          Poliklinik ini tidak memiliki jadwal praktek dokter pada hari {currentDayName}. Pendaftaran kunjungan pasien ke poliklinik ini tidak dapat diproses hari ini.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Dokter Pemeriksa Card */}
                    {assignedDoctor ? (
                      <div className="p-4 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/80 to-indigo-50/30 flex items-start gap-3 shadow-2xs">
                        <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-600/20 shrink-0">
                          <Stethoscope className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wide">Dokter Pemeriksa</span>
                            {assignedDoctor.isPiket ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                                <ShieldCheck className="w-3 h-3 text-amber-700" />
                                Dokter Piket Weekend
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                Bertugas Hari Ini
                              </span>
                            )}
                          </div>
                          <p className="text-base font-bold text-slate-900 truncate mt-0.5">
                            {assignedDoctor.username || assignedDoctor.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            Spesialisasi: <span className="font-medium text-slate-700">{assignedDoctor.spesialisasi || "Umum"}</span>
                            {assignedDoctor.shift_start && assignedDoctor.shift_end && (
                              <span className="ml-1 text-slate-400 font-mono">({assignedDoctor.shift_start.slice(0, 5)} - {assignedDoctor.shift_end.slice(0, 5)})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 flex items-start gap-3 shadow-2xs">
                        <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-sm shrink-0">
                          <Stethoscope className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">Dokter Pemeriksa</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                              Libur / Tutup
                            </span>
                          </div>
                          <p className="text-sm font-bold text-rose-950 mt-0.5">
                            Tidak Ada Dokter Bertugas
                          </p>
                          <p className="text-xs text-rose-700 mt-0.5">
                            Jadwal praktek kosong pada hari {currentDayName}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Perawat Pendamping Card */}
                    {assignedNurse ? (
                      <div className="p-4 rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-emerald-50/30 flex items-start gap-3 shadow-2xs">
                        <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/20 shrink-0">
                          <UserCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wide">Perawat Pendamping</span>
                            {assignedNurse.isPiket ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                                Perawat Piket Weekend
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                Bertugas Hari Ini
                              </span>
                            )}
                          </div>
                          <p className="text-base font-bold text-slate-900 truncate mt-0.5">
                            {assignedNurse.username || assignedNurse.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            STR: <span className="font-medium text-slate-700">{assignedNurse.str_perawat || "Aktif"}</span>
                            {assignedNurse.shift_start && assignedNurse.shift_end && (
                              <span className="ml-1 text-slate-400 font-mono">({assignedNurse.shift_start.slice(0, 5)} - {assignedNurse.shift_end.slice(0, 5)})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-100/70 flex items-start gap-3 shadow-2xs opacity-80">
                        <div className="p-2.5 rounded-xl bg-slate-400 text-white shrink-0">
                          <UserCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Perawat Pendamping</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                              Tidak Ada Jadwal
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 mt-0.5">
                            Tidak Ada Perawat Bertugas
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Hari dinas kosong pada hari {currentDayName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex items-center gap-3 text-slate-500 text-sm">
                  <Activity className="h-5 w-5 text-slate-400 shrink-0" />
                  <span>Pilih poliklinik tujuan di atas untuk melihat dokter dan perawat yang bertugas.</span>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Penjamin / Pembayaran</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {["Umum / Mandiri", "BPJS Kesehatan", "Asuransi Lainnya"].map((method) => (
                  <div 
                    key={method} onClick={() => setPayment(method)}
                    className={cn(
                      "rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all border-2 shadow-2xs",
                      selectedPayment === method 
                        ? "border-sky-600 bg-sky-50/60 shadow-sky-100 scale-[1.02]" 
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 hover:scale-[1.01]"
                    )}
                  >
                     <CreditCard className={cn("h-7 w-7 mb-3 transition-colors", selectedPayment === method ? "text-sky-600" : "text-slate-400")} />
                     <span className={cn("font-bold text-center text-sm transition-colors", selectedPayment === method ? "text-sky-700" : "text-slate-600")}>
                       {method}
                     </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 bg-white border-t border-slate-100 flex justify-end items-center gap-3 rounded-b-2xl">
            <Button variant="outline" onClick={() => setIsRegisterModalOpen(false)} className="rounded-xl px-6 font-semibold border-slate-200 text-slate-700 hover:bg-slate-50">
              Batal
            </Button>
            <Button onClick={handleRegister} disabled={!selectedPoli || !assignedDoctor || isSubmitting} className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-8 font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              Konfirmasi Pendaftaran
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Patient Modal Overlay */}
      {isNewPatientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="bg-white border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <CardTitle className="text-xl text-slate-800">Daftar Pasien Baru</CardTitle>
                <CardDescription>Scan KTP atau masukkan biodata lengkap pasien</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={closeNewPatientModal} className="rounded-full h-8 w-8 p-0">
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <form onSubmit={handleCreatePatient} className="flex flex-col">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Side: Photo & OCR */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Scan KTP Section */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-800">Scan KTP (Auto-Fill)</Label>
                    <div 
                      className={`border-2 ${ktpPhotoPreview ? 'border-solid border-slate-200 bg-black' : 'border-dashed border-slate-300 bg-slate-50'} rounded-xl flex flex-col items-center justify-center text-center relative overflow-hidden h-56 group transition-all cursor-pointer`}
                      onClick={() => !ktpPhotoPreview && fileInputRef.current?.click()}
                    >
                      {ktpPhotoPreview ? (
                        <>
                          <img src={ktpPhotoPreview} alt="KTP Preview" className="absolute inset-0 w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm z-20">
                            <Button type="button" size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>Ambil Ulang</Button>
                            <Button type="button" size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setKtpPhotoPreview(null); }}>Hapus</Button>
                          </div>
                          {isOcrProcessing && (
                            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-30 backdrop-blur-sm">
                              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-3" />
                              <span className="text-sm font-bold text-slate-800">Membaca KTP...</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 w-full h-full">
                          <UploadCloud className="h-8 w-8 text-blue-600 mb-2" />
                          <p className="text-base font-semibold">Upload KTP</p>
                        </div>
                      )}
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleKtpUpload} />
                    </div>
                  </div>

                  {/* Pasien Photo Section */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-800">Foto Pasien</Label>
                    <div 
                      className={`border-2 ${patientPhotoPreview ? 'border-solid border-slate-200 bg-black' : 'border-dashed border-slate-300 bg-slate-50'} rounded-xl flex flex-col items-center justify-center text-center relative overflow-hidden h-56 group transition-all cursor-pointer`}
                      onClick={() => !patientPhotoPreview && photoInputRef.current?.click()}
                    >
                      {patientPhotoPreview ? (
                        <>
                          <img src={patientPhotoPreview} alt="Pasien Preview" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 z-20">
                            <Button type="button" size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); setPatientPhotoPreview(null); }}>Hapus</Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 w-full h-full">
                          <Camera className="h-8 w-8 text-slate-600 mb-2" />
                          <p className="text-base font-semibold">Ambil Foto</p>
                        </div>
                      )}
                      <input type="file" ref={photoInputRef} className="hidden" accept="image/*" capture="user" onChange={handlePhotoUpload} />
                    </div>
                  </div>
                </div>

                {/* Right Side: Form */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="space-y-2">
                    <Label>NIK</Label>
                    <Input required value={newPatientForm.nik} onChange={e => setNewPatientForm({...newPatientForm, nik: e.target.value})} placeholder="16 Digit NIK" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nama Lengkap</Label>
                    <Input required value={newPatientForm.name} onChange={e => setNewPatientForm({...newPatientForm, name: e.target.value})} placeholder="Nama sesuai KTP" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Lahir</Label>
                    <Input required type="date" value={newPatientForm.date_of_birth} onChange={e => setNewPatientForm({...newPatientForm, date_of_birth: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Jenis Kelamin</Label>
                    <select required className="w-full h-10 border border-slate-200 rounded-md px-3 bg-white" value={newPatientForm.gender} onChange={e => setNewPatientForm({...newPatientForm, gender: e.target.value})}>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                    <div className="space-y-2">
                      <Label>Alamat</Label>
                      <Input required value={newPatientForm.address} onChange={e => setNewPatientForm({...newPatientForm, address: e.target.value})} placeholder="Alamat domisili" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={newPatientForm.email} onChange={e => setNewPatientForm({...newPatientForm, email: e.target.value})} placeholder="Alamat email aktif" />
                    </div>
                    <div className="space-y-2">
                      <Label>No. Telepon / HP</Label>
                      <Input required value={newPatientForm.phone} onChange={e => setNewPatientForm({...newPatientForm, phone: e.target.value})} placeholder="08123456789" />
                    </div>
                </div>
              </div>
            </CardContent>
              <div className="p-5 bg-white border-t border-slate-100 flex justify-end items-center gap-3 sticky bottom-0 z-10 rounded-b-xl">
                <Button type="button" variant="ghost" onClick={closeNewPatientModal} className="font-semibold text-slate-600 hover:bg-slate-100 rounded-xl px-6">Batal</Button>
                <Button type="submit" disabled={isCreatingPatient} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-8 shadow-sm shadow-blue-200 transition-all min-w-[140px]">
                  {isCreatingPatient ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Lanjut ke Pendaftaran
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
