import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getTodayEncounters } from "../api/rawatJalanApi";
import type { EncounterDetail } from "../types";
import {
  Activity,
  Users,
  UserCheck,
  ChevronRight,
  Stethoscope,
  RefreshCw,
  ListChecks,
  ClipboardPlus,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={cn("p-3.5 rounded-xl", bgColor)}>
        <Icon className={cn("h-6 w-6", color)} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  );
}

export function DokterDashboard() {
  const { poliName, poliCode } = useAuth();
  const [encounters, setEncounters] = useState<EncounterDetail[]>([]);
  const [loading, setLoading] = useState(false);

  const poliLabel = poliName || (poliCode ? `Poli (${poliCode})` : "Poliklinik Anda");

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getTodayEncounters(poliCode || "");
      setEncounters(data);
    } catch (err) {
      console.error("Failed to load encounters", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [poliCode]);

  const waiting = encounters.filter((e) =>
    ["REGISTERED", "QUEUED", "QUEUED_FOR_POLI", "WAITING_FOR_TRIAGE"].includes(e.status)
  ).length;
  const inProgress = encounters.filter((e) => e.status === "IN_PROGRESS").length;
  const completed = encounters.filter((e) => e.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-800">Dashboard Dokter</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {poliLabel} —{" "}
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={cn("h-4 w-4 text-emerald-600", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Pasien Menunggu"
          value={waiting}
          icon={Users}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          label="Sedang Diperiksa"
          value={inProgress}
          icon={Activity}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          label="Selesai Hari Ini"
          value={completed}
          icon={UserCheck}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
      </div>

      {/* Quick Menu Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/rawat-jalan/dokter/antrean"
          className="group bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
        >
          <div className="p-4 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition-colors text-emerald-600">
            <ListChecks className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base group-hover:text-emerald-700 transition-colors">
                Antrean Pasien Hari Ini
              </h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                {encounters.length} Pasien
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Buka daftar antrean pasien poliklinik untuk memulai pemeriksaan dan entri rekam medis.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-3 group-hover:translate-x-0.5 transition-transform">
              Buka Antrean <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

        <Link
          to="/rawat-jalan/dokter/riwayat"
          className="group bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
        >
          <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors text-slate-600">
            <ClipboardPlus className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 text-base group-hover:text-slate-900 transition-colors">
              Riwayat Rekam Medis
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Cari dan telusuri riwayat kunjungan serta catatan medis pasien poliklinik terdahulu.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 mt-3 group-hover:translate-x-0.5 transition-transform">
              Lihat Riwayat <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-xl">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Alur Pelayanan RME Poliklinik Aktif</h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Setiap pasien di antrean dilengkapi 5 tab: Triage, Diagnosa Medis (ICD-10), Tindakan Medis, E-Resep Obat, dan Resume Medis.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-100">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
          {poliLabel}
        </div>
      </div>
    </div>
  );
}
