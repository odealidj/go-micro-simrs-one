import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Search, Stethoscope, CreditCard, UserCircle, Camera, UploadCloud, X, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface Patient {
  mrn: string;
  name: string;
  date_of_birth: string;
  gender: string;
  address: string;
}

export function NewRegistrationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;
  
  // Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedPoli, setPoli] = useState("");
  const [selectedDoctor, setDoctor] = useState("");
  const [selectedPayment, setPayment] = useState("Umum / Mandiri");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat memproses KTP");
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
        response = await api.post(`/registrations/new-patient-encounter`, {
          name: newPatientForm.name,
          nik: newPatientForm.nik,
          dob: newPatientForm.date_of_birth,
          gender: newPatientForm.gender,
          birth_place: "",
          address: newPatientForm.address,
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
        fetchPatients(searchQuery, currentPage);
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Pendaftaran Pasien</h2>
          <p className="text-slate-500 mt-1">Kelola data pasien dan pendaftaran rawat jalan.</p>
        </div>
        <Button onClick={() => setIsNewPatientModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          <UserCircle className="mr-2 h-5 w-5" />
          Pasien Baru
        </Button>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <form onSubmit={handleSearchPatient} className="relative flex gap-2">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan No. RM, Nama, atau NIK..." 
                className="pl-11 pr-12 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-600 rounded-xl"
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
            <Button type="submit" disabled={isSearching} className="h-12 px-8 rounded-xl bg-slate-800 hover:bg-slate-900 shadow-sm">
              {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Cari Pasien"}
            </Button>
          </form>
        </CardHeader>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100 uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">No. RM</th>
                <th className="px-6 py-4">Nama Pasien</th>
                <th className="px-6 py-4">Tgl Lahir</th>
                <th className="px-6 py-4">Kelamin</th>
                <th className="px-6 py-4">Alamat</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {patientsList.length > 0 ? (
                patientsList.map((patient, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{patient.mrn}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{patient.name}</td>
                    <td className="px-6 py-4 text-slate-600">{patient.date_of_birth}</td>
                    <td className="px-6 py-4 text-slate-600">{patient.gender}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{patient.address}</td>
                    <td className="px-6 py-4 text-right">
                      <Button onClick={() => openRegisterModal(patient)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm">
                        Daftarkan
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {isSearching ? "Mencari pasien..." : "Tidak ada pasien ditemukan."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-sm text-slate-500">
              Halaman <span className="font-semibold text-slate-700">{currentPage}</span> dari <span className="font-semibold text-slate-700">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm" className="h-9 w-9 p-0 rounded-lg"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="sm" className="h-9 w-9 p-0 rounded-lg"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Register Visit Modal */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-8 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <DialogTitle className="text-2xl font-bold">Pendaftaran Kunjungan</DialogTitle>
            <DialogDescription className="text-blue-100 mt-2 text-base">
              Atur tujuan poliklinik dan penjamin untuk pasien <strong className="text-white">{selectedPatient?.name}</strong>.
            </DialogDescription>
          </div>
          <div className="p-6 space-y-8 bg-slate-50/50">
            {/* Poli & Doctor Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Tujuan Poliklinik</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Poli Tujuan</Label>
                  <select 
                    value={selectedPoli} onChange={(e) => setPoli(e.target.value)}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                  >
                    <option value="">-- Pilih Poli --</option>
                    <option value="UMU">Poli Umum</option>
                    <option value="GIG">Poli Gigi</option>
                    <option value="ANA">Poli Anak</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Dokter Pemeriksa</Label>
                  <select 
                    value={selectedDoctor} onChange={(e) => setDoctor(e.target.value)}
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                  >
                    <option value="">-- Pilih Dokter --</option>
                    <option value="Dr. Ali Ube">Dr. Ali Ube</option>
                    <option value="Dr. Sarah Dewi">Dr. Sarah Dewi</option>
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
                        ? "border-blue-600 bg-blue-50/50 shadow-blue-100" 
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                     <CreditCard className={cn("h-7 w-7 mb-3 transition-transform", selectedPayment === method ? "text-blue-600 scale-110" : "text-slate-400")} />
                     <span className={cn("font-semibold text-center text-sm", selectedPayment === method ? "text-blue-700" : "text-slate-600")}>
                       {method}
                     </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
            <Button variant="ghost" onClick={() => setIsRegisterModalOpen(false)} className="rounded-xl px-6 font-medium">
              Batal
            </Button>
            <Button onClick={handleRegister} disabled={!selectedPoli || !selectedDoctor || isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-bold shadow-md shadow-blue-200 transition-all">
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
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                
                {/* Left Side: Photo & OCR */}
                <div className="md:col-span-4 space-y-6">
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
                <div className="md:col-span-8">
                  <form onSubmit={handleCreatePatient} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>NIK</Label>
                        <Input required value={newPatientForm.nik} onChange={e => setNewPatientForm({...newPatientForm, nik: e.target.value})} placeholder="16 Digit NIK" />
                      </div>
                      <div className="space-y-2">
                        <Label>Nama Lengkap</Label>
                        <Input required value={newPatientForm.name} onChange={e => setNewPatientForm({...newPatientForm, name: e.target.value})} placeholder="Nama sesuai KTP" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>
                    <div className="space-y-2">
                      <Label>Alamat</Label>
                      <Input required value={newPatientForm.address} onChange={e => setNewPatientForm({...newPatientForm, address: e.target.value})} placeholder="Alamat domisili" />
                    </div>
                    <div className="space-y-2">
                      <Label>No. Telepon / HP</Label>
                      <Input required value={newPatientForm.phone} onChange={e => setNewPatientForm({...newPatientForm, phone: e.target.value})} placeholder="08123456789" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                      <Button type="button" variant="ghost" onClick={closeNewPatientModal}>Batal</Button>
                      <Button type="submit" disabled={isCreatingPatient} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">Lanjut ke Pendaftaran</Button>
                    </div>
                  </form>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
