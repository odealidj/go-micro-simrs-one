import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Eye, 
  EyeOff, 
  IdCard, 
  Phone, 
  Mail, 
  User, 
  ScanLine, 
  Loader2, 
  Sparkles, 
  Camera, 
  Lock, 
  AtSign, 
  CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const signupSchema = z.object({
  username: z.string().min(1, "Username harus diisi"),
  full_name: z.string().min(1, "Nama Lengkap harus diisi"),
  email: z.string().email("Format email tidak valid"),
  phone: z.string().min(10, "Nomor HP minimal 10 digit").regex(/^\d+$/, "Nomor HP hanya boleh berisi angka"),
  nip: z.string().min(1, "NIK/NIP harus diisi"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  label_profesi_id: z.string().min(1, "Profesi harus dipilih"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

interface LabelProfesi {
  id: number;
  nama_label: string;
  is_active: boolean;
}

export function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isKtpScanned, setIsKtpScanned] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [labels, setLabels] = useState<LabelProfesi[]>([]);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      full_name: "",
      email: "",
      phone: "",
      nip: "",
      password: "",
      label_profesi_id: "",
    },
  });

  const selectedLabelId = watch("label_profesi_id");

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const res = await fetch("/api/v1/master/label-profesi?page_size=100");
        const json = await res.json();
        if (json.success && json.data?.data) {
          setLabels(json.data.data.filter((l: LabelProfesi) => l.is_active));
        }
      } catch (error) {
        console.error("Failed to fetch label profesi", error);
      }
    };
    fetchLabels();
  }, []);

  const handleScanKTP = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append("ktp", file);

    try {
      const response = await fetch("/api/v1/auth/signup/ocr-ktp", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memindai KTP");
      }

      const data = result.data;
      if (data) {
        if (data.name) setValue("full_name", data.name, { shouldValidate: true });
        if (data.nik) {
          setValue("nip", data.nik, { shouldValidate: true });
          if (!watch("username")) {
            setValue("username", data.nik, { shouldValidate: true });
          }
        }
        setIsKtpScanned(true);
        toast.success("KTP berhasil dipindai", {
          description: "NIK dan Nama Lengkap telah diisi otomatis.",
        });
      }
    } catch (error: any) {
      toast.error("Gagal memindai KTP", {
        description: error.message,
      });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/signup/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          email: data.email,
          phone: data.phone,
          nip: data.nip,
          full_name: data.full_name,
          label_profesi_id: Number(data.label_profesi_id),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mendaftar");
      }

      toast.success("Pendaftaran berhasil!", {
        description: "Silakan tunggu konfirmasi Admin sebelum bisa login.",
      });
      navigate("/login");
    } catch (error: any) {
      toast.error("Gagal mendaftar", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden w-full relative">
      <CardHeader className="space-y-2 pt-8 pb-3 text-center">
        <CardTitle className="text-2xl sm:text-3xl font-bold text-blue-700 tracking-tight leading-tight uppercase">
          PENDAFTARAN<br className="sm:hidden" /> AKUN STAF
        </CardTitle>
        <CardDescription className="text-slate-600 font-medium text-xs sm:text-sm px-2">
          Buat akun untuk staf rumah sakit. Akun Anda membutuhkan persetujuan Admin setelah mendaftar.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 sm:px-8 pb-8 space-y-5">
        {/* Hidden File Input for KTP */}
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleScanKTP} 
        />

        {/* Pro Scan KTP AI Card */}
        {isKtpScanned ? (
          <div 
            onClick={() => !isScanning && fileInputRef.current?.click()}
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-slate-50/60 p-3.5 transition-all duration-200 hover:border-emerald-300 hover:shadow-xs cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs shadow-emerald-600/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      e-KTP Berhasil Terbaca
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                      Terverifikasi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data NIK & Nama telah terisi otomatis. Klik untuk pindai ulang.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-100/50 text-xs font-semibold h-8 gap-1.5"
                disabled={isScanning}
              >
                <Camera className="h-3.5 w-3.5" />
                Pindai Ulang
              </Button>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => !isScanning && fileInputRef.current?.click()}
            className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-sky-50/70 p-3.5 transition-all duration-200 hover:border-blue-400 hover:shadow-sm hover:shadow-blue-500/10 cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs shadow-blue-600/20 group-hover:scale-105 transition-transform">
                  {isScanning ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ScanLine className="h-5 w-5" />
                      <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-300 animate-pulse" />
                    </>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                      Pindai e-KTP Otomatis
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
                      <Sparkles className="h-2.5 w-2.5" /> AI OCR
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unggah foto KTP untuk auto-fill NIK & Nama
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8 px-3 shadow-xs gap-1.5 pointer-events-none"
                disabled={isScanning}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memindai...
                  </>
                ) : (
                  <>
                    <Camera className="h-3.5 w-3.5" />
                    Scan KTP
                  </>
                )}
              </Button>
            </div>
            {isScanning && (
              <div className="mt-2.5 pt-2 border-t border-blue-200/60 flex items-center gap-2 text-xs font-medium text-blue-700 animate-pulse">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                Mengekstrak data e-KTP dengan AI OCR...
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* NIK / NIP */}
          <div className="space-y-1">
            <Label htmlFor="nip" className="text-slate-700 font-medium text-sm">
              NIK / NIP <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="nip"
                placeholder="Masukkan NIK atau NIP"
                className={cn("pl-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.nip && "border-red-500 focus-visible:ring-red-500")}
                {...register("nip")}
              />
            </div>
            {errors.nip && <p className="text-xs text-red-600">{errors.nip.message}</p>}
          </div>

          {/* Nama Lengkap */}
          <div className="space-y-1">
            <Label htmlFor="full_name" className="text-slate-700 font-medium text-sm">
              Nama Lengkap (Sesuai KTP) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="full_name"
                placeholder="Masukkan Nama Lengkap"
                className={cn("pl-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.full_name && "border-red-500 focus-visible:ring-red-500")}
                {...register("full_name")}
              />
            </div>
            {errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}
          </div>

          {/* Nomor HP/WA & Alamat Email (Grid 2 Kolom) */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="phone" className="text-slate-700 font-medium text-sm">
                Nomor HP/WA <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="08..."
                  className={cn("pl-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.phone && "border-red-500 focus-visible:ring-red-500")}
                  {...register("phone")}
                />
              </div>
              {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="email" className="text-slate-700 font-medium text-sm">
                Alamat Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  className={cn("pl-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.email && "border-red-500 focus-visible:ring-red-500")}
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
          </div>

          {/* Profesi / Posisi */}
          <div className="space-y-1">
            <Label htmlFor="label_profesi_id" className="text-slate-700 font-medium text-sm">
              Profesi / Posisi <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={selectedLabelId} 
              onValueChange={(val) => setValue("label_profesi_id", val ?? "", { shouldValidate: true })}
            >
              <SelectTrigger className={cn("h-10 border-slate-200 focus:ring-blue-600 rounded-xl", errors.label_profesi_id && "border-red-500 focus:ring-red-500")}>
                <SelectValue placeholder="Pilih Profesi" />
              </SelectTrigger>
              <SelectContent>
                {labels.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.nama_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.label_profesi_id && <p className="text-xs text-red-600">{errors.label_profesi_id.message}</p>}
          </div>

          {/* Divider: Kredensial Akun */}
          <div className="pt-1">
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Kredensial Akun Login
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>
          </div>

          {/* Username (Berada Tepat di Atas Password) */}
          <div className="space-y-1">
            <Label htmlFor="username" className="text-slate-700 font-medium text-sm">
              Username <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="username"
                placeholder="Buat Username akun"
                className={cn("pl-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.username && "border-red-500 focus-visible:ring-red-500")}
                {...register("username")}
              />
            </div>
            {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="password" className="text-slate-700 font-medium text-sm">
              Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn("pl-10 pr-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.password && "border-red-500 focus-visible:ring-red-500")}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <Button type="submit" className="w-full mt-4 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-sm" disabled={isLoading || isScanning}>
            {isLoading ? "Memproses..." : "DAFTAR SEKARANG"}
          </Button>
          
          <div className="text-center text-sm text-slate-600 mt-4">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
              Login di sini
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
