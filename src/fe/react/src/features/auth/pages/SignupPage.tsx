import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, IdCard, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  nip: z.string().min(1, "NIP harus diisi"),
  email: z.string().email("Format email tidak valid"),
  phone: z.string().min(10, "Nomor HP minimal 10 digit").regex(/^\d+$/, "Nomor HP hanya boleh berisi angka"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      nip: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/signup/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: data.nip,
          password: data.password,
          email: data.email,
          phone: data.phone,
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
    <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden max-w-2xl w-full mx-auto">
      <CardHeader className="space-y-4 pt-10 pb-6">
        <CardTitle className="text-3xl text-center font-bold text-blue-700 tracking-tight leading-tight uppercase">
          PENDAFTARAN<br/>AKUN STAF
        </CardTitle>
        <CardDescription className="text-center text-slate-700 font-medium px-4">
          Buat akun untuk staf rumah sakit.<br/>Akun Anda membutuhkan persetujuan Admin setelah mendaftar.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-10 pb-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="nip" className="text-slate-700 font-medium text-sm">
                NIP / ID Pegawai <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="nip"
                  placeholder="Masukkan NIP"
                  className={cn("pl-10 h-10 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400", errors.nip && "border-red-500 focus-visible:ring-red-500")}
                  {...register("nip")}
                />
              </div>
              {errors.nip && <p className="text-xs text-red-600">{errors.nip.message}</p>}
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
          
          <div className="space-y-1">
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

          <Button type="submit" className="w-full mt-4 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-sm" disabled={isLoading}>
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
