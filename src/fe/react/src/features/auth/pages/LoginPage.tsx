import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email atau NIK harus diisi"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

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
    console.log("Login data:", data);
    // Simulate login
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
        <CardTitle className="text-2xl text-center">Login</CardTitle>
        <CardDescription className="text-center">
          Masukkan NIK atau Email Anda untuk masuk ke sistem
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier" className={cn(errors.identifier && "text-destructive")}>
              Email atau NIK
            </Label>
            <Input
              id="identifier"
              type="text"
              placeholder="m@example.com atau 317..."
              className={cn(errors.identifier && "border-destructive")}
              {...register("identifier")}
            />
            {errors.identifier && (
              <p className="text-sm text-destructive">{errors.identifier.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className={cn(errors.password && "text-destructive")}>
                Password
              </Label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Lupa password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              className={cn(errors.password && "border-destructive")}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 border-t px-6 py-4">
        <div className="text-center text-sm text-muted-foreground w-full">
          Belum punya akun?{" "}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Daftar sebagai Pasien
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
