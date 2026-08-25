import { useState, useEffect } from "react";
import { searchMasterObat, createPrescription, type SearchObatItem } from "../api/emrApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Pill,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Send,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import type { PrescriptionDraftItem } from "../types";

interface PrescriptionFormProps {
  encounterNo: string;
  deptCode?: string;
  existingPrescriptions?: PrescriptionDraftItem[];
  readOnly?: boolean;
  onSuccess?: () => void;
}

const COMMON_SIGNAS = [
  "3 x 1 Tablet sesudah makan",
  "2 x 1 Kapsul sesudah makan",
  "1 x 1 Tablet pagi hari",
  "1 x 1 Tablet malam sebelum tidur",
  "3 x 1 Sendok Takar (5ml)",
  "Bila perlu / demam (PRN)",
  "Oleskan tipis pada area sakit 2x sehari",
];

export function PrescriptionForm({
  encounterNo,
  deptCode,
  existingPrescriptions = [],
  readOnly = false,
  onSuccess,
}: PrescriptionFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft prescription list
  const [draftList, setDraftList] = useState<PrescriptionDraftItem[]>(existingPrescriptions);

  // Current item being added
  const [selectedObat, setSelectedObat] = useState<SearchObatItem | null>(null);
  const [quantity, setQuantity] = useState(10);
  const [unit, setUnit] = useState("Tablet");
  const [dosage, setDosage] = useState("3 x 1 Tablet sesudah makan");
  const [notes, setNotes] = useState("");

  // Search obat
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [obatResults, setObatResults] = useState<SearchObatItem[]>([]);

  useEffect(() => {
    const fetchObat = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setObatResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchMasterObat(debouncedSearch, deptCode);
        setObatResults(Array.isArray(res) ? res : [res].filter(Boolean));
      } catch (err) {
        console.error("Failed to fetch obat", err);
      } finally {
        setSearching(false);
      }
    };
    fetchObat();
  }, [debouncedSearch, deptCode]);

  const handleAddDraft = () => {
    if (!selectedObat) {
      setError("Pilih obat terlebih dahulu");
      return;
    }
    setError(null);
    setDraftList((prev) => [
      ...prev,
      {
        drug_code: selectedObat.code,
        drug_name: selectedObat.name,
        quantity,
        unit,
        dosage,
        notes,
      },
    ]);
    setSelectedObat(null);
    setSearchQuery("");
    setQuantity(10);
    setNotes("");
  };

  const handleRemoveDraft = (index: number) => {
    setDraftList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendToPharmacy = async () => {
    if (draftList.length === 0) {
      setError("Tambahkan minimal 1 obat ke dalam resep.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await createPrescription(encounterNo, draftList);
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal mengirim resep ke farmasi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-violet-600" />
          <h3 className="font-semibold text-slate-800 text-lg">E-Resep & Terapi Obat (Farmasi)</h3>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Dapat diisi oleh Dokter / Perawat
        </span>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
          <div>
            <h4 className="font-medium">Resep Berhasil Dikirim ke Farmasi</h4>
            <p className="text-sm mt-0.5">Resep langsung masuk ke antrean peracikan Asisten Apoteker.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {!readOnly && (
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tambah Obat ke Resep
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
            <div className="md:col-span-5 relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Obat / Formularium <span className="text-red-500">*</span>
              </label>

              {selectedObat ? (
                <div className="p-3 border border-violet-200 bg-violet-50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-violet-700 mr-2 text-xs">[{selectedObat.code}]</span>
                      <span className="text-slate-800 font-medium text-sm">{selectedObat.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedObat(null);
                        setSearchQuery("");
                      }}
                      className="text-violet-700 hover:text-violet-900 text-xs font-semibold px-2 py-1 bg-white rounded border border-violet-200 cursor-pointer"
                    >
                      Ganti
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span>
                      Stok: <strong className="text-slate-700">{selectedObat.stock}</strong> · Rp {selectedObat.price.toLocaleString("id-ID")}
                    </span>
                    {selectedObat.is_fornas && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                        <ShieldCheck className="w-3 h-3" /> FORNAS (BPJS)
                      </span>
                    )}
                    {selectedObat.kfa_code && (
                      <span className="font-mono text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                        KFA: {selectedObat.kfa_code}
                      </span>
                    )}
                  </div>

                  {selectedObat.restriction ? (
                    <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200/80">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span><strong>Restriksi BPJS:</strong> {selectedObat.restriction}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Ketik nama obat (Paracetamol, Amoxicillin...)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="pl-9 h-11 bg-white rounded-xl text-sm"
                  />

                  {showDropdown && searchQuery.length >= 2 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      {searching ? (
                        <div className="p-3 text-xs text-slate-500 text-center">Mencari stok obat...</div>
                      ) : obatResults.length > 0 ? (
                        <ul className="divide-y divide-slate-100 text-sm">
                          {obatResults.map((obat) => (
                            <li
                              key={obat.code}
                              onClick={() => {
                                setSelectedObat(obat);
                                setShowDropdown(false);
                              }}
                              className="p-3 hover:bg-violet-50/60 cursor-pointer flex justify-between items-center transition-colors"
                            >
                              <div>
                                <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                  <span>{obat.name}</span>
                                  {obat.is_fornas && (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      FORNAS
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                  <span>Stok: <strong className="text-slate-600">{obat.stock}</strong></span>
                                  <span>·</span>
                                  <span>Rp {obat.price.toLocaleString("id-ID")}</span>
                                  {obat.kfa_code && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono text-[10px] text-blue-600">KFA: {obat.kfa_code}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {obat.code}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-3 text-xs text-slate-500 text-center">Obat tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jumlah
                </label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  className="h-11 bg-white rounded-xl text-center text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Satuan
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="Tablet">Tablet</option>
                  <option value="Kapsul">Kapsul</option>
                  <option value="Botol">Botol (Sirup)</option>
                  <option value="Tube">Tube (Salep)</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Vial">Vial</option>
                  <option value="Ampul">Ampul</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Aturan Pakai (Signa) <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Contoh: 3 x 1 Tablet sesudah makan..."
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="h-11 bg-white rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-violet-500" />
              Template Signa:
            </span>
            {COMMON_SIGNAS.slice(0, 4).map((sig) => (
              <button
                key={sig}
                type="button"
                onClick={() => setDosage(sig)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors cursor-pointer"
              >
                {sig}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleAddDraft}
              disabled={!selectedObat}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Tambahkan ke Resep
            </Button>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <Pill className="h-4 w-4 text-violet-600" />
            Daftar Obat yang Diresepkan ({draftList.length})
          </h4>
        </div>

        {draftList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm italic">
            Belum ada obat yang dimasukkan ke dalam e-resep.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {draftList.map((item, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-violet-50 rounded-lg text-violet-600 mt-0.5">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{item.drug_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jumlah: <strong className="text-slate-700">{item.quantity} {item.unit}</strong> · Signa: <span className="text-violet-700 font-medium">{item.dosage}</span>
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDraft(i)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!readOnly && draftList.length > 0 && (
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            onClick={handleSendToPharmacy}
            disabled={loading}
            className="gap-2 bg-violet-700 hover:bg-violet-800 text-white font-semibold shadow-sm h-11 px-6 rounded-xl cursor-pointer"
          >
            <Send className="h-4 w-4" />
            {loading ? "Mengirim ke Farmasi..." : "Kirim Resep ke Farmasi"}
          </Button>
        </div>
      )}
    </div>
  );
}
