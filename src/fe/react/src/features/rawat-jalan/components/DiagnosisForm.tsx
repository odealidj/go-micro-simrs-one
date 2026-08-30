import { useState, useEffect } from "react";
import {
  searchICD10,
  searchKBM,
  addEncounterDiagnosis,
  updateEncounterDiagnosis,
  removeEncounterDiagnosis,
  promoteDiagnosisToPrimary,
  type ICD10SearchResult,
} from "../api/rawatJalanApi";
import { getICD10Mappings, type ICD10MappingDetailsResponse } from "@/lib/masterDataApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EncounterDiagnosis } from "../types";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import {
  Search,
  Save,
  CheckCircle,
  Stethoscope,
  Trash2,
  AlertCircle,
  AlertTriangle,
  HeartPulse,
  Plus,
  Layers,
  Edit2,
  ArrowUpCircle,
  Sparkles,
  Globe,
  Building2,
  Activity,
  ShieldCheck,
  X,
  Loader2,
} from "lucide-react";

interface DiagnosisFormProps {
  encounterNo: string;
  deptCode: string;
  diagnoses?: EncounterDiagnosis[];
  encounterSeverityLevel?: string;
  readOnly?: boolean;
  onSuccess?: () => void;
  hasTriage?: boolean;
  onNavigateTriage?: () => void;
}

type SearchFilterMode = "POLI" | "ALL" | "KBM";

export function DiagnosisForm({
  encounterNo,
  deptCode,
  diagnoses = [],
  readOnly = false,
  onSuccess,
  hasTriage = true,
  onNavigateTriage,
}: DiagnosisFormProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal confirmation states
  const [deleteTarget, setDeleteTarget] = useState<EncounterDiagnosis | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<EncounterDiagnosis | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  // Form states for adding/editing
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [selectedIcd10, setSelectedIcd10] = useState<{
    code: string;
    name: string;
    name_en?: string;
  } | null>(null);
  
  // Mapping preview details (SNOMED-CT & KBM)
  const [mappingDetails, setMappingDetails] = useState<ICD10MappingDetailsResponse | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [selectedSnomedId, setSelectedSnomedId] = useState<string>("");
  const [selectedKbmCode, setSelectedKbmCode] = useState<string>("");

  // Categorized Diagnoses
  const primaryDiagnosis = diagnoses.find((d) => d.diagnosis_type === "PRIMARY");
  const secondaryDiagnoses = diagnoses.filter((d) => d.diagnosis_type !== "PRIMARY");

  // Default diagnosis type: PRIMARY if none exists, else SECONDARY
  const [diagnosisType, setDiagnosisType] = useState<string>(
    primaryDiagnosis ? "SECONDARY" : "PRIMARY"
  );
  const [severityLevel, setSeverityLevel] = useState<string>("I");
  const [clinicalNotes, setClinicalNotes] = useState("");

  // Search & Filters
  const [filterMode, setFilterMode] = useState<SearchFilterMode>("POLI");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [searchResults, setSearchResults] = useState<ICD10SearchResult[]>([]);
  const [kbmResults, setKbmResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);



  // Collapsible form visibility (opens on-demand via header [+] or [Edit])
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Auto-switch default diagnosis type when primary is added or removed
  useEffect(() => {
    if (!isEditing) {
      setDiagnosisType(primaryDiagnosis ? "SECONDARY" : "PRIMARY");
    }
  }, [primaryDiagnosis, isEditing]);

  // Search ICD-10 or KBM according to filterMode
  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setSearchResults([]);
        setKbmResults([]);
        return;
      }
      setSearching(true);
      try {
        if (filterMode === "KBM") {
          const results = await searchKBM(debouncedSearch, deptCode);
          setKbmResults(results);
          setSearchResults([]);
        } else if (filterMode === "POLI") {
          const results = await searchICD10(debouncedSearch, deptCode);
          setSearchResults(results);
          setKbmResults([]);
        } else {
          // ALL ICD-10
          const results = await searchICD10(debouncedSearch, undefined);
          setSearchResults(results);
          setKbmResults([]);
        }
      } catch (err) {
        console.error("Search Diagnosa Error", err);
      } finally {
        setSearching(false);
      }
    };
    fetchResults();
  }, [debouncedSearch, filterMode, deptCode]);

  // Fetch ICD-10 mappings (SNOMED-CT & KBM) when an ICD-10 is selected
  useEffect(() => {
    if (!selectedIcd10) {
      setMappingDetails(null);
      setSelectedSnomedId("");
      setSelectedKbmCode("");
      return;
    }

    const loadMappings = async () => {
      setLoadingMapping(true);
      try {
        const details = await getICD10Mappings(selectedIcd10.code);
        setMappingDetails(details);
        if (details?.snomed_mappings && details.snomed_mappings.length > 0) {
          setSelectedSnomedId(details.snomed_mappings[0].concept_id);
        }
        if (details?.kbm_mappings && details.kbm_mappings.length > 0) {
          const primaryKbm = details.kbm_mappings.find((k) => k.is_primary);
          setSelectedKbmCode(primaryKbm ? primaryKbm.kbm_code : details.kbm_mappings[0].kbm_code);
        }
      } catch (err) {
        console.error("Failed to load ICD-10 mappings", err);
      } finally {
        setLoadingMapping(false);
      }
    };

    loadMappings();
  }, [selectedIcd10]);

  const resetForm = () => {
    setSelectedIcd10(null);
    setMappingDetails(null);
    setSelectedSnomedId("");
    setSelectedKbmCode("");
    setSearchQuery("");
    setDiagnosisType(primaryDiagnosis ? "SECONDARY" : "PRIMARY");
    setSeverityLevel("I");
    setClinicalNotes("");
    setIsEditing(false);
    setEditId(null);
  };

  const handleEditClick = (d: EncounterDiagnosis) => {
    setSelectedIcd10({
      code: d.icd10_code,
      name: d.icd10_name,
    });
    setDiagnosisType(d.diagnosis_type);
    setSeverityLevel(d.severity_level);
    setClinicalNotes(d.clinical_notes);
    setEditId(d.id);
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleOpenAdd = (type: "PRIMARY" | "SECONDARY") => {
    resetForm();
    setDiagnosisType(type);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIcd10) {
      setError("Silakan pilih Diagnosa (ICD-10) terlebih dahulu.");
      toast.error("Silakan pilih Diagnosa (ICD-10) terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg("");

    try {
      if (isEditing && editId) {
        await updateEncounterDiagnosis(
          editId,
          diagnosisType,
          severityLevel,
          clinicalNotes
        );
        toast.success("Diagnosa berhasil diperbarui.");
        setSuccessMsg("Diagnosa berhasil diperbarui.");
      } else {
        await addEncounterDiagnosis(
          encounterNo,
          selectedIcd10.code,
          diagnosisType,
          severityLevel,
          clinicalNotes,
          selectedSnomedId || undefined,
          selectedKbmCode || undefined
        );
        toast.success("Diagnosa berhasil ditambahkan.");
        setSuccessMsg("Diagnosa berhasil ditambahkan.");
      }
      resetForm();
      setIsFormOpen(false);
      if (onSuccess) await onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Gagal menyimpan diagnosa";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError(null);
    try {
      await removeEncounterDiagnosis(deleteTarget.id);
      toast.success(`Diagnosa [${deleteTarget.icd10_code}] berhasil dihapus.`);
      setSuccessMsg(`Diagnosa [${deleteTarget.icd10_code}] berhasil dihapus.`);
      setDeleteTarget(null);
      if (onSuccess) await onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Gagal menghapus diagnosa";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmPromote = async () => {
    if (!promoteTarget) return;
    setIsPromoting(true);
    setError(null);
    try {
      await promoteDiagnosisToPrimary(encounterNo, promoteTarget.id);
      toast.success(`[${promoteTarget.icd10_code}] berhasil dijadikan sebagai Diagnosa Utama.`);
      setSuccessMsg(`Berhasil menjadikan [${promoteTarget.icd10_code}] sebagai Diagnosa Utama.`);
      setPromoteTarget(null);
      if (onSuccess) await onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Gagal menukar diagnosa utama";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPromoting(false);
    }
  };



  const getSubtypeBadge = (type: string) => {
    switch (type) {
      case "PRIMARY":
        return {
          label: "Diagnosa Utama",
          className: "bg-emerald-100 text-emerald-800 border-emerald-200",
        };
      case "SECONDARY":
        return {
          label: "Sekunder / Komorbid",
          className: "bg-blue-100 text-blue-800 border-blue-200",
        };
      case "COMORBIDITY":
        return {
          label: "Komorbiditas",
          className: "bg-amber-100 text-amber-800 border-amber-200",
        };
      case "COMPLICATION":
        return {
          label: "Komplikasi",
          className: "bg-rose-100 text-rose-800 border-rose-200",
        };
      case "DIFFERENTIAL":
        return {
          label: "Diagnosa Banding",
          className: "bg-purple-100 text-purple-800 border-purple-200",
        };
      default:
        return {
          label: type,
          className: "bg-slate-100 text-slate-700 border-slate-200",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Entri Diagnosa Medis Pasien</h3>
            <p className="text-xs text-slate-500">
              Standar 3 Pilar: ICD-10 (WHO) • SNOMED-CT (SATUSEHAT Kemenkes) • Auto-KBM (INA-CBGs)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Mapping Enabled
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 shadow-2xs">
          <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Aksi Berhasil</h4>
            <p className="text-xs mt-0.5">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3 text-sm shadow-2xs">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Terjadi Kesalahan</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── SECTION 1: DIAGNOSA UTAMA (PRIMARY) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            🌟 Diagnosa Utama (Primary Diagnosis)
            <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Wajib 1 Diagnosa
            </span>
          </h4>

          {/* Tombol [+] hanya muncul jika Diagnosa Utama masih KOSONG (dibatasi 1) */}
          {!primaryDiagnosis && !readOnly && hasTriage && !isFormOpen && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenAdd("PRIMARY")}
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 cursor-pointer font-semibold shadow-2xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Diagnosa
            </Button>
          )}
        </div>

        {primaryDiagnosis ? (
          <div className="p-4 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 border-2 border-emerald-300/80 rounded-2xl shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-white bg-emerald-600 px-2.5 py-1 rounded-lg tracking-wide shadow-2xs">
                    {primaryDiagnosis.icd10_code}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {primaryDiagnosis.icd10_name}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    DIAGNOSA UTAMA
                  </span>
                </div>

                {primaryDiagnosis.clinical_notes && (
                  <p className="text-xs text-slate-600 italic bg-white/80 p-2.5 rounded-lg border border-slate-100">
                    💬 {primaryDiagnosis.clinical_notes}
                  </p>
                )}

                {/* 3-Pillar Badges for Primary */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* SNOMED-CT Badge */}
                  <div className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg">
                    <Globe className="h-3.5 w-3.5 text-purple-600" />
                    <span className="font-semibold">SNOMED SATUSEHAT:</span>
                    <span>
                      {primaryDiagnosis.snomed_concept_id
                        ? `${primaryDiagnosis.snomed_concept_id} ${
                            primaryDiagnosis.snomed_name ? `(${primaryDiagnosis.snomed_name})` : ""
                          }`
                        : "Mapped via Code"}
                    </span>
                  </div>

                  {/* KBM INA-CBGs Badge */}
                  {primaryDiagnosis.auto_kbm_code && (
                    <div className="flex items-center gap-1.5 text-xs bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg">
                      <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                      <span className="font-semibold">Auto-KBM:</span>
                      <span>
                        [{primaryDiagnosis.auto_kbm_code}] {primaryDiagnosis.auto_kbm_name}
                      </span>
                    </div>
                  )}

                  {/* Severity Badge */}
                  <div className="flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                    <span className="font-semibold">Severity:</span>
                    <span>Level {primaryDiagnosis.severity_level}</span>
                  </div>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(primaryDiagnosis)}
                    className="h-8 px-2.5 text-xs border-slate-200 hover:bg-slate-50 gap-1.5 cursor-pointer shadow-2xs font-medium"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(primaryDiagnosis)}
                    className="h-8 px-2.5 text-xs text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 gap-1.5 cursor-pointer shadow-2xs font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50/70 border border-dashed border-amber-300 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>
              <strong>Belum ada Diagnosa Utama.</strong> Klik tombol <strong>[+ Tambah Diagnosa]</strong> di sudut kanan atas untuk menetapkan diagnosa utama pertemuan.
            </span>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: DIAGNOSA SEKUNDER / KOMORBIDITAS / KOMPLIKASI ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            Diagnosa Sekunder, Komorbiditas & Penyulit
            <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {secondaryDiagnoses.length} Diagnosa
            </span>
          </h4>

          {/* Tombol [+] selalu ada untuk Diagnosa Sekunder (bisa multiple) */}
          {!readOnly && hasTriage && !isFormOpen && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenAdd("SECONDARY")}
              className="h-8 px-3 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl gap-1.5 cursor-pointer font-semibold shadow-2xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Diagnosa
            </Button>
          )}
        </div>

        {secondaryDiagnoses.length > 0 ? (
          <div className="space-y-2.5">
            {secondaryDiagnoses.map((d) => {
              const subtype = getSubtypeBadge(d.diagnosis_type);
              return (
                <div
                  key={d.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                        {d.icd10_code}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{d.icd10_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${subtype.className}`}
                      >
                        {subtype.label}
                      </span>
                    </div>

                    {d.clinical_notes && (
                      <p className="text-xs text-slate-500 italic pl-2 border-l-2 border-slate-200">
                        {d.clinical_notes}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-0.5">
                      {d.snomed_concept_id && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">
                          SNOMED: {d.snomed_concept_id}
                        </span>
                      )}
                      {d.auto_kbm_code && (
                        <span
                          className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100"
                          title={d.auto_kbm_name}
                        >
                          Auto-KBM: {d.auto_kbm_code}
                        </span>
                      )}
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Severity: {d.severity_level}
                      </span>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPromoteTarget(d)}
                        className="h-8 px-2.5 text-xs text-emerald-700 bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 gap-1.5 shadow-2xs cursor-pointer font-medium"
                        title="Tukar diagnosa ini menjadi Diagnosa Utama"
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />
                        Jadikan Utama
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditClick(d)}
                        className="h-8 px-2.5 text-xs text-slate-600 border-slate-200 hover:bg-slate-50 gap-1.5 cursor-pointer shadow-2xs font-medium"
                        title="Edit Diagnosa"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteTarget(d)}
                        className="h-8 px-2.5 text-xs text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300 gap-1.5 cursor-pointer shadow-2xs font-medium"
                        title="Hapus Diagnosa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
            <p className="text-xs text-slate-400">
              Belum ada diagnosa sekunder/komorbiditas. Klik tombol <strong>[+ Tambah Diagnosa]</strong> di atas jika pasien memiliki penyakit penyerta.
            </p>
          </div>
        )}
      </div>

      {/* ─── TRIAGE MANDATORY WARNING ─── */}
      {!hasTriage && !readOnly && (
        <div className="p-6 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col items-center justify-center text-center gap-3 my-2 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h4 className="text-sm font-bold text-amber-950">Asesmen Triage Belum Ada di Database</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              Sesuai standar operasional pelayanan medis, data Asesmen Triage awal (tanda-tanda vital)
              wajib diisi dan disimpan ke database terlebih dahulu sebelum dokter dapat mengentri
              diagnosa medis (ICD-10).
            </p>
          </div>
          {onNavigateTriage && (
            <Button
              type="button"
              onClick={onNavigateTriage}
              className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold gap-2 cursor-pointer shadow-xs"
            >
              <HeartPulse className="h-4 w-4" />
              Isi Asesmen Triage Terlebih Dahulu
            </Button>
          )}
        </div>
      )}

      {/* ─── SECTION 3: ADD / EDIT DIAGNOSIS FORM WITH MULTI-MODE FILTER ─── */}
      {!readOnly && hasTriage && isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="p-5 border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 rounded-2xl space-y-5 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-indigo-100/70">
            <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
              {isEditing ? <Edit2 className="h-4 w-4 text-indigo-600" /> : <Plus className="h-4 w-4 text-indigo-600" />}
              {isEditing
                ? `Edit Diagnosa [${selectedIcd10?.code || ""}]`
                : diagnosisType === "PRIMARY"
                ? "Entri Diagnosa Utama (Primary Diagnosis)"
                : "Entri Diagnosa Sekunder / Komorbiditas"}
            </h4>

            <div className="flex items-center gap-2">
              {isEditing && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold">
                  Sedang Mode Edit
                </span>
              )}
              {diagnoses.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                  className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 gap-1 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Tutup Form
                </Button>
              )}
            </div>
          </div>

          {/* Search Filter Tabs */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mode Pencarian Katalog
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("POLI");
                    setSearchQuery("");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    filterMode === "POLI"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  🏥 Sesuai Poli ({deptCode || "Aktif"})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("ALL");
                    setSearchQuery("");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    filterMode === "ALL"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  🌐 Semua ICD-10 & SNOMED
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("KBM");
                    setSearchQuery("");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    filterMode === "KBM"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  📂 Telusuri via Organ / KBM
                </button>
              </div>
            </div>
          )}

          {/* Autocomplete Input & Selected Preview */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pilih Diagnosa (ICD-10) <span className="text-red-500">*</span>
            </label>

            {selectedIcd10 && !isEditing ? (
              <div className="p-4 border-2 border-indigo-200 bg-white rounded-2xl shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-indigo-700 text-sm bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        {selectedIcd10.code}
                      </span>
                      <span className="font-bold text-slate-900 text-base">
                        {selectedIcd10.name}
                      </span>
                    </div>
                    {selectedIcd10.name_en && selectedIcd10.name_en !== selectedIcd10.name && (
                      <p className="text-xs text-slate-500 italic">{selectedIcd10.name_en}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIcd10(null);
                      setMappingDetails(null);
                      setSearchQuery("");
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Ganti Pilihan
                  </button>
                </div>

                {/* ─── LIVE PREVIEW CARD 3 PILAR ─── */}
                <div className="p-3.5 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-purple-50/20 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>Live Preview Pemetaan Otomatis (3 Pilar):</span>
                  </div>

                  {loadingMapping ? (
                    <div className="p-2 text-slate-500 text-center animate-pulse">
                      Memuat pemetaan SNOMED-CT & KBM...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* SNOMED-CT mapping */}
                      <div className="p-2.5 bg-white border border-purple-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-purple-900 font-bold">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5 text-purple-600" />
                            SNOMED-CT SATUSEHAT
                          </span>
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                            {mappingDetails?.snomed_mappings?.length || 0} Konsep
                          </span>
                        </div>
                        {mappingDetails?.snomed_mappings &&
                        mappingDetails.snomed_mappings.length > 0 ? (
                          <div className="text-[11px] text-slate-700">
                            <span className="font-semibold text-purple-800">
                              ID: {mappingDetails.snomed_mappings[0].concept_id}
                            </span>
                            <p className="text-slate-600 truncate">
                              {mappingDetails.snomed_mappings[0].fsn}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">
                            Belum terpetakan langsung ke SNOMED.
                          </p>
                        )}
                      </div>

                      {/* Auto-KBM mapping */}
                      <div className="p-2.5 bg-white border border-teal-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-teal-900 font-bold">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                            Prediksi KBM (INA-CBGs)
                          </span>
                          <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">
                            {mappingDetails?.kbm_mappings?.length || 0} Grup
                          </span>
                        </div>
                        {mappingDetails?.kbm_mappings && mappingDetails.kbm_mappings.length > 0 ? (
                          <div className="text-[11px] text-slate-700">
                            <span className="font-semibold text-teal-800">
                              Kode: {mappingDetails.kbm_mappings[0].kbm_code}
                            </span>
                            <p className="text-slate-600 truncate">
                              {mappingDetails.kbm_mappings[0].kbm_name}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">
                            Belum terpetakan ke KBM.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : isEditing ? (
              <div className="flex items-center justify-between p-3.5 border border-slate-200 bg-slate-100 rounded-xl">
                <div>
                  <span className="font-bold text-slate-700 mr-2 text-sm">
                    [{selectedIcd10?.code}]
                  </span>
                  <span className="text-slate-800 text-sm font-medium">{selectedIcd10?.name}</span>
                </div>
                <span className="text-xs text-slate-500 italic">Kode ICD tidak dapat diubah saat edit</span>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder={
                    filterMode === "KBM"
                      ? "Ketik nama organ / keluhan / kode KBM..."
                      : filterMode === "POLI"
                      ? `Ketik nama/kode ICD-10 untuk poli ${deptCode}...`
                      : "Ketik nama/kode ICD-10 atau konsep SNOMED..."
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="pl-10 h-11 rounded-xl bg-white border-slate-300 focus:border-indigo-500"
                />

                {showDropdown && searchQuery.length >= 2 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto">
                    {searching ? (
                      <div className="p-4 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
                        <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                        Mencari katalog diagnosa...
                      </div>
                    ) : filterMode === "KBM" ? (
                      kbmResults.length > 0 ? (
                        <ul className="divide-y divide-slate-100 text-sm">
                          {kbmResults.map((item: any) => (
                            <li
                              key={item.kbm_code}
                              onClick={() => {
                                setSelectedIcd10({
                                  code: item.kbm_code,
                                  name: item.kbm_name,
                                });
                                setShowDropdown(false);
                              }}
                              className="p-3 hover:bg-teal-50/60 cursor-pointer flex justify-between items-center transition-colors gap-3"
                            >
                              <div>
                                <div className="font-semibold text-slate-900">{item.kbm_name}</div>
                                <div className="text-xs text-slate-500">
                                  Organ/Sistem: {item.body_system || "Umum"}
                                </div>
                              </div>
                              <span className="text-xs font-bold bg-teal-100 text-teal-800 px-2.5 py-1 rounded-md">
                                KBM: {item.kbm_code}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-4 text-xs text-slate-500 text-center">
                          KBM tidak ditemukan untuk kata kunci "{searchQuery}"
                        </div>
                      )
                    ) : searchResults.length > 0 ? (
                      <ul className="divide-y divide-slate-100 text-sm">
                        {searchResults.map((item) => (
                          <li
                            key={item.code}
                            onClick={() => {
                              setSelectedIcd10({
                                code: item.code,
                                name: item.name,
                                name_en: item.name_en,
                              });
                              setShowDropdown(false);
                            }}
                            className="p-3 hover:bg-indigo-50/70 cursor-pointer flex flex-col gap-1 transition-colors"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-md shrink-0">
                                {item.code}
                              </span>
                            </div>
                            {item.name_en && item.name_en !== item.name && (
                              <div className="text-xs text-slate-500 italic">{item.name_en}</div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              {item.snomed_count && item.snomed_count > 0 ? (
                                <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                  SNOMED: {item.snomed_count}
                                </span>
                              ) : null}
                              {item.kbm_count && item.kbm_count > 0 ? (
                                <span className="text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                                  Auto-KBM: {item.kbm_count}
                                </span>
                              ) : null}
                              {item.polyclinics && item.polyclinics.length > 0 && (
                                <span>Poli: {item.polyclinics.join(", ")}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-xs text-slate-500 text-center">
                        Diagnosa tidak ditemukan untuk kata kunci "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Fields: Jenis Diagnosa, Severity, Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Jenis Diagnosa <span className="text-red-500">*</span>
              </label>
              <select
                value={diagnosisType}
                onChange={(e) => setDiagnosisType(e.target.value)}
                className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="PRIMARY">🌟 Utama (Primary Diagnosis)</option>
                <option value="SECONDARY">Sekunder / Komorbiditas (Secondary)</option>
                <option value="COMORBIDITY">Penyakit Penyerta (Comorbidity)</option>
                <option value="COMPLICATION">Komplikasi / Penyulit (Complication)</option>
                <option value="DIFFERENTIAL">Diagnosa Banding (Differential)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {diagnosisType === "PRIMARY"
                  ? "Akan menggantikan diagnosa utama sebelumnya secara otomatis."
                  : "Dapat ditambahkan sebanyak yang diperlukan untuk riwayat klinis."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tingkat Keparahan (Severity) <span className="text-red-500">*</span>
              </label>
              <select
                value={severityLevel}
                onChange={(e) => setSeverityLevel(e.target.value)}
                className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="I">Level I - Ringan (Mild / Simple)</option>
                <option value="II">Level II - Sedang (Moderate)</option>
                <option value="III">Level III - Berat (Severe / Complex)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan Klinis (SOAP / Keterangan Dokter)
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full h-20 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none placeholder:text-slate-400"
                placeholder="Tambahkan catatan temuan klinis, onset, atau rasionalisasi diagnosa..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            {isEditing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(false);
                }}
                className="bg-white"
              >
                Batal Edit
              </Button>
            ) : diagnoses.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(false);
                }}
                className="bg-white"
              >
                Batal
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={loading || !selectedIcd10}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 h-11 rounded-xl shadow-xs cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {loading
                ? "Menyimpan..."
                : isEditing
                ? "Simpan Perubahan"
                : diagnosisType === "PRIMARY"
                ? "Simpan Sebagai Diagnosa Utama"
                : "Tambahkan Diagnosa Sekunder"}
            </Button>
          </div>
        </form>
      )}



      {/* ─── MODAL CONFIRMATION: DELETE DIAGNOSIS ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-xl">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Hapus Diagnosa Medis?</h4>
                <p className="text-xs text-slate-500">Tindakan ini akan menghapus diagnosa dari rekam medis pertemuan.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  {deleteTarget.icd10_code}
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {deleteTarget.icd10_name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 pt-1">
                <span>Tipe: <strong>{deleteTarget.diagnosis_type}</strong></span>
                <span>•</span>
                <span>Severity: Level {deleteTarget.severity_level}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 cursor-pointer shadow-xs"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDeleting ? "Menghapus..." : "Ya, Hapus Diagnosa"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CONFIRMATION: PROMOTE DIAGNOSIS TO PRIMARY ─── */}
      {promoteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <ArrowUpCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Jadikan Diagnosa Utama?</h4>
                <p className="text-xs text-slate-500">Diagnosa utama saat ini akan otomatis dipindahkan menjadi sekunder.</p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                  {promoteTarget.icd10_code}
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {promoteTarget.icd10_name}
                </span>
              </div>
              <p className="text-slate-500 pt-1">
                Diagnosa ini akan memiliki urutan prioritas pertama (Sequence 1) untuk resume medis dan klaim.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPromoting}
                onClick={() => setPromoteTarget(null)}
                className="cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={isPromoting}
                onClick={confirmPromote}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer shadow-xs"
              >
                {isPromoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
                {isPromoting ? "Memproses..." : "Ya, Jadikan Utama"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
