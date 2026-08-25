import { useState, useEffect } from "react";
import { searchKBM, searchICD10, addDiagnosisKBM } from "../api/emrApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KBMItem, SecondaryDiagnosis } from "../types";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Search,
  Save,
  CheckCircle,
  Stethoscope,
  Trash2,
  AlertCircle,
  Layers,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface DiagnosisFormProps {
  encounterNo: string;
  deptCode: string;
  initialKbmCode?: string;
  initialKbmName?: string;
  initialNotes?: string;
  initialSecondaryDiagnoses?: SecondaryDiagnosis[];
  readOnly?: boolean;
  onSuccess?: () => void;
}

export function DiagnosisForm({ 
  encounterNo, 
  deptCode, 
  initialKbmCode, 
  initialKbmName,
  initialNotes,
  initialSecondaryDiagnoses = [],
  readOnly = false,
  onSuccess 
}: DiagnosisFormProps) {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SOAP Notes
  const [notes, setNotes] = useState(initialNotes || "");

  // Primary Diagnosis (KBM / ICD-10)
  const [selectedKbm, setSelectedKbm] = useState<{code: string, name: string} | null>(
    initialKbmCode ? { code: initialKbmCode, name: initialKbmName || "" } : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [kbmResults, setKbmResults] = useState<KBMItem[]>([]);
  const [searchingKbm, setSearchingKbm] = useState(false);
  const [showKbmDropdown, setShowKbmDropdown] = useState(false);

  // Secondary Diagnoses List
  const [secondaryList, setSecondaryList] = useState<SecondaryDiagnosis[]>(initialSecondaryDiagnoses);
  const [searchSecQuery, setSearchSecQuery] = useState("");
  const debouncedSecSearch = useDebounce(searchSecQuery, 400);
  const [secResults, setSecResults] = useState<{ code: string; name: string }[]>([]);
  const [searchingSec, setSearchingSec] = useState(false);
  const [showSecDropdown, setShowSecDropdown] = useState(false);
  const [secCategory, setSecCategory] = useState<"KOMORBID" | "KOMPLIKASI" | "BANDING">("KOMORBID");

  // Search KBM for Primary
  useEffect(() => {
    const fetchKbm = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setKbmResults([]);
        return;
      }
      setSearchingKbm(true);
      try {
        const results = await searchKBM(debouncedSearch, deptCode);
        setKbmResults(results);
      } catch (err) {
        console.error("Search KBM Error", err);
      } finally {
        setSearchingKbm(false);
      }
    };
    fetchKbm();
  }, [debouncedSearch, deptCode]);

  // Search ICD-10 for Secondary
  useEffect(() => {
    const fetchSec = async () => {
      if (!debouncedSecSearch || debouncedSecSearch.length < 2) {
        setSecResults([]);
        return;
      }
      setSearchingSec(true);
      try {
        const results = await searchICD10(debouncedSecSearch, deptCode);
        setSecResults(results);
      } catch (err) {
        console.error("Search Secondary ICD10 Error", err);
      } finally {
        setSearchingSec(false);
      }
    };
    fetchSec();
  }, [debouncedSecSearch, deptCode]);

  const handleAddSecondary = (item: { code: string; name: string }) => {
    if (secondaryList.some(s => s.icd10_code === item.code)) {
      return;
    }
    setSecondaryList(prev => [
      ...prev,
      { icd10_code: item.code, name: item.name, category: secCategory }
    ]);
    setSearchSecQuery("");
    setShowSecDropdown(false);
  };

  const handleRemoveSecondary = (code: string) => {
    setSecondaryList(prev => prev.filter(s => s.icd10_code !== code));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKbm) {
      setError("Silakan pilih Diagnosa Utama (KBM / ICD-10) terlebih dahulu.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Append secondary diagnoses into notes metadata or call backend
      const secondaryText = secondaryList.length > 0
        ? `\n[Diagnosa Sekunder]: ${secondaryList.map(s => `${s.icd10_code} - ${s.name} (${s.category})`).join("; ")}`
        : "";
      
      const fullNotes = notes + secondaryText;

      await addDiagnosisKBM(
        encounterNo, 
        selectedKbm.code, 
        fullNotes, 
        userId || "doctor-001",
        deptCode
      );
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal menyimpan diagnosa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-lg">Pemeriksaan Fisik & Diagnosa Medis</h3>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Dapat diisi oleh Dokter / Perawat
        </span>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
          <div>
            <h4 className="font-medium">Diagnosa Tersimpan</h4>
            <p className="text-sm mt-0.5">Diagnosa utama dan sekunder berhasil diperbarui.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Anamnesa & Pemeriksaan Fisik (SOAP) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-indigo-600" />
            1. Anamnesa Lanjutan & Pemeriksaan Fisik (SOAP)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly}
            className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors resize-none placeholder:text-slate-400 disabled:opacity-75 disabled:cursor-not-allowed"
            placeholder="Tuliskan Subjective (Keluhan/RPS), Objective (Pemeriksaan Fisik/Status Lokalis), Plan..."
          />
        </div>

        {/* Diagnosa Utama (Primer) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-indigo-600" />
            2. Diagnosa Utama / Primer <span className="text-red-500">*</span>
          </label>
          
          {selectedKbm ? (
            <div className="flex items-center justify-between p-3.5 border border-indigo-200 bg-indigo-50/70 rounded-xl">
              <div>
                <span className="font-bold text-indigo-700 mr-2 text-sm">[{selectedKbm.code}]</span>
                <span className="text-slate-800 text-sm font-medium">{selectedKbm.name}</span>
                <span className="ml-2 px-2 py-0.5 bg-indigo-200/60 text-indigo-800 text-[11px] rounded-full font-semibold">
                  Diagnosa Utama
                </span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKbm(null);
                    setSearchQuery("");
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2.5 py-1 bg-white rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                >
                  Ganti Diagnosa
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder={readOnly ? "Diagnosa belum ditentukan" : "Ketik keluhan atau nama penyakit KBM..."}
                value={searchQuery}
                disabled={readOnly}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowKbmDropdown(true);
                }}
                onFocus={() => setShowKbmDropdown(true)}
                className="pl-10 h-11 rounded-xl"
              />
              
              {!readOnly && showKbmDropdown && searchQuery.length >= 2 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {searchingKbm ? (
                    <div className="p-4 text-xs text-slate-500 text-center">Mencari katalog KBM...</div>
                  ) : kbmResults.length > 0 ? (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {kbmResults.map(kbm => (
                        <li 
                          key={kbm.kbm_code}
                          onClick={() => {
                            setSelectedKbm({ code: kbm.kbm_code, name: kbm.kbm_name });
                            setShowKbmDropdown(false);
                          }}
                          className="p-3 hover:bg-indigo-50/50 cursor-pointer flex justify-between items-center transition-colors"
                        >
                          <div>
                            <div className="font-medium text-slate-800">{kbm.kbm_name}</div>
                            <div className="text-xs text-slate-500 line-clamp-1">{kbm.description}</div>
                          </div>
                          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                            {kbm.kbm_code}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-xs text-slate-500 text-center">Tidak ada diagnosa yang cocok</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Diagnosa Sekunder (Komorbid / Komplikasi) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            3. Diagnosa Sekunder / Komorbiditas (Multi-Entry)
          </label>

          {!readOnly && (
            <div className="flex gap-2 mb-3">
              <select
                value={secCategory}
                onChange={(e) => setSecCategory(e.target.value as any)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="KOMORBID">Komorbid</option>
                <option value="KOMPLIKASI">Komplikasi</option>
                <option value="BANDING">Diagnosa Banding</option>
              </select>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Cari diagnosa sekunder (ICD-10)..."
                  value={searchSecQuery}
                  onChange={(e) => {
                    setSearchSecQuery(e.target.value);
                    setShowSecDropdown(true);
                  }}
                  onFocus={() => setShowSecDropdown(true)}
                  className="pl-9 h-10 rounded-xl text-sm"
                />

                {showSecDropdown && searchSecQuery.length >= 2 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {searchingSec ? (
                      <div className="p-3 text-xs text-slate-500 text-center">Mencari ICD-10...</div>
                    ) : secResults.length > 0 ? (
                      <ul className="divide-y divide-slate-100 text-sm">
                        {secResults.map(item => (
                          <li 
                            key={item.code}
                            onClick={() => handleAddSecondary(item)}
                            className="p-2.5 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                          >
                            <span className="text-slate-800">{item.name}</span>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {item.code}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-3 text-xs text-slate-500 text-center">ICD-10 tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* List of Secondary Diagnoses */}
          {secondaryList.length > 0 ? (
            <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              {secondaryList.map((sec) => (
                <div key={sec.icd10_code} className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-lg border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {sec.icd10_code}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{sec.name}</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                      {sec.category}
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSecondary(sec.icd10_code)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded-md cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Belum ada diagnosa sekunder yang ditambahkan.</p>
          )}
        </div>

        {/* Submit */}
        {!readOnly && (
          <div className="pt-3 flex justify-end">
            <Button 
              type="submit" 
              disabled={loading || !selectedKbm}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Save className="h-4 w-4" />
              {loading ? "Menyimpan..." : "Simpan Diagnosa"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
