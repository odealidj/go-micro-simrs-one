import { Outlet } from "react-router-dom";
import { Activity } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="container relative min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-primary" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <Activity className="mr-2 h-6 w-6" />
          Codina SIMRS
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "Sistem Informasi Manajemen Rumah Sakit terintegrasi yang memudahkan pelayanan pasien dan operasional harian rumah sakit dengan teknologi cerdas."
            </p>
            <footer className="text-sm">Tim Codina SIMRS</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8 min-h-screen flex items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
