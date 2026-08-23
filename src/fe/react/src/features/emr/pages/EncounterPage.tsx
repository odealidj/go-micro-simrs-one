import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMedicalRecord, startEncounter } from "../api/emrApi";
import type { GetMedicalRecordResponse } from "../types";
import { TriageForm } from "../components/TriageForm";
import { DiagnosisForm } from "../components/DiagnosisForm";
import { ActionForm } from "../components/ActionForm";
import { PrescriptionForm } from "../components/PrescriptionForm";
import { ResumeDispositionForm } from "../components/ResumeDispositionForm";
import {
  User,
  ArrowLeft,
  HeartPulse,
  Stethoscope,
  Syringe,
  Pill,
  FileCheck,
  Play,
  CheckCircle2,
  Hash,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

export function EncounterPage() {
  const { encounterNo } = useParams<{ encounterNo: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<GetMedicalRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<"triage" | "diagnosis" | "actions" | "prescription" | "disposition">("triage");
  const { poliCode, poliName, role } = useAuth();

  const fetchRecord = async () => {
    if (!encounterNo) return;
    setLoading(true);
    try {
      const data = await getMedicalRecord(encounterNo);
      setRecord(data);
    } catch (error) {
      console.error("Failed to load medical record", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [encounterNo]);

  const handleStartEncounter = async () => {
    if (!encounterNo) return;
    setStarting(true);
    try {
      await startEncounter(encounterNo);
      await fetchRecord();
    } catch (error) {
      console.error(error);
    } finally {
      setStarting(false);
    }
  };

  const backUrl = role === "perawat" ? "/perawat/antrean" : "/dokter/antrean";

  const hasTriage = !!record?.triage;
  const hasDiagnosis = !!record?.kbm_code;
  const hasActions = !!(record?.actions && record.actions.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold">Memuat rekam medis pasien...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Patient Header Card with Integrated Back Button */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            {/* Integrated Back Arrow Button */}
            <button
              type="button"
              onClick={() => navigate(backUrl)}
              className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 border border-slate-200 flex items-center justify-center transition-all shadow-2xs group cursor-pointer shrink-0"
              title="Kembali ke Antrean Pasien"
              aria-label="Kembali ke Antrean Pasien"
            >
              <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-extrabold text-slate-900">
                  Lembar Kerja Pemeriksaan Pasien
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  {poliName || "Poliklinik"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  <Hash className="h-3 w-3" />
                  No. Encounter: {encounterNo}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleStartEncounter}
              disabled={starting}
              variant="outline"
              size="sm"
              className="gap-2 border-blue-300 text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl text-xs font-bold h-10 px-4 shadow-2xs cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 text-blue-600 fill-blue-600" />
              {starting ? "Memulai Sesi..." : "Mulai Sesi Pemeriksaan"}
            </Button>
          </div>
        </div>

        {/* Quick Patient Demographics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
              <User className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. Rekam Medis</p>
              <p className="font-mono font-black text-slate-900 text-base">{record?.patient_mrn || "-"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200 shrink-0">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diagnosa Utama (KBM)</p>
              <p className="font-bold text-slate-900 text-sm line-clamp-1" title={record?.kbm_name}>
                {record?.kbm_code ? `[${record.kbm_code}] ${record.kbm_name}` : "Belum ditentukan"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Pelayanan</p>
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 text-xs mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {record?.icd10_mapping_status === "VERIFIED"
                  ? "Selesai Pelayanan (Terverifikasi)"
                  : record?.icd10_mapping_status === "AUTO_MAPPED"
                  ? "Selesai (Auto-Mapped)"
                  : "Dalam Pelayanan"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Tab Navigation Bar (SOAP Flow) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50">
          {/* Tab 1: Triage */}
          <button
            type="button"
            onClick={() => setActiveTab("triage")}
            className={cn(
              "flex-1 min-w-[170px] py-4 px-4 text-xs flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer",
              activeTab === "triage"
                ? "text-cyan-800 bg-cyan-50/70 border-cyan-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 border-transparent font-bold"
            )}
          >
            <HeartPulse className="h-4 w-4 text-cyan-600" />
            <span>1. Asesmen Triage</span>
            {hasTriage && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-0.5" />}
          </button>

          {/* Tab 2: Diagnosa */}
          <button
            type="button"
            onClick={() => setActiveTab("diagnosis")}
            className={cn(
              "flex-1 min-w-[170px] py-4 px-4 text-xs flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer",
              activeTab === "diagnosis"
                ? "text-indigo-800 bg-indigo-50/70 border-indigo-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 border-transparent font-bold"
            )}
          >
            <Stethoscope className="h-4 w-4 text-indigo-600" />
            <span>2. Diagnosa Medis</span>
            {hasDiagnosis && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-0.5" />}
          </button>

          {/* Tab 3: Tindakan */}
          <button
            type="button"
            onClick={() => setActiveTab("actions")}
            className={cn(
              "flex-1 min-w-[170px] py-4 px-4 text-xs flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer",
              activeTab === "actions"
                ? "text-emerald-800 bg-emerald-50/70 border-emerald-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 border-transparent font-bold"
            )}
          >
            <Syringe className="h-4 w-4 text-emerald-600" />
            <span>3. Tindakan & Tarif</span>
            {hasActions && (
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                {record?.actions.length}
              </span>
            )}
          </button>

          {/* Tab 4: E-Resep */}
          <button
            type="button"
            onClick={() => setActiveTab("prescription")}
            className={cn(
              "flex-1 min-w-[170px] py-4 px-4 text-xs flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer",
              activeTab === "prescription"
                ? "text-violet-800 bg-violet-50/70 border-violet-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 border-transparent font-bold"
            )}
          >
            <Pill className="h-4 w-4 text-violet-600" />
            <span>4. E-Resep Obat</span>
          </button>

          {/* Tab 5: Rencana & Resume */}
          <button
            type="button"
            onClick={() => setActiveTab("disposition")}
            className={cn(
              "flex-1 min-w-[170px] py-4 px-4 text-xs flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer",
              activeTab === "disposition"
                ? "text-teal-800 bg-teal-50/70 border-teal-600 font-extrabold shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 border-transparent font-bold"
            )}
          >
            <FileCheck className="h-4 w-4 text-teal-600" />
            <span>5. Rencana & Resume</span>
          </button>
        </div>

        {/* Tab Content Panes */}
        <div className="p-6">
          {activeTab === "triage" && (
            <TriageForm 
              encounterNo={encounterNo!} 
              initialData={record?.triage}
              onSuccess={fetchRecord}
            />
          )}

          {activeTab === "diagnosis" && (
            <DiagnosisForm 
              encounterNo={encounterNo!} 
              deptCode={poliCode || ""}
              initialKbmCode={record?.kbm_code}
              initialKbmName={record?.kbm_name}
              initialNotes={record?.notes}
              initialSecondaryDiagnoses={record?.secondary_diagnoses}
              onSuccess={fetchRecord}
            />
          )}

          {activeTab === "actions" && (
            <ActionForm 
              encounterNo={encounterNo!}
              deptCode={poliCode || ""}
              existingActions={record?.actions}
              onSuccess={fetchRecord}
            />
          )}

          {activeTab === "prescription" && (
            <PrescriptionForm
              encounterNo={encounterNo!}
              deptCode={poliCode || ""}
              existingPrescriptions={record?.prescriptions}
              onSuccess={fetchRecord}
            />
          )}

          {activeTab === "disposition" && (
            <ResumeDispositionForm
              encounterNo={encounterNo!}
              record={record}
              onSuccess={fetchRecord}
            />
          )}
        </div>
      </div>
    </div>
  );
}
