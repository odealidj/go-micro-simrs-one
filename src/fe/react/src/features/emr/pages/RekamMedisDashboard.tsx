import { useState } from "react";
import { Link } from "react-router-dom";
import { getMedicalRecord } from "../api/emrApi";
import type { GetMedicalRecordResponse } from "../types";
import {
  BookOpen,
  Search,
  FileText,
  ClipboardCheck,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RekamMedisDashboard() {
  const [encounterNo, setEncounterNo] = useState("");
  const [record, setRecord] = useState<GetMedicalRecordResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleSearch = async () => {
    if (!encounterNo.trim()) return;
    setLoading(true); setError(null); setRecord(null);
    try {
      const data = await getMedicalRecord(encounterNo.trim());
      if (!data) setError("Rekam medis tidak ditemukan untuk nomor encounter tersebut.");
      else setRecord(data);
    } catch {
      setError("Gagal mengambil data rekam medis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Rekam Medis</h1>
        </div>
        <p className="text-slate-500 text-sm">Unit Rekam Medis — {today}</p>
      </div>

      {/* Quick Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800 mb-1">Cari Rekam Medis</h2>
          <p className="text-sm text-slate-500">Masukkan nomor encounter untuk melihat catatan medis pasien</p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Nomor Encounter (ENC-2024-00123)"
              value={encounterNo}
              onChange={(e) => setEncounterNo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !encounterNo.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Cari"}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {record && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-indigo-800">MRN: {record.patient_mrn || encounterNo}</p>
                <p className="text-xs text-indigo-600 mt-0.5">#{record.encounter_no}</p>
              </div>
              <Link
                to={`/rekam-medis/detail?no=${encounterNo}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Lihat Detail <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {(record.diagnoses && record.diagnoses.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {record.diagnoses.filter(d => d.diagnosis_type === "PRIMARY").map(d => (
                  <span key={d.id} className="px-2 py-1 bg-white border border-indigo-200 rounded-md text-xs text-indigo-700">
                    {d.icd10_code} — {d.icd10_name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shortcut Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/rekam-medis/icd10-pending"
          className="group bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all">
          <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
            <ClipboardCheck className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Pending Verifikasi ICD-10</p>
            <p className="text-sm text-slate-500 mt-0.5">Review dan verifikasi mapping diagnosis ICD-10</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </Link>

        <Link to="/rekam-medis/cari"
          className="group bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
          <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
            <FileText className="h-6 w-6 text-slate-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Telusuri Rekam Medis</p>
            <p className="text-sm text-slate-500 mt-0.5">Cari rekam medis berdasarkan nomor encounter</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </Link>
      </div>
    </div>
  );
}
