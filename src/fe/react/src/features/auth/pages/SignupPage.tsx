import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanLine, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  nik: z.string().length(16, "NIK harus 16 digit angka").regex(/^\d+$/, "NIK hanya boleh berisi angka"),
  bpjs: z.string().optional().refine(val => !val || val.length >= 13, "Nomor BPJS minimal 13 digit (jika diisi)"),
  name: z.string().min(3, "Nama minimal 3 karakter"),
  dob: z.string().min(1, "Tanggal lahir harus diisi"),
  phone: z.string().min(10, "Nomor HP minimal 10 digit").regex(/^\d+$/, "Nomor HP hanya boleh berisi angka"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      nik: "",
      bpjs: "",
      name: "",
      dob: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    console.log("Signup data:", data);
    // Simulate signup
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  return (
    <Card className="border border-white/50 bg-white/40 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden max-w-lg w-full mx-auto">
      <CardHeader className="space-y-4 pt-8 pb-4">
        <CardTitle className="text-3xl text-center font-bold text-blue-700 tracking-tight leading-tight uppercase">
          PENDAFTARAN<br/>RAWAT JALAN
        </CardTitle>
        <CardDescription className="text-center text-slate-700 font-medium px-4">
          Buat akun untuk memudahkan layanan antrean<br/>dan rekam medis rawat jalan Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="nik" className="text-slate-800 font-medium text-sm">
                NIK KTP <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="nik"
                  placeholder="317..."
                  className={cn("bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl placeholder:text-slate-500", errors.nik && "border-red-500 focus-visible:ring-red-500")}
                  {...register("nik")}
                />
                <Button type="button" variant="outline" size="icon" title="Scan KTP" className="bg-white/60 border-white/60 rounded-xl hover:bg-white/80">
                  <ScanLine className="h-4 w-4 text-blue-700" />
                </Button>
              </div>
              {errors.nik && <p className="text-xs text-red-600">{errors.nik.message}</p>}
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="bpjs" className="text-slate-800 font-medium text-sm">
                Nomor BPJS (Opsional)
              </Label>
              <Input
                id="bpjs"
                placeholder="000..."
                className={cn("bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl placeholder:text-slate-500", errors.bpjs && "border-red-500 focus-visible:ring-red-500")}
                {...register("bpjs")}
              />
              {errors.bpjs && <p className="text-xs text-red-600">{errors.bpjs.message}</p>}
            </div>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="name" className="text-slate-800 font-medium text-sm">
              Nama Lengkap <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Nama sesuai KTP"
              className={cn("bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl placeholder:text-slate-500", errors.name && "border-red-500 focus-visible:ring-red-500")}
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="dob" className="text-slate-800 font-medium text-sm">
                Tanggal Lahir <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dob"
                type="date"
                className={cn("bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl text-slate-700", errors.dob && "border-red-500 focus-visible:ring-red-500")}
                {...register("dob")}
              />
              {errors.dob && <p className="text-xs text-red-600">{errors.dob.message}</p>}
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="phone" className="text-slate-800 font-medium text-sm">
                Nomor HP/WA <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="08..."
                className={cn("bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl placeholder:text-slate-500", errors.phone && "border-red-500 focus-visible:ring-red-500")}
                {...register("phone")}
              />
              {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-slate-800 font-medium text-sm">
              Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn("pr-10 bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl placeholder:text-slate-500 tracking-widest", errors.password && "border-red-500 focus-visible:ring-red-500")}
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

          <Button type="submit" className="w-full mt-6 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg" disabled={isLoading}>
            {isLoading ? "Memproses..." : "DAFTAR AKUN"}
          </Button>
          
          <div className="text-center text-sm text-slate-700 mt-4 font-medium">
            Sudah memiliki akun?{" "}
            <Link to="/login" className="text-blue-700 hover:underline font-bold">
              Masuk di sini
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
