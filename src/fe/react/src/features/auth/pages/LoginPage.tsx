import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email atau NIK harus diisi"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <Card className="border border-white/50 bg-white/40 backdrop-blur-md shadow-2xl rounded-3xl overflow-hidden">
      <CardHeader className="space-y-4 pt-10 pb-6">
        <CardTitle className="text-3xl text-center font-bold text-blue-700 tracking-tight leading-tight uppercase">
          HOSPITAL<br/>INFORMATION<br/>SYSTEM
        </CardTitle>
        <CardDescription className="text-center text-slate-700 font-medium px-4">
          Welcome to Codina SIMRS. Please sign<br/>in to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-slate-800 font-medium">Username</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="h-5 w-5" />
              </div>
              <Input
                id="identifier"
                type="text"
                placeholder="Username"
                className={cn(
                  "pl-10 h-12 bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl placeholder:text-slate-500",
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
            <Label htmlFor="password" className="text-slate-800 font-medium">Password</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-5 w-5" />
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={cn(
                  "pl-10 pr-10 h-12 bg-white/60 border-white/60 focus-visible:ring-blue-500 rounded-xl placeholder:text-slate-500 tracking-widest",
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

          <div className="flex items-center justify-between mt-2 mb-4">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="flex items-center space-x-2 mb-6">
            <input 
              type="checkbox" 
              id="remember" 
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white/60"
            />
            <Label htmlFor="remember" className="text-sm font-medium text-slate-800 cursor-pointer">
              Remember me
            </Label>
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg" disabled={isLoading}>
            {isLoading ? "Signing in..." : "SIGN IN"}
          </Button>

          <div className="text-center text-sm text-slate-700 mt-6 font-medium">
            Don't have an account?{" "}
            <Link to="/register" className="text-blue-700 hover:underline font-bold">
              Register here
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
