import { Outlet } from "react-router-dom";
import { Activity } from "lucide-react";

export function AuthLayout() {
  return (
    <div 
      className="min-h-screen w-full relative flex items-center justify-center bg-slate-100"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2053&auto=format&fit=crop")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay to ensure text readability if needed, though glassmorphism usually handles this */}
      <div className="absolute inset-0 bg-blue-900/10 mix-blend-multiply" />

      {/* Top Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 text-slate-800">
          <Activity className="h-8 w-8 text-blue-600" />
          <div className="leading-tight">
            <h1 className="font-bold text-xl text-slate-900">Codina SIMRS</h1>
            <p className="text-xs text-slate-600 font-medium tracking-wider uppercase">Hospital System</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-md px-4">
        <Outlet />
      </div>
    </div>
  );
}
