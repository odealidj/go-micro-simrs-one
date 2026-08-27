import { useState, useEffect } from "react";
import { searchICD10, addEncounterDiagnosis, updateEncounterDiagnosis, removeEncounterDiagnosis, finalizeSeverity } from "../api/rawatJalanApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EncounterDiagnosis } from "../types";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Search,
  Save,
  CheckCircle,
  Stethoscope,
  Trash2,
  AlertCircle,
  Plus,
  Layers,
  Edit2,
  Lock,
} from "lucide-react";

interface DiagnosisFormProps {
  encounterNo: string;
  deptCode: string;
  diagnoses?: EncounterDiagnosis[];
  encounterSeverityLevel?: string;
  readOnly?: boolean;
  onSuccess?: () => void;
}

export function DiagnosisForm({
  encounterNo,
  deptCode,
  diagnoses = [],
  encounterSeverityLevel,
  readOnly = false,
  onSuccess
}: DiagnosisFormProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Form states for adding/editing
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [selectedIcd10, setSelectedIcd10] = useState<{code: string, name: string} | null>(null);
  const [diagnosisType, setDiagnosisType] = useState<string>("PRIMARY");
  const [severityLevel, setSeverityLevel] = useState<string>("I");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [searchResults, setSearchResults] = useState<{ code: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Overall encounter severity finalization
  const [finalSeverity, setFinalSeverity] = useState(encounterSeverityLevel || "I");
  const [finalizing, setFinalizing] = useState(false);

  // Search ICD-10
  useEffect(() => {
    const fetchIcd10 = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await searchICD10(debouncedSearch, deptCode);
        setSearchResults(results);
      } catch (err) {
        console.error("Search ICD10 Error", err);
      } finally {
        setSearching(false);
      }
    };
    fetchIcd10();
  }, [debouncedSearch, deptCode]);

  const resetForm = () => {
    setSelectedIcd10(null);
    setSearchQuery("");
    setDiagnosisType("PRIMARY");
    setSeverityLevel("I");
    setClinicalNotes("");
    setIsEditing(false);
    setEditId(null);
  };

  const handleEditClick = (d: EncounterDiagnosis) => {
    setSelectedIcd10({ code: d.icd10_code, name: d.icd10_name });
    setDiagnosisType(d.diagnosis_type);
    setSeverityLevel(d.severity_level);
    setClinicalNotes(d.clinical_notes);
    setEditId(d.id);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIcd10) {
      setError("Silakan pilih Diagnosa (ICD-10) terlebih dahulu.");
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
        setSuccessMsg("Diagnosa berhasil diperbarui.");
      } else {
        await addEncounterDiagnosis(
          encounterNo,
          selectedIcd10.code,
          diagnosisType,
          severityLevel,
          clinicalNotes
        );
        setSuccessMsg("Diagnosa berhasil ditambahkan.");
      }
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal menyimpan diagnosa");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Hapus diagnosa ini?")) return;
    setLoading(true);
    setError(null);
    try {
      await removeEncounterDiagnosis(id);
      setSuccessMsg("Diagnosa berhasil dihapus.");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal menghapus diagnosa");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeSeverity = async () => {
    if (!confirm(`Finalisasi tingkat keparahan pertemuan ini menjadi Level ${finalSeverity}?`)) return;
    setFinalizing(true);
    setError(null);
    try {
      await finalizeSeverity(encounterNo, finalSeverity);
      setSuccessMsg("Tingkat keparahan berhasil difinalisasi.");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal memfinalisasi keparahan");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-lg">Diagnosa Medis (ICD-10)</h3>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          ICD-10 First & Auto KBM
        </span>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
          <div>
            <h4 className="font-medium">Berhasil</h4>
            <p className="text-sm mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* List of Diagnoses */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Layers className="h-4 w-4" /> Daftar Diagnosa
        </h4>
        
        {diagnoses.length > 0 ? (
          <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            {diagnoses.map((d) => (
              <div key={d.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs gap-4">
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                      {d.icd10_code}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{d.icd10_name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                      d.diagnosis_type === "PRIMARY" ? "bg-emerald-100 text-emerald-800" :
                      d.diagnosis_type === "SECONDARY" ? "bg-amber-100 text-amber-800" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {d.diagnosis_type}
                    </span>
                  </div>
                  
                  {d.clinical_notes && (
                    <div className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">
                      {d.clinical_notes}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-600">Severity:</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{d.severity_level}</span>
                    </div>
                    {d.auto_kbm_code && (
                      <div className="flex items-center gap-1" title={d.auto_kbm_name}>
                        <span className="font-semibold text-slate-600">Auto-KBM:</span>
                        <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100">{d.auto_kbm_code}</span>
                      </div>
                    )}
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditClick(d)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(d.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50 border border-transparent hover:border-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
            <p className="text-sm text-slate-500">Belum ada diagnosa yang ditambahkan.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Form */}
      {!readOnly && (
        <form onSubmit={handleSubmit} className="p-5 border border-indigo-100 bg-indigo-50/30 rounded-xl space-y-4">
          <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-2 mb-2">
            {isEditing ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
            {isEditing ? "Edit Diagnosa" : "Tambah Diagnosa Baru"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Pilih ICD-10 <span className="text-red-500">*</span>
              </label>
              
              {selectedIcd10 && !isEditing ? (
                <div className="flex items-center justify-between p-3.5 border border-indigo-200 bg-white rounded-xl shadow-sm">
                  <div>
                    <span className="font-bold text-indigo-700 mr-2 text-sm">[{selectedIcd10.code}]</span>
                    <span className="text-slate-800 text-sm font-medium">{selectedIcd10.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIcd10(null);
                      setSearchQuery("");
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2.5 py-1 bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Ganti
                  </button>
                </div>
              ) : isEditing ? (
                <div className="flex items-center justify-between p-3.5 border border-slate-200 bg-slate-100 rounded-xl">
                   <div>
                    <span className="font-bold text-slate-700 mr-2 text-sm">[{selectedIcd10?.code}]</span>
                    <span className="text-slate-800 text-sm font-medium">{selectedIcd10?.name}</span>
                  </div>
                  <span className="text-xs text-slate-500 italic">Tidak dapat diubah saat edit</span>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Ketik kode atau nama ICD-10..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="pl-10 h-11 rounded-xl bg-white"
                  />
                  
                  {showDropdown && searchQuery.length >= 2 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {searching ? (
                        <div className="p-4 text-xs text-slate-500 text-center">Mencari ICD-10...</div>
                      ) : searchResults.length > 0 ? (
                        <ul className="divide-y divide-slate-100 text-sm">
                          {searchResults.map(item => (
                            <li 
                              key={item.code}
                              onClick={() => {
                                setSelectedIcd10({ code: item.code, name: item.name });
                                setShowDropdown(false);
                              }}
                              className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                            >
                              <div className="font-medium text-slate-800">{item.name}</div>
                              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                                {item.code}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-4 text-xs text-slate-500 text-center">ICD-10 tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Jenis Diagnosa <span className="text-red-500">*</span>
              </label>
              <select
                value={diagnosisType}
                onChange={(e) => setDiagnosisType(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="PRIMARY">Utama (Primary)</option>
                <option value="SECONDARY">Sekunder (Secondary/Comorbid)</option>
                <option value="DIFFERENTIAL">Banding (Differential)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Tingkat Keparahan <span className="text-red-500">*</span>
              </label>
              <select
                value={severityLevel}
                onChange={(e) => setSeverityLevel(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="I">Level I (Ringan)</option>
                <option value="II">Level II (Sedang)</option>
                <option value="III">Level III (Berat)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Catatan Klinis (SOAP / Keterangan)
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full h-24 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none placeholder:text-slate-400"
                placeholder="Tambahkan keterangan spesifik untuk diagnosa ini..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
            {isEditing && (
              <Button 
                type="button" 
                variant="outline"
                onClick={resetForm}
                className="bg-white"
              >
                Batal Edit
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading || !selectedIcd10}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Save className="h-4 w-4" />
              {loading ? "Menyimpan..." : (isEditing ? "Simpan Perubahan" : "Tambahkan Diagnosa")}
            </Button>
          </div>
        </form>
      )}

      {/* Encounter Severity Finalization Section (for doctors) */}
      {!readOnly && diagnoses.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-600" />
            Finalisasi Tingkat Keparahan Pertemuan
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Tentukan tingkat keparahan utama pasien untuk kunjungan ini. Jika telah selesai, Anda dapat memfinalisasinya.
          </p>
          <div className="flex items-center gap-3">
            <select
              value={finalSeverity}
              onChange={(e) => setFinalSeverity(e.target.value)}
              disabled={!!encounterSeverityLevel}
              className="w-48 h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none disabled:bg-slate-100"
            >
              <option value="I">Level I (Ringan)</option>
              <option value="II">Level II (Sedang)</option>
              <option value="III">Level III (Berat)</option>
            </select>
            <Button
              type="button"
              onClick={handleFinalizeSeverity}
              disabled={finalizing || !!encounterSeverityLevel}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm h-10"
            >
              <CheckCircle className="h-4 w-4" />
              {finalizing ? "Memproses..." : encounterSeverityLevel ? "Sudah Final" : "Finalisasi"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
