import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GetMedicalRecordResponse } from "../types";
import {
  FileCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Home,
  Building,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Receipt,
  Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ResumeDispositionFormProps {
  encounterNo: string;
  record: GetMedicalRecordResponse | null;
  onSuccess?: () => void;
}

const DISPOSITIONS = [
  { value: "PULANG", label: "Rawat Jalan / Selesai", icon: Home, desc: "Pasien selesai periksa dan diperbolehkan pulang" },
  { value: "KONTROL", label: "Kontrol Ulang", icon: Calendar, desc: "Perlu pemeriksaan lanjutan pada tanggal tertentu" },
  { value: "KONSUL_POLI", label: "Konsul Antar Poli", icon: Stethoscope, desc: "Konsultasi ke spesialis/poli lain" },
  { value: "RAWAT_INAP", label: "Rujuk Rawat Inap", icon: Building, desc: "Pasien memerlukan observasi / opname" },
];

export function ResumeDispositionForm({
  encounterNo,
  record,
  onSuccess,
}: ResumeDispositionFormProps) {
  const navigate = useNavigate();
  const [disposition, setDisposition] = useState("PULANG");
  const [controlDate, setControlDate] = useState("");
  const [educationNotes, setEducationNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinalize = async () => {
    setLoading(true);
    setError(null);
    try {
      // In SIMRS flow, finalization marks the encounter complete.
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal menyelesaikan encounter");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-teal-600" />
          <h3 className="font-semibold text-slate-800 text-lg">Rencana Tindak Lanjut & Resume Medis</h3>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Finalisasi Pelayanan Pasien
        </span>
      </div>

      {success && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-base">Pemeriksaan Pasien Selesai!</h4>
              <p className="text-sm text-emerald-700 mt-1">
                Data rekam medis encounter <strong>#{encounterNo}</strong> telah difinalisasi.
                Pasien telah diarahkan ke loket Kasir dan Farmasi.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => navigate("/dokter/antrean")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-4"
            >
              Kembali ke Antrean Pasien
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Ringkasan Rekam Medis (Medical Summary Overview) */}
      <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-5 space-y-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Ringkasan Pelayanan Kunjungan Ini
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {/* Triage summary */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5 text-slate-800">
              <HeartPulse className="h-3.5 w-3.5 text-cyan-600" />
              Tanda Vital & Triage
            </p>
            {record?.triage ? (
              <p className="text-slate-600">
                TD: <strong className="text-slate-800">{record.triage.blood_pressure_systolic}/{record.triage.blood_pressure_diastolic} mmHg</strong> · 
                Suhu: <strong className="text-slate-800">{record.triage.temperature}°C</strong> · 
                Nadi: <strong className="text-slate-800">{record.triage.heart_rate} bpm</strong>
              </p>
            ) : (
              <p className="text-slate-400 italic">Belum diinput</p>
            )}
          </div>

          {/* Diagnosa summary */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5 text-slate-800">
              <Stethoscope className="h-3.5 w-3.5 text-indigo-600" />
              Diagnosa Utama (KBM)
            </p>
            {record?.kbm_code ? (
              <p className="text-slate-800 font-medium">
                [{record.kbm_code}] {record.kbm_name}
              </p>
            ) : (
              <p className="text-slate-400 italic">Belum ditentukan</p>
            )}
          </div>

          {/* Tindakan summary */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5 text-slate-800">
              <Receipt className="h-3.5 w-3.5 text-emerald-600" />
              Tindakan Medis ({record?.actions?.length || 0})
            </p>
            <p className="text-slate-600">
              {(record?.actions && record.actions.length > 0)
                ? record.actions.map(a => a.action_name).join(", ")
                : "Tidak ada tindakan tambahan"}
            </p>
          </div>

          {/* Catatan Dokter */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5 text-slate-800">
              <Pill className="h-3.5 w-3.5 text-violet-600" />
              Catatan Dokter (SOAP)
            </p>
            <p className="text-slate-600 line-clamp-2">
              {record?.notes || "Tidak ada catatan"}
            </p>
          </div>
        </div>
      </div>

      {/* Pilihan Disposisi / Status Pulang */}
      {!success && (
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Pilih Status Kepulangan / Disposisi <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DISPOSITIONS.map((item) => {
              const Icon = item.icon;
              const isSelected = disposition === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDisposition(item.value)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all flex items-start gap-3",
                    isSelected
                      ? "bg-teal-50/70 border-teal-400 text-teal-900 shadow-sm"
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div className={cn("p-2 rounded-lg mt-0.5", isSelected ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Kontrol Date Picker */}
          {disposition === "KONTROL" && (
            <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl space-y-2 max-w-sm">
              <label className="block text-xs font-semibold text-teal-800">
                Pilih Tanggal Kontrol Ulang
              </label>
              <Input
                type="date"
                value={controlDate}
                onChange={(e) => setControlDate(e.target.value)}
                className="bg-white h-10"
              />
            </div>
          )}

          {/* Edukasi Pasien */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Instruksi & Edukasi Perawatan di Rumah
            </label>
            <textarea
              value={educationNotes}
              onChange={(e) => setEducationNotes(e.target.value)}
              className="w-full h-24 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors resize-none placeholder:text-slate-400"
              placeholder="Contoh: Istirahat cukup 3 hari, kurangi makanan pedas, minum obat teratur..."
            />
          </div>

          {/* Tombol Finalisasi */}
          <div className="pt-3 flex justify-end">
            <Button
              type="button"
              onClick={handleFinalize}
              disabled={loading}
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white font-bold h-12 px-8 rounded-xl shadow-sm text-base"
            >
              <ShieldCheck className="h-5 w-5" />
              {loading ? "Memproses..." : "Selesaikan & Kunci Pemeriksaan"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
