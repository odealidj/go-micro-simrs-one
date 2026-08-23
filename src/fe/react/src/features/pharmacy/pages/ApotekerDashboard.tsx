import { Link } from "react-router-dom";
import { FlaskConical, ClipboardList, PackageCheck, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApotekerDashboard() {
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="h-5 w-5 text-violet-600" />
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Farmasi</h1>
        </div>
        <p className="text-slate-500 text-sm">Instalasi Farmasi — {today}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Resep Menunggu", icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50", value: "—" },
          { label: "Sudah Dilayani", icon: PackageCheck, color: "text-emerald-600", bg: "bg-emerald-50", value: "—" },
          { label: "Estimasi Tunggu", icon: Clock, color: "text-violet-600", bg: "bg-violet-50", value: "— menit" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
            <div className={cn("p-3 rounded-xl", item.bg)}>
              <item.icon className={cn("h-6 w-6", item.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{item.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Shortcut Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/apoteker/resep"
          className="group bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-violet-300 transition-all"
        >
          <div className="p-3 bg-violet-50 rounded-xl group-hover:bg-violet-100 transition-colors">
            <ClipboardList className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Resep Masuk</p>
            <p className="text-sm text-slate-500 mt-0.5">Lihat daftar resep yang perlu disiapkan</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-violet-600 transition-colors" />
        </Link>

        <Link
          to="/apoteker/dispense"
          className="group bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
        >
          <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
            <PackageCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Proses Dispensing</p>
            <p className="text-sm text-slate-500 mt-0.5">Konfirmasi pengeluaran obat ke pasien</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </Link>
      </div>

      {/* Info Panel */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
        <p className="text-sm text-violet-700 font-medium flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Alur Kerja Farmasi
        </p>
        <ol className="mt-3 space-y-2 text-sm text-violet-600">
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">1.</span>
            Dokter membuat resep dari halaman Encounter Pasien
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">2.</span>
            Resep masuk ke antrian farmasi — lihat di menu <strong>Resep Masuk</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold shrink-0">3.</span>
            Siapkan obat, lalu proses dispensing di menu <strong>Proses Dispensing</strong>
          </li>
        </ol>
      </div>
    </div>
  );
}
