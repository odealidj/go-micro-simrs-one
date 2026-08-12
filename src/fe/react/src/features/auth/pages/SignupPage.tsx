import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ScanLine } from "lucide-react";

export function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
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
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="nik">NIK KTP <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Input id="nik" placeholder="317..." required />
                <Button type="button" variant="outline" size="icon" title="Scan KTP">
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="bpjs">Nomor BPJS (Opsional)</Label>
              <Input id="bpjs" placeholder="000..." />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Nama Lengkap Sesuai KTP <span className="text-red-500">*</span></Label>
            <Input id="name" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="dob">Tanggal Lahir <span className="text-red-500">*</span></Label>
              <Input id="dob" type="date" required />
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="phone">Nomor HP/WA <span className="text-red-500">*</span></Label>
              <Input id="phone" type="tel" placeholder="08..." required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
            <Input id="password" type="password" required />
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
