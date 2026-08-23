import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { getTodayEncounters } from "../api/emrApi";
import type { EncounterDetail } from "../types";
import {
  HeartPulse,
  ClipboardEdit,
  UserCheck,
  ChevronRight,
  RefreshCw,
  Activity,
  ListChecks,
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

export function PerawatDashboard() {
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

  const needTriage = encounters.filter((e) =>
    ["REGISTERED", "QUEUED", "WAITING_FOR_TRIAGE"].includes(e.status)
  ).length;
  const inProgress = encounters.filter((e) => e.status === "IN_PROGRESS").length;
  const completed = encounters.filter((e) => e.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HeartPulse className="h-5 w-5 text-cyan-600" />
            <h1 className="text-2xl font-bold text-slate-800">Dashboard Perawat</h1>
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
          <RefreshCw className={cn("h-4 w-4 text-cyan-600", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Perlu Triage"
          value={needTriage}
          icon={ClipboardEdit}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          label="Sedang Dilayani"
          value={inProgress}
          icon={Activity}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
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
          to="/perawat/antrean"
          className="group bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all"
        >
          <div className="p-4 bg-cyan-50 rounded-2xl group-hover:bg-cyan-100 transition-colors text-cyan-600">
            <ListChecks className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base group-hover:text-cyan-700 transition-colors">
                Antrean Pasien Hari Ini
              </h3>
              <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-100">
                {encounters.length} Pasien
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Buka daftar antrean seluruh pasien poliklinik yang terdaftar hari ini.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 mt-3 group-hover:translate-x-0.5 transition-transform">
              Buka Antrean <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

        <Link
          to="/perawat/triage"
          className="group bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all"
        >
          <div className="p-4 bg-amber-50 rounded-2xl group-hover:bg-amber-100 transition-colors text-amber-600">
            <ClipboardEdit className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base group-hover:text-amber-700 transition-colors">
                Input Asesmen Triage
              </h3>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                {needTriage} Perlu Triage
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Input tanda-tanda vital, antropometri, dan skrining awal pasien.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 mt-3 group-hover:translate-x-0.5 transition-transform">
              Input Triage <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-100/70 text-cyan-700 rounded-xl">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Pusat Layanan Asuhan Keperawatan</h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Pemeriksaan tanda vital, tinggi/berat badan (IMT), dan riwayat alergi terhubung langsung ke layar dokter.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
