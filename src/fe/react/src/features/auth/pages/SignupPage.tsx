import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, IdCard, Phone, Mail, User, ScanLine, Loader2 } from "lucide-react";
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
        toast.success("KTP berhasil dipindai", {
          description: "Beberapa data telah diisi otomatis.",
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
    <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden max-w-2xl w-full mx-auto relative">
      <CardHeader className="space-y-4 pt-10 pb-6 relative">
        <div className="absolute right-6 top-6">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleScanKTP} 
          />
          <Button 
            type="button" 
            variant="outline" 
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
          >
            {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScanLine className="w-4 h-4 mr-2" />}
            Scan KTP (Auto-fill)
          </Button>
        </div>
        <CardTitle className="text-3xl text-center font-bold text-blue-700 tracking-tight leading-tight uppercase mt-4">
          PENDAFTARAN<br/>AKUN STAF
        </CardTitle>
        <CardDescription className="text-center text-slate-700 font-medium px-4">
          Buat akun untuk staf rumah sakit.<br/>Akun Anda membutuhkan persetujuan Admin setelah mendaftar.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-10 pb-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="username" className="text-slate-700 font-medium text-sm">
                Username <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  placeholder="Buat Username"
                  className={cn("pl-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.username && "border-red-500 focus-visible:ring-red-500")}
                  {...register("username")}
                />
              </div>
              {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
            </div>
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
          </div>
          
          <div className="grid grid-cols-2 gap-4">
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
            
            <div className="space-y-1 col-span-2 sm:col-span-1">
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
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-slate-700 font-medium text-sm">
              Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn("h-10 pr-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.password && "border-red-500 focus-visible:ring-red-500")}
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
