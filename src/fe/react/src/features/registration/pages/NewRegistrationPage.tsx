import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Search, CreditCard, UserCircle, Camera, UploadCloud, X, Loader2, Check, Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";

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
  const pageSize = 10;

  // Recent Registrations Sidebar State
  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  const [summaryFilter, setSummaryFilter] = useState("");
  
  // Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedPoli, setPoli] = useState("");
  const [selectedDoctor, setDoctor] = useState("");
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
    fetchPatients(searchQuery, currentPage);
  }, [currentPage]);

  useEffect(() => {
    fetchRecentRegistrations();
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    setIsFetchingMaster(true);
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
      console.error("Failed to fetch master data:", err);
      toast.error("Gagal mengambil data master Poliklinik/Dokter");
    } finally {
      setIsFetchingMaster(false);
    }
  };

  const fetchPatients = async (query: string, page: number = 1) => {
    setIsSearching(true);
    try {
      const response = await api.get(`/patients`, {
        params: { search: query, page, page_size: pageSize }
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
    fetchPatients(searchQuery, 1);
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
          fetchPatients(ocrData.nik, 1);
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
    setPayment("Umum / Mandiri");
    setIsRegisterModalOpen(true);
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
      setIsSubmitting(true);
      let guarantor = "Umum";
      if (selectedPayment === "BPJS Kesehatan") guarantor = "BPJS";
      else if (selectedPayment === "Asuransi Lainnya") guarantor = "Asuransi";

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
          doctor_id: selectedDoctor,
          guarantor: guarantor
        });
      } else {
        response = await api.post(`/registrations`, {
          mrn: selectedPatient?.mrn,
          department_code: selectedPoli,
          doctor_id: selectedDoctor,
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

  const validPolyclinics = masterPoli.filter(poli => {
    const hasDoctor = masterDoctors.some(d => d.poli_code === poli.code);
    const hasNurse = masterNurses.some(n => n.poli_code === poli.code);
    return hasDoctor && hasNurse;
  });

  const availableDoctors = masterDoctors.filter(d => d.poli_code === selectedPoli);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Pendaftaran Pasien</h2>
          <p className="text-slate-500 mt-1">Kelola data pasien dan pendaftaran rawat jalan.</p>
        </div>
        <Button onClick={() => setIsNewPatientModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200">
          <UserCircle className="mr-2 h-5 w-5" />
          Pasien Baru
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column - Patient Directory (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          <Card className="bg-white border-slate-200/60 shadow-md shadow-slate-200/40 overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100/80 p-5">
              <form onSubmit={handleSearchPatient} className="relative flex gap-3">
                <div className="relative flex-1 max-w-2xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan No. RM, Nama, atau NIK..." 
                    className="pl-12 pr-12 h-12 bg-white border-slate-200/80 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-600 focus-visible:border-blue-600 rounded-xl shadow-sm"
                  />
                  <Button 
                    type="button" variant="ghost" size="icon" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-blue-600 rounded-full"
                    onClick={() => searchKtpInputRef.current?.click()} title="Scan KTP"
                  >
                    {isSearchingKtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                  <input 
                    type="file" ref={searchKtpInputRef} className="hidden" 
                    accept="image/*" capture="environment" onChange={handleSearchKtpUpload} 
                  />
                </div>
                <Button type="submit" disabled={isSearching} className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all font-medium">
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cari Pasien"}
                </Button>
              </form>
            </CardHeader>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-slate-500 bg-slate-50/80 border-b border-slate-100 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">No. RM</th>
                    <th className="px-6 py-4">Nama Pasien</th>
                    <th className="px-6 py-4">Tgl Lahir</th>
                    <th className="px-6 py-4">Kelamin</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {patientsList.length > 0 ? (
                    patientsList.map((patient, idx) => {
                      const isRegisteredToday = recentRegistrations.some(enc => enc.mrn === patient.mrn);
                      return (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors group">
                        <td className="px-6 py-5 font-medium text-slate-900">{patient.mrn}</td>
                        <td className={cn("px-6 py-5 font-semibold", isRegisteredToday ? "text-emerald-600" : "text-slate-800")}>
                          {patient.name}
                        </td>
                        <td className="px-6 py-5 text-slate-500">{patient.date_of_birth}</td>
                        <td className="px-6 py-5 text-slate-500">{patient.gender}</td>
                        <td className="px-6 py-5 text-right">
                          {isRegisteredToday ? (
                            <div className="flex items-center justify-end">
                              <Button onClick={() => openRegisterModal(patient)} size="sm" variant="outline" className="h-8 text-xs px-4 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg whitespace-nowrap transition-colors" title="Sudah terdaftar hari ini, klik untuk daftar poli lain">
                                + Poli Lain
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={() => openRegisterModal(patient)} size="sm" className="h-8 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/20 transition-all">
                              Daftarkan
                            </Button>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        {isSearching ? "Mencari pasien..." : "Tidak ada pasien ditemukan."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl">
                <div className="text-sm text-slate-500">
                  Total data: {totalData}
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline" size="sm" className="h-9 px-3 text-slate-600 hover:text-slate-900"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </Button>
                  <span className="text-sm font-medium text-slate-700">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <Button
                    variant="outline" size="sm" className="h-9 px-3 text-slate-600 hover:text-slate-900"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Recent Activity Sidebar (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm sticky top-6">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Pendaftaran Hari Ini
                </CardTitle>
                <div className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                  {recentRegistrations.length} Pasien
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-4 pt-4 pb-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari pasien / poli..."
                    value={summaryFilter}
                    onChange={(e) => setSummaryFilter(e.target.value)}
                    className="pl-9 h-9 text-sm rounded-lg border-slate-200 focus-visible:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-4 space-y-3">
                {recentRegistrations.length > 0 ? (
                  recentRegistrations
                    .filter(enc => 
                      enc.patient_name.toLowerCase().includes(summaryFilter.toLowerCase()) || 
                      enc.mrn.toLowerCase().includes(summaryFilter.toLowerCase()) ||
                      (enc.department_code === '01' ? 'poli umum' : enc.department_code === '02' ? 'poli gigi' : enc.department_code === '03' ? 'poli anak' : enc.department_code.toLowerCase()).includes(summaryFilter.toLowerCase())
                    )
                    .map((enc, idx) => (
                    <div key={idx} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all group relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-slate-800 text-sm">{enc.patient_name}</span>
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
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Activity className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Belum ada pendaftaran</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <Button variant="outline" className="w-full font-medium text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => navigate('/admisi/daftar')}>
                  Lihat Semua Kunjungan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Register Visit Modal */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl md:max-w-3xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl w-[95vw]">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-8 text-white relative overflow-hidden">
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
            <DialogDescription className="text-blue-100 mt-2 text-base">
              Atur tujuan poliklinik dan penjamin untuk pasien <strong className="text-white">{selectedPatient?.name}</strong>.
            </DialogDescription>
          </div>
          <div className="p-6 space-y-8 bg-slate-50/50">
            {/* Poli & Doctor Selection */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Tujuan Poliklinik</h3>
                {isFetchingMaster && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Memuat data...</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-slate-700 font-medium text-sm">Poli Tujuan</Label>
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">Langkah 1</span>
                  </div>
                  <select 
                    value={selectedPoli} onChange={(e) => { setPoli(e.target.value); setDoctor(""); }}
                    disabled={isFetchingMaster}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 shadow-sm transition-shadow disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Pilih Poli --</option>
                    {validPolyclinics.map(p => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className={cn("font-medium text-sm transition-colors", !selectedPoli ? "text-slate-400" : "text-slate-700")}>Dokter Pemeriksa</Label>
                    {!selectedPoli ? (
                      <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Pilih poli terlebih dahulu</span>
                    ) : (
                      <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Langkah 2</span>
                    )}
                  </div>
                  <select 
                    value={selectedDoctor} onChange={(e) => setDoctor(e.target.value)}
                    disabled={!selectedPoli || isFetchingMaster}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 shadow-sm transition-shadow disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Pilih Dokter --</option>
                    {availableDoctors.map(d => (
                      <option key={d.id} value={d.id}>{d.username || d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Penjamin / Pembayaran</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {["Umum / Mandiri", "BPJS Kesehatan", "Asuransi Lainnya"].map((method) => (
                  <div 
                    key={method} onClick={() => setPayment(method)}
                    className={cn(
                      "rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all border-2 shadow-sm",
                      selectedPayment === method 
                        ? "border-blue-600 bg-blue-50/50 shadow-blue-100 scale-[1.02]" 
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:scale-[1.01]"
                    )}
                  >
                     <CreditCard className={cn("h-7 w-7 mb-3 transition-colors", selectedPayment === method ? "text-blue-600" : "text-slate-400")} />
                     <span className={cn("font-semibold text-center text-sm transition-colors", selectedPayment === method ? "text-blue-700" : "text-slate-600")}>
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
            <Button onClick={handleRegister} disabled={!selectedPoli || !selectedDoctor || isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-bold shadow-md shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              Konfirmasi Pendaftaran
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Patient Modal Overlay */}
      {isNewPatientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="bg-white border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
