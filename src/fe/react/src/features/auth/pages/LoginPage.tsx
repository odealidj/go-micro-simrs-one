import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username / Email harus diisi"),
  password: z.string().min(1, "Password harus diisi"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await api.post("/auth/login", {
        username: data.identifier,
        password: data.password,
      });

      const result = response.data;
      if (result.success) {
        const { access_token, refresh_token, role, user_id, poli_code } = result.data;
        login(access_token, refresh_token, role, user_id, poli_code);
        
        toast.success("Login berhasil!", {
          description: "Selamat datang kembali.",
        });

        // Redirect based on role
        if (role === "admin" || role === "super_admin") {
          navigate("/admin");
        } else if (role === "admisi") {
          navigate("/admisi");
        } else if (role === "dokter") {
          navigate("/rawat-jalan/dokter");
        } else if (role === "perawat") {
          navigate("/rawat-jalan/perawat");
        } else if (role === "kasir") {
          navigate("/kasir");
        } else if (role === "asisten_apoteker") {
          navigate("/apoteker");
        } else if (role === "rekam_medis") {
          navigate("/rekam-medis");
        } else if (role === "pasien" || role === "patient") {
          navigate("/pasien");
        } else {
          navigate("/unauthorized");
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || "Terjadi kesalahan saat login";
      toast.error("Gagal Login", {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden max-w-md w-full mx-auto">
      <CardHeader className="space-y-4 pt-10 pb-6">
        <CardTitle className="text-3xl text-center font-bold text-blue-700 tracking-tight leading-tight uppercase">
          PORTAL<br/>RAWAT JALAN
        </CardTitle>
        <CardDescription className="text-center text-slate-700 font-medium px-4">
          Selamat datang di layanan Rawat Jalan.<br/>Silakan masuk untuk melanjutkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-slate-700 font-medium text-sm">Username / Email <span className="text-red-500">*</span></Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="identifier"
                type="text"
                placeholder="admin_poli / pasien_01"
                className={cn(
                  "pl-10 h-12 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400",
                  errors.identifier && "border-red-500 focus-visible:ring-red-500"
                )}
                {...register("identifier")}
              />
            </div>
            {errors.identifier && (
              <p className="text-sm text-red-600">{errors.identifier.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn(
                  "pl-10 pr-10 h-12 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 rounded-xl placeholder:text-slate-400 tracking-widest",
                  errors.password && "border-red-500 focus-visible:ring-red-500"
                )}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 mb-6">
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="remember" 
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="remember" className="text-sm font-medium leading-none text-slate-600 cursor-pointer">
                Remember me
              </Label>
            </div>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Lupa Password?
            </Link>
          </div>

          <Button type="submit" className="w-full mt-6 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-sm" disabled={isLoading}>
            {isLoading ? "Memproses..." : "SIGN IN"}
          </Button>

          <div className="text-center text-sm text-slate-600 mt-6">
            Belum punya akun pasien?{" "}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
              Daftar di sini
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
