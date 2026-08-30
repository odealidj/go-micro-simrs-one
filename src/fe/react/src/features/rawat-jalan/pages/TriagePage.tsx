import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { TriageForm } from "../components/TriageForm";
import type { EncounterDetail } from "../types";
import { isReadyForExam } from "../types";
import {
  HeartPulse,
  Search,
  Users,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function TriagePage() {
  const { poliCode } = useAuth();
  const [encounters, setEncounters] = useState<EncounterDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EncounterDetail | null>(null);
  const [search, setSearch] = useState("");

  const fetchEncounters = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/registrations/today?poli_code=${poliCode || ""}`);
      const data = res.data?.data || [];
      // Tampilkan hanya yang siap diperiksa/ditriage
      setEncounters(
        data.filter((e: EncounterDetail) => isReadyForExam(e.status))
      );
    } catch (err) {
      console.error("Failed to fetch encounters", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [poliCode]);

  const filtered = encounters.filter((e) =>
    (e.patient_name || e.mrn || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Kembali ke Daftar
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-4 pb-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800 text-lg">Input Triage Pasien</h2>
            <p className="text-sm text-slate-500 mt-1">
              Pasien: <span className="font-medium text-slate-700">{selected.patient_name || selected.mrn}</span>
              {" · "}
              <span className="text-xs text-slate-400">#{selected.encounter_no}</span>
            </p>
          </div>

          <TriageForm
            encounterNo={selected.encounter_no}
            onSuccess={() => {
              setSelected(null);
              fetchEncounters();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HeartPulse className="h-5 w-5 text-cyan-600" />
            <h1 className="text-2xl font-bold text-slate-800">Input Triage</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Pilih pasien untuk melakukan input data triage
          </p>
        </div>
        <button
          onClick={fetchEncounters}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari nama pasien / MRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Daftar Pasien */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            Pasien Menunggu Triage{" "}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              {filtered.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-sm">Memuat data...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {search ? "Tidak ada pasien yang cocok dengan pencarian" : "Tidak ada pasien yang menunggu triage"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((enc) => (
              <div
                key={enc.encounter_no}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-cyan-50 flex items-center justify-center">
                    <Users className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {enc.patient_name || enc.mrn}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      #{enc.encounter_no} · {enc.status}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(enc)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                >
                  Input Triage <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
