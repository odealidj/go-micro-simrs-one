import { Outlet } from "react-router-dom";
import { Activity } from "lucide-react";

export function AuthLayout() {
  return (
    <div 
      className="min-h-screen w-full flex bg-slate-900 relative"
      style={{
        backgroundImage: 'url("/bg-medical-tech.png")', // Generated digital medical tech theme
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay for better contrast on the left side */}
      <div className="absolute inset-0 bg-blue-950/40 mix-blend-multiply pointer-events-none" />

      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-14 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
            <Activity className="h-8 w-8 text-blue-400" />
          </div>
          <div className="leading-tight text-white">
            <h1 className="font-bold text-3xl tracking-tight">Codina Mini SIMRS</h1>
            <p className="text-sm font-semibold tracking-[0.2em] text-blue-200/80 uppercase mt-1">Modul Rawat Jalan</p>
          </div>
        </div>

        <div className="max-w-xl">
          <div className="p-8 bg-black/20 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <blockquote className="space-y-6 relative z-10">
              <p className="text-2xl font-medium leading-relaxed text-white/95">
                "Melayani dengan sepenuh hati, memberikan pengalaman pendaftaran dan antrean rawat jalan yang cepat, cerdas, dan terintegrasi."
              </p>
              <footer className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/20" />
                <span className="text-sm text-blue-200/80 font-semibold tracking-wider uppercase">Mini Outpatient V2.0</span>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* Right Side - Forms */}
      <div className="w-full lg:w-[500px] xl:w-[550px] flex items-center justify-center p-6 sm:p-8 bg-white/10 backdrop-blur-2xl border-l border-white/20 shadow-[-20px_0_40px_rgba(0,0,0,0.1)] relative z-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
