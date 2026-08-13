import { useState } from "react";
import { Search, Stethoscope, CreditCard, UserCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NewRegistrationPage() {
  const [activeStep, setActiveStep] = useState(1);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Admisi Pasien Baru</h2>
        <p className="text-slate-400 mt-1">Pendaftaran rawat jalan untuk pasien.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Form Steps */}
        <div className="flex-1 space-y-6">
          
          {/* Step 1: Patient Selection/Search */}
          <Card className={cn(
            "bg-black/40 backdrop-blur-md border-white/10 shadow-xl transition-all duration-300",
            activeStep !== 1 && "opacity-60"
          )}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold", activeStep === 1 ? "bg-blue-600 text-white" : "bg-white/10 text-slate-400")}>1</div>
              <div>
                <CardTitle className="text-xl text-white">Data Pasien</CardTitle>
                <CardDescription className="text-slate-400">Cari pasien lama atau daftarkan pasien baru</CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn("space-y-4", activeStep !== 1 && "hidden")}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  placeholder="Cari berdasarkan NIK, No. RM, atau Nama..." 
                  className="pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 rounded-xl"
                />
              </div>
              <div className="flex justify-between items-center pt-4">
                <Button variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Pasien Baru
                </Button>
                <Button onClick={() => setActiveStep(2)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8">
                  Lanjut
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Clinic & Doctor Selection */}
          <Card className={cn(
            "bg-black/40 backdrop-blur-md border-white/10 shadow-xl transition-all duration-300",
            activeStep !== 2 && "opacity-60"
          )}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold", activeStep === 2 ? "bg-blue-600 text-white" : "bg-white/10 text-slate-400")}>2</div>
              <div>
                <CardTitle className="text-xl text-white">Poli & Dokter</CardTitle>
                <CardDescription className="text-slate-400">Pilih tujuan poliklinik dan dokter pemeriksa</CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn("space-y-4", activeStep !== 2 && "hidden")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Pilih Poli</Label>
                  {/* Select placeholder */}
                  <div className="h-12 bg-white/5 border border-white/10 rounded-xl flex items-center px-3 text-slate-400">
                    -- Pilih Poli --
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Pilih Dokter</Label>
                  {/* Select placeholder */}
                  <div className="h-12 bg-white/5 border border-white/10 rounded-xl flex items-center px-3 text-slate-400">
                    -- Pilih Dokter --
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={() => setActiveStep(1)} className="text-slate-300 hover:text-white">
                  Kembali
                </Button>
                <Button onClick={() => setActiveStep(3)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8">
                  Lanjut
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Payment Method */}
          <Card className={cn(
            "bg-black/40 backdrop-blur-md border-white/10 shadow-xl transition-all duration-300",
            activeStep !== 3 && "opacity-60"
          )}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold", activeStep === 3 ? "bg-blue-600 text-white" : "bg-white/10 text-slate-400")}>3</div>
              <div>
                <CardTitle className="text-xl text-white">Metode Pembayaran</CardTitle>
                <CardDescription className="text-slate-400">Tentukan penjamin atau jenis pembayaran</CardDescription>
              </div>
            </CardHeader>
            <CardContent className={cn("space-y-4", activeStep !== 3 && "hidden")}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border-2 border-blue-500 bg-blue-500/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer">
                   <CreditCard className="h-8 w-8 text-blue-400 mb-2" />
                   <span className="text-white font-medium">Umum / Mandiri</span>
                </div>
                <div className="border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors">
                   <CreditCard className="h-8 w-8 text-slate-400 mb-2" />
                   <span className="text-slate-300 font-medium">BPJS Kesehatan</span>
                </div>
                <div className="border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors">
                   <CreditCard className="h-8 w-8 text-slate-400 mb-2" />
                   <span className="text-slate-300 font-medium">Asuransi Lainnya</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={() => setActiveStep(2)} className="text-slate-300 hover:text-white">
                  Kembali
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-8 font-bold">
                  Simpan Pendaftaran
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Registration Summary Preview */}
        <div className="w-full lg:w-80">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl sticky top-6">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-lg text-white">Ringkasan Pendaftaran</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Pasien</p>
                <p className="text-white font-medium mt-1">Belum dipilih</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Poli & Dokter</p>
                <div className="flex items-center gap-2 mt-1">
                  <Stethoscope className="h-4 w-4 text-blue-400" />
                  <p className="text-white font-medium">Belum dipilih</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Pembayaran</p>
                <p className="text-white font-medium mt-1">Umum / Mandiri</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
