import { useState } from "react";
import { Search, Stethoscope, CreditCard, UserCircle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NewRegistrationPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // New Patient State
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    nik: "",
    name: "",
    date_of_birth: "",
    gender: "Laki-laki",
    address: "",
    phone: ""
  });
  
  // Mock State
  const [patientData, setPatientData] = useState<{mrn: string, name: string, dob: string, gender: string, address: string} | null>(null);
  const [selectedPoli, setPoli] = useState("");
  const [selectedDoctor, setDoctor] = useState("");
  const [selectedPayment, setPayment] = useState("Umum / Mandiri");

  const handleSearchPatient = async () => {
    if (searchQuery.length < 3) return;
    
    setIsSearching(true);
    // Real API Call to Backend
    try {
      const response = await fetch(`http://localhost:8080/patient/${searchQuery}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // "Authorization": "Bearer <your_token_here>" // uncomment and add token when auth is ready
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success && data.data) {
        setPatientData({
          mrn: data.data.mrn || searchQuery,
          name: data.data.name || "Data Pasien (API)",
          dob: data.data.date_of_birth || "1980-01-01",
          gender: data.data.gender || "Laki-laki",
          address: data.data.address || "Alamat dari API",
        });
      } else {
        // Fallback to mock data if API fails or patient not found, just for UI demonstration
        console.warn("API failed or patient not found, using fallback UI data");
        setPatientData({
          mrn: "RM-" + Math.floor(Math.random() * 100000),
          name: "Budi Santoso (Fallback)",
          dob: "1985-05-12",
          gender: "Laki-laki",
          address: "Jl. Sudirman No. 123, Jakarta",
        });
      }
    } catch (error) {
      console.error("Failed to fetch patient:", error);
      // Fallback
      setPatientData({
        mrn: "RM-" + Math.floor(Math.random() * 100000),
        name: "Budi Santoso (Fallback)",
        dob: "1985-05-12",
        gender: "Laki-laki",
        address: "Jl. Sudirman No. 123, Jakarta",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPatient(true);
    try {
      const response = await fetch(`http://localhost:8080/patient/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // "Authorization": "Bearer <your_token_here>"
        },
        body: JSON.stringify(newPatientForm)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        alert("Pasien baru berhasil didaftarkan!");
        // Set the new patient data as selected
        setPatientData({
          mrn: data.data?.mrn || "RM-NEW-" + Math.floor(Math.random() * 10000),
          name: newPatientForm.name,
          dob: newPatientForm.date_of_birth,
          gender: newPatientForm.gender,
          address: newPatientForm.address,
        });
        setIsNewPatientModalOpen(false);
      } else {
        // Fallback for UI presentation
        console.warn("API failed to register patient, using fallback UI data");
        setPatientData({
          mrn: "RM-NEW-" + Math.floor(Math.random() * 10000),
          name: newPatientForm.name,
          dob: newPatientForm.date_of_birth,
          gender: newPatientForm.gender,
          address: newPatientForm.address,
        });
        setIsNewPatientModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to create patient:", error);
      // Fallback
      setPatientData({
        mrn: "RM-NEW-" + Math.floor(Math.random() * 10000),
        name: newPatientForm.name,
        dob: newPatientForm.date_of_birth,
        gender: newPatientForm.gender,
        address: newPatientForm.address,
      });
      setIsNewPatientModalOpen(false);
    } finally {
      setIsCreatingPatient(false);
    }
  };

  const handleRegister = async () => {
    // Real API call to Backend
    try {
      const response = await fetch(`http://localhost:8080/registrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // "Authorization": "Bearer <your_token_here>"
        },
        body: JSON.stringify({
          mrn: patientData?.mrn,
          department_code: selectedPoli,
          doctor_id: selectedDoctor,
          // payment_method: selectedPayment // Add if backend supports it
        })
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        alert("Pendaftaran berhasil disimpan ke Backend!");
        console.log("Success:", data);
      } else {
        alert("Gagal mendaftar: " + (data.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to register:", error);
      alert("Gagal terhubung ke Backend (Pastikan API Gateway berjalan di port 8080)");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Admisi Pasien Baru</h2>
        <p className="text-slate-500 mt-1">Pendaftaran rawat jalan untuk pasien.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Form Steps */}
        <div className="flex-1 space-y-6">
          
          {/* Step 1: Patient Selection/Search */}
          <Card className={cn(
            "bg-white border-slate-200 shadow-sm transition-all duration-300",
            activeStep !== 1 && "opacity-50"
          )}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold", activeStep === 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>1</div>
              <div>
                <CardTitle className="text-xl text-slate-800">Data Pasien</CardTitle>
                <CardDescription className="text-slate-500">Cari pasien lama atau daftarkan pasien baru</CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn("space-y-4", activeStep !== 1 && "hidden")}>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik 'Budi' untuk demo cari pasien..." 
                    className="pl-11 h-12 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-600 rounded-xl"
                  />
                </div>
                <Button onClick={handleSearchPatient} disabled={isSearching} className="h-12 px-6 rounded-xl bg-slate-800 hover:bg-slate-900">
                  {isSearching ? "Mencari..." : "Cari"}
                </Button>
              </div>

              {patientData && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-4">
                  <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900">{patientData.name}</p>
                    <p className="text-sm text-emerald-700">No. RM: {patientData.mrn}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <Button 
                  onClick={() => setIsNewPatientModalOpen(true)}
                  variant="outline" 
                  className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Pasien Baru
                </Button>
                <Button 
                  onClick={() => setActiveStep(2)} 
                  disabled={!patientData}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8"
                >
                  Lanjut
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Clinic & Doctor Selection */}
          <Card className={cn(
            "bg-white border-slate-200 shadow-sm transition-all duration-300",
            activeStep !== 2 && "opacity-50"
          )}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold", activeStep === 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>2</div>
              <div>
                <CardTitle className="text-xl text-slate-800">Poli & Dokter</CardTitle>
                <CardDescription className="text-slate-500">Pilih tujuan poliklinik dan dokter pemeriksa</CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn("space-y-4", activeStep !== 2 && "hidden")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Pilih Poli</Label>
                  <select 
                    value={selectedPoli}
                    onChange={(e) => setPoli(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-700 outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">-- Pilih Poli --</option>
                    <option value="Poli Umum">Poli Umum</option>
                    <option value="Poli Gigi">Poli Gigi</option>
                    <option value="Poli Anak">Poli Anak</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium text-sm">Pilih Dokter</Label>
                  <select 
                    value={selectedDoctor}
                    onChange={(e) => setDoctor(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-700 outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">-- Pilih Dokter --</option>
                    <option value="Dr. Ali Ube">Dr. Ali Ube</option>
                    <option value="Dr. Sarah Dewi">Dr. Sarah Dewi</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={() => setActiveStep(1)} className="text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                  Kembali
                </Button>
                <Button 
                  onClick={() => setActiveStep(3)} 
                  disabled={!selectedPoli || !selectedDoctor}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8"
                >
                  Lanjut
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Payment Method */}
          <Card className={cn(
            "bg-white border-slate-200 shadow-sm transition-all duration-300",
            activeStep !== 3 && "opacity-50"
          )}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold", activeStep === 3 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>3</div>
              <div>
                <CardTitle className="text-xl text-slate-800">Metode Pembayaran</CardTitle>
                <CardDescription className="text-slate-500">Tentukan penjamin atau jenis pembayaran</CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn("space-y-4", activeStep !== 3 && "hidden")}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {["Umum / Mandiri", "BPJS Kesehatan", "Asuransi Lainnya"].map((method) => (
                  <div 
                    key={method}
                    onClick={() => setPayment(method)}
                    className={cn(
                      "rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors border-2",
                      selectedPayment === method 
                        ? "border-blue-600 bg-blue-50" 
                        : "border-transparent bg-slate-50 hover:bg-slate-100"
                    )}
                  >
                     <CreditCard className={cn("h-8 w-8 mb-2", selectedPayment === method ? "text-blue-600" : "text-slate-400")} />
                     <span className={cn("font-medium text-center", selectedPayment === method ? "text-blue-700" : "text-slate-600")}>
                       {method}
                     </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={() => setActiveStep(2)} className="text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                  Kembali
                </Button>
                <Button onClick={handleRegister} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 font-bold">
                  Simpan Pendaftaran
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Registration Summary Preview */}
        <div className="w-full lg:w-80">
          <Card className="bg-white border-slate-200 shadow-sm sticky top-24">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg text-slate-800">Ringkasan Pendaftaran</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pasien</p>
                {patientData ? (
                   <div className="mt-1">
                     <p className="text-slate-800 font-medium">{patientData.name}</p>
                     <p className="text-slate-500 text-sm">{patientData.mrn}</p>
                   </div>
                ) : (
                  <p className="text-slate-800 font-medium mt-1">Belum dipilih</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Poli & Dokter</p>
                {selectedPoli && selectedDoctor ? (
                   <div className="mt-1">
                     <p className="text-slate-800 font-medium">{selectedPoli}</p>
                     <p className="text-slate-500 text-sm flex items-center gap-1 mt-1">
                        <Stethoscope className="h-3 w-3" />
                        {selectedDoctor}
                     </p>
                   </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <Stethoscope className="h-4 w-4 text-blue-600" />
                    <p className="text-slate-800 font-medium">Belum dipilih</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pembayaran</p>
                <p className="text-slate-800 font-medium mt-1">{selectedPayment}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Patient Modal Overlay */}
      {isNewPatientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="bg-white border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-xl text-slate-800">Daftar Pasien Baru</CardTitle>
              <CardDescription>Masukkan biodata lengkap pasien</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreatePatient} className="space-y-4">
                <div className="space-y-2">
                  <Label>NIK</Label>
                  <Input 
                    required 
                    value={newPatientForm.nik} 
                    onChange={e => setNewPatientForm({...newPatientForm, nik: e.target.value})} 
                    placeholder="16 Digit NIK" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nama Lengkap</Label>
                  <Input 
                    required 
                    value={newPatientForm.name} 
                    onChange={e => setNewPatientForm({...newPatientForm, name: e.target.value})} 
                    placeholder="Nama sesuai KTP" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal Lahir</Label>
                    <Input 
                      required 
                      type="date" 
                      value={newPatientForm.date_of_birth} 
                      onChange={e => setNewPatientForm({...newPatientForm, date_of_birth: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jenis Kelamin</Label>
                    <select 
                      required 
                      className="w-full h-10 border border-slate-200 rounded-md px-3 bg-white"
                      value={newPatientForm.gender}
                      onChange={e => setNewPatientForm({...newPatientForm, gender: e.target.value})}
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Alamat</Label>
                  <Input 
                    required 
                    value={newPatientForm.address} 
                    onChange={e => setNewPatientForm({...newPatientForm, address: e.target.value})} 
                    placeholder="Alamat domisili" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>No. Telepon / HP</Label>
                  <Input 
                    required 
                    value={newPatientForm.phone} 
                    onChange={e => setNewPatientForm({...newPatientForm, phone: e.target.value})} 
                    placeholder="08123456789" 
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                  <Button type="button" variant="ghost" onClick={() => setIsNewPatientModalOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={isCreatingPatient} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isCreatingPatient ? "Menyimpan..." : "Simpan Pasien"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
