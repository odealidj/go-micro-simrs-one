import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeEncounter, finalizeSeverity } from "../api/rawatJalanApi";
import type { GetMedicalRecordResponse } from "../types";
import { toast } from "sonner";
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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

interface ResumeDispositionFormProps {
  encounterNo: string;
  record: GetMedicalRecordResponse | null;
  readOnly?: boolean;
  onSuccess?: () => void;
}

const DISPOSITIONS = [
  { value: "PULANG", label: "Rawat Jalan / Selesai", icon: Home, desc: "Pasien selesai periksa dan diperbolehkan pulang" },
  { value: "KONTROL", label: "Kontrol Ulang", icon: Calendar, desc: "Perlu pemeriksaan lanjutan pada tanggal tertentu" },
  { value: "KONSUL_POLI", label: "Konsul Antar Poli", icon: Stethoscope, desc: "Konsultasi ke spesialis/poli lain" },
  { value: "RAWAT_INAP", label: "Rujuk Rawat Inap", icon: Building, desc: "Pasien memerlukan observasi / opname" },
];

const computeSuggestedSeverity = (diagnoses?: any[]): string => {
  if (!diagnoses || diagnoses.length === 0) return "";
  let highest = "I";
  for (const d of diagnoses) {
    const sev = (d.severity_level || "").toUpperCase();
    if (sev === "III" || sev === "BERAT") {
      return "III";
    }
    if (sev === "II" || sev === "SEDANG") {
      highest = "II";
    }
  }
  return highest;
};

export function ResumeDispositionForm({
  encounterNo,
  record,
  readOnly = false,
  onSuccess,
}: ResumeDispositionFormProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [disposition, setDisposition] = useState("PULANG");
  const [controlDate, setControlDate] = useState("");
  const [educationNotes, setEducationNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculated encounter severity from active diagnoses
  const suggestedSeverity = computeSuggestedSeverity(record?.diagnoses);
  const [encounterSeverity, setEncounterSeverity] = useState<string>(
    record?.encounter_severity_level || suggestedSeverity || (record?.diagnoses?.length ? "I" : "")
  );
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Auto-sync when diagnoses or record changes
  useEffect(() => {
    if (record?.encounter_severity_level) {
      setEncounterSeverity(record.encounter_severity_level);
    } else if (!isManualOverride) {
      setEncounterSeverity(suggestedSeverity || (record?.diagnoses?.length ? "I" : ""));
    }
  }, [record?.encounter_severity_level, suggestedSeverity, record?.diagnoses?.length, isManualOverride]);

  const handleFinalize = async () => {
    setLoading(true);
    setError(null);
    try {
      if (encounterSeverity && encounterSeverity !== record?.encounter_severity_level) {
        await finalizeSeverity(encounterNo, encounterSeverity);
      }
      await completeEncounter(encounterNo);
      setSuccess(true);
      toast.success("Pemeriksaan pasien berhasil diselesaikan!");
      if (onSuccess) await onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Gagal menyelesaikan encounter";
      setError(msg);
      toast.error(msg);
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
              onClick={() => navigate(role === "perawat" ? "/rawat-jalan/perawat/antrean" : "/rawat-jalan/dokter/antrean")}
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
              <div className="text-slate-600 space-y-1">
                <p>
                  TD: <strong className="text-slate-800">{record.triage.blood_pressure_systolic}/{record.triage.blood_pressure_diastolic} mmHg</strong> · 
                  Suhu: <strong className="text-slate-800">{record.triage.temperature}°C</strong> · 
                  Nadi: <strong className="text-slate-800">{record.triage.heart_rate} bpm</strong>
                  {record.triage.respiratory_rate ? <> · RR: <strong className="text-slate-800">{record.triage.respiratory_rate} x/m</strong></> : null}
                  {record.triage.oxygen_saturation ? <> · SpO₂: <strong className="text-slate-800">{record.triage.oxygen_saturation}%</strong></> : null}
                </p>
                {(record.triage.height || record.triage.weight) && (
                  <p className="text-xs text-slate-500">
                    TB: <strong>{record.triage.height || "-"} cm</strong> · BB: <strong>{record.triage.weight || "-"} kg</strong>
                    {record.triage.bmi ? <> · IMT: <strong>{record.triage.bmi} kg/m²</strong></> : null}
                  </p>
                )}
                {record.triage.allergies && (
                  <p className="text-xs text-red-600 font-medium">
                    Alergi: {record.triage.allergies}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic">Belum diinput</p>
            )}
          </div>

          {/* Diagnosa summary */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1.5">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5 text-slate-800">
              <Stethoscope className="h-3.5 w-3.5 text-indigo-600" />
              Diagnosa ({record?.diagnoses?.length || 0})
            </p>
            {(record?.diagnoses && record.diagnoses.length > 0) ? (
              <div className="space-y-1">
                {record.diagnoses.map(d => (
                  <p key={d.id} className="text-slate-800 font-medium text-xs flex items-center justify-between">
                    <span>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded mr-1.5",
                        d.diagnosis_type === "PRIMARY" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                      )}>
                        {d.diagnosis_type === "PRIMARY" ? "UTAMA" : "SEKUNDER"}
                      </span>
                      [{d.icd10_code}] {d.icd10_name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                      Sev: {d.severity_level || "I"}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm">Belum ditentukan</p>
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

      {/* ─── ENCOUNTER SEVERITY SECTION (INA-CBGs) ─── */}
      <div className="bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 border border-indigo-100 rounded-2xl p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                Tingkat Keparahan Pertemuan (Encounter Severity)
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-800">
                  INA-CBGs
                </span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Menentukan level kompleksitas perawatan untuk paket klaim INA-CBGs BPJS Kesehatan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {suggestedSeverity ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                {isManualOverride ? "✏️ Disesuaikan Dokter" : `🤖 Auto-Saran: Level ${suggestedSeverity}`}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                Belum ada diagnosa aktif
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[
            {
              level: "I",
              title: "Level I - Ringan",
              desc: "Kasus standar tanpa komplikasi berat atau penyulit klinis.",
              activeClass: "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs",
            },
            {
              level: "II",
              title: "Level II - Sedang",
              desc: "Kasus dengan komorbiditas penyerta atau penyulit klinis sedang.",
              activeClass: "border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/20 shadow-xs",
            },
            {
              level: "III",
              title: "Level III - Berat",
              desc: "Kasus kompleksitas tinggi / komplikasi mayor (Major CC / MCC).",
              activeClass: "border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20 shadow-xs",
            },
          ].map((item) => {
            const isSelected = encounterSeverity === item.level;
            return (
              <button
                key={item.level}
                type="button"
                disabled={readOnly || success || !record?.diagnoses?.length}
                onClick={() => {
                  setEncounterSeverity(item.level);
                  setIsManualOverride(item.level !== suggestedSeverity);
                }}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer",
                  isSelected
                    ? item.activeClass
                    : "bg-white border-slate-200 hover:border-slate-300 text-slate-700",
                  (readOnly || success || !record?.diagnoses?.length) && "cursor-not-allowed opacity-60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{item.title}</span>
                  {isSelected && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                      Terpilih
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pilihan Disposisi / Status Pulang */}
      {!success && !readOnly && (
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
                    "p-4 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer",
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
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white font-bold h-12 px-8 rounded-xl shadow-sm text-base cursor-pointer"
            >
              <ShieldCheck className="h-5 w-5" />
              {loading ? "Memproses..." : "Selesaikan & Kunci Pemeriksaan"}
            </Button>
          </div>
        </div>
      )}

      {readOnly && !success && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 italic">
          Formulir finalisasi terkunci. Pastikan sesi telah dimulai dan belum difinalisasi untuk mengubah data.
        </div>
      )}
    </div>
  );
}
