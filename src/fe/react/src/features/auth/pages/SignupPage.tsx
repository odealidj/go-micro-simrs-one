import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ScanLine } from "lucide-react";
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
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4 sm:hidden">
          <Activity className="mr-2 h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Codina SIMRS</span>
        </div>
        <CardTitle className="text-2xl text-center">Registrasi Pasien</CardTitle>
        <CardDescription className="text-center">
          Buat akun untuk memudahkan layanan antrean dan rekam medis Anda
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="nik" className={cn(errors.nik && "text-destructive")}>
                NIK KTP <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="nik"
                  placeholder="317..."
                  className={cn(errors.nik && "border-destructive")}
                  {...register("nik")}
                />
                <Button type="button" variant="outline" size="icon" title="Scan KTP">
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
              {errors.nik && <p className="text-sm text-destructive">{errors.nik.message}</p>}
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="bpjs" className={cn(errors.bpjs && "text-destructive")}>
                Nomor BPJS (Opsional)
              </Label>
              <Input
                id="bpjs"
                placeholder="000..."
                className={cn(errors.bpjs && "border-destructive")}
                {...register("bpjs")}
              />
              {errors.bpjs && <p className="text-sm text-destructive">{errors.bpjs.message}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name" className={cn(errors.name && "text-destructive")}>
              Nama Lengkap Sesuai KTP <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              className={cn(errors.name && "border-destructive")}
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="dob" className={cn(errors.dob && "text-destructive")}>
                Tanggal Lahir <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dob"
                type="date"
                className={cn(errors.dob && "border-destructive")}
                {...register("dob")}
              />
              {errors.dob && <p className="text-sm text-destructive">{errors.dob.message}</p>}
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="phone" className={cn(errors.phone && "text-destructive")}>
                Nomor HP/WA <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="08..."
                className={cn(errors.phone && "border-destructive")}
                {...register("phone")}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className={cn(errors.password && "text-destructive")}>
              Password <span className="text-red-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              className={cn(errors.password && "border-destructive")}
              {...register("password")}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <Button type="submit" className="w-full mt-2" disabled={isLoading}>
            {isLoading ? "Memproses..." : "Daftar Akun"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 border-t px-6 py-4">
        <div className="text-center text-sm text-muted-foreground w-full">
          Sudah memiliki akun?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Masuk di sini
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
