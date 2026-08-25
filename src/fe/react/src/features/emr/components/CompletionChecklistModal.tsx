import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GetMedicalRecordResponse } from "../types";
import {
  HeartPulse,
  Stethoscope,
  Receipt,
  Pill,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  FileCheck,
  Building,
  Calendar,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletionChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (disposition: string) => Promise<void>;
  record: GetMedicalRecordResponse | null;
  onNavigateTab: (tab: "triage" | "diagnosis" | "actions" | "prescription" | "disposition") => void;
  poliName?: string | null;
}

export function CompletionChecklistModal({
  isOpen,
  onClose,
  onConfirm,
  record,
  onNavigateTab,
  poliName,
}: CompletionChecklistModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState("PULANG");

  if (!isOpen) return null;

  // Validation rules
  const hasTriage = !!(
    record?.triage &&
    record.triage.blood_pressure_systolic &&
    record.triage.blood_pressure_diastolic &&
    record.triage.temperature &&
    record.triage.heart_rate
  );

  const hasDiagnosis = !!(record?.diagnoses && record.diagnoses.length > 0);
  const actionsCount = record?.actions?.length || 0;
  const prescriptionsCount = record?.prescriptions?.length || 0;

  const isReady = hasTriage && hasDiagnosis;

  const isGeneralPoli = poliName?.toLowerCase().includes("umum") || false;
  const baseFeeTitle = isGeneralPoli
    ? "Pemeriksaan Dokter Umum (Poli Umum)"
    : `Pemeriksaan Dokter Spesialis (${poliName || "Poliklinik"})`;

  const handleConfirm = async () => {
    if (!isReady) return;
    setLoading(true);
    try {
      await onConfirm(selectedDisposition);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Checklist Kelengkapan Rekam Medis</h3>
              <p className="text-xs text-slate-400">
                Encounter #{record?.encounter_no} · MRN: {record?.patient_mrn || "-"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Status Banner */}
          {isReady ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-emerald-950">Seluruh Data Medis Wajib Telah Lengkap!</strong>
                <p className="text-emerald-700 mt-0.5">
                  Rekam medis telah memenuhi standar klinis. Klik tombol di bawah untuk menyelesaikan dan mengunci encounter.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-950">Data Medis Wajib Belum Lengkap!</strong>
                <p className="text-amber-700 mt-0.5">
                  Sesuai standar Permenkes No. 24/2022, Asesmen Triage & Diagnosa Utama wajib disimpan sebelum pemeriksaan dapat diselesaikan.
                </p>
              </div>
            </div>
          )}

          {/* Checklist Items */}
          <div className="space-y-3">
            {/* 1. Asesmen Triage (WAJIB) */}
            <div
              className={cn(
                "p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3",
                hasTriage
                  ? "bg-emerald-50/40 border-emerald-200 text-slate-800"
                  : "bg-red-50/50 border-red-200 text-slate-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg mt-0.5 shrink-0",
                    hasTriage ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}
                >
                  <HeartPulse className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">1. Asesmen Triage & TTV</span>
                    <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[10px] font-bold rounded-full">
                      Wajib
                    </span>
                  </div>
                  {hasTriage ? (
                    <p className="text-xs text-slate-600 mt-0.5">
                      TD: {record?.triage.blood_pressure_systolic}/{record?.triage.blood_pressure_diastolic} mmHg · Suhu: {record?.triage.temperature}°C · Nadi: {record?.triage.heart_rate} bpm
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 font-medium mt-0.5">
                      Belum diisi / belum disimpan oleh perawat atau dokter.
                    </p>
                  )}
                </div>
              </div>

              {!hasTriage ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onNavigateTab("triage");
                  }}
                  className="text-xs h-8 border-red-300 text-red-700 hover:bg-red-50 gap-1 rounded-lg shrink-0 cursor-pointer"
                >
                  Isi Triage <ArrowRight className="h-3 w-3" />
                </Button>
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-1" />
              )}
            </div>

            {/* 2. Diagnosa Medis (WAJIB) */}
            <div
              className={cn(
                "p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3",
                hasDiagnosis
                  ? "bg-emerald-50/40 border-emerald-200 text-slate-800"
                  : "bg-red-50/50 border-red-200 text-slate-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg mt-0.5 shrink-0",
                    hasDiagnosis ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}
                >
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">2. Diagnosa Medis Utama</span>
                    <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[10px] font-bold rounded-full">
                      Wajib
                    </span>
                  </div>
                  {hasDiagnosis ? (
                    <div className="mt-0.5 space-y-1">
                      {record?.diagnoses?.filter(d => d.diagnosis_type === "PRIMARY").map(d => (
                        <p key={d.id} className="text-xs text-slate-700 font-medium">
                          [{d.icd10_code}] {d.icd10_name} {d.auto_kbm_code && `(Auto-KBM: ${d.auto_kbm_code})`}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-red-600 font-medium mt-0.5">
                      Belum ditentukan oleh dokter pemeriksa.
                    </p>
                  )}
                </div>
              </div>

              {!hasDiagnosis ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onNavigateTab("diagnosis");
                  }}
                  className="text-xs h-8 border-red-300 text-red-700 hover:bg-red-50 gap-1 rounded-lg shrink-0 cursor-pointer"
                >
                  Isi Diagnosa <ArrowRight className="h-3 w-3" />
                </Button>
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-1" />
              )}
            </div>

            {/* 3. Tindakan Medis & Tarif (Termasuk Paket Registrasi) */}
            <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg mt-0.5 shrink-0 bg-emerald-100 text-emerald-700">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">3. Tarif & Tindakan Medis</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded-full">
                      Include Registrasi
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5 font-medium">
                    ✓ {baseFeeTitle}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {actionsCount > 0
                      ? `+ ${actionsCount} tindakan medis tambahan tercatat`
                      : "Tidak ada tindakan tambahan (Opsional)"}
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 mt-1">
                {actionsCount} Prosedur
              </span>
            </div>

            {/* 4. E-Resep Obat (OPSIONAL) */}
            <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg mt-0.5 shrink-0 bg-violet-100 text-violet-700">
                  <Pill className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">4. E-Resep Obat Farmasi</span>
                    <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-full">
                      Opsional
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {prescriptionsCount > 0
                      ? `✓ ${prescriptionsCount} obat telah diresepkan`
                      : "Tidak ada resep obat (Pasien tidak memerlukan obat)"}
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 mt-1">
                {prescriptionsCount} Obat
              </span>
            </div>

            {/* 5. Rencana & Resume Medis (Disposisi) */}
            <div className="p-3.5 rounded-xl border bg-teal-50/50 border-teal-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-teal-700" />
                <span className="font-bold text-xs text-teal-950">5. Status Kepulangan Pasien (Disposisi)</span>
                <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 text-[10px] font-bold rounded-full">
                  Wajib
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "PULANG", label: "Rawat Jalan / Pulang", icon: Home },
                  { value: "KONTROL", label: "Kontrol Ulang", icon: Calendar },
                  { value: "KONSUL_POLI", label: "Konsul Antar Poli", icon: Stethoscope },
                  { value: "RAWAT_INAP", label: "Rujuk Rawat Inap", icon: Building },
                ].map((disp) => {
                  const Icon = disp.icon;
                  const isSel = selectedDisposition === disp.value;
                  return (
                    <button
                      key={disp.value}
                      type="button"
                      onClick={() => setSelectedDisposition(disp.value)}
                      className={cn(
                        "p-2 rounded-lg border text-left text-xs flex items-center gap-2 transition-all cursor-pointer",
                        isSel
                          ? "bg-teal-600 text-white font-bold border-teal-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-teal-50/50 font-medium"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{disp.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Batal
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!isReady || loading}
            className={cn(
              "gap-2 text-xs font-bold h-10 px-5 rounded-xl shadow-sm transition-all cursor-pointer",
              isReady
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-300 text-slate-500 cursor-not-allowed"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            {loading ? "Memproses Finalisasi..." : "Kunci & Selesaikan Pemeriksaan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
