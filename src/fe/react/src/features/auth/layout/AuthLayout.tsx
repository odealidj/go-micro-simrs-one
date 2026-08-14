import { Outlet } from "react-router-dom";
import { Activity } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex bg-slate-50">
      {/* Left Side - Branding (Solid Color) */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-14 bg-blue-900 relative overflow-hidden">
        {/* Subtle decorative elements instead of heavy images */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-[100px] opacity-20 -ml-20 -mb-20 pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
          <div className="leading-tight text-white">
            <h1 className="font-bold text-2xl tracking-tight">Codina Mini SIMRS</h1>
            <p className="text-xs font-semibold tracking-widest text-blue-200 uppercase mt-1">Modul Rawat Jalan</p>
          </div>
        </div>

        <div className="max-w-xl relative z-10">
          <blockquote className="space-y-6">
            <p className="text-3xl font-medium leading-snug text-white">
              "Melayani dengan sepenuh hati, memberikan pengalaman pendaftaran yang cepat, cerdas, dan terintegrasi."
            </p>
            <footer className="flex items-center gap-3">
              <div className="h-px w-12 bg-blue-400" />
              <span className="text-sm text-blue-200 font-medium">Outpatient V2.0</span>
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Side - Form Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-md mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
