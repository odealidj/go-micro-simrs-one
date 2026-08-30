import { useState, useEffect, useRef } from "react";
import { addMedicalAction, removeMedicalAction, searchMasterTindakan } from "../api/rawatJalanApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Search,
  Syringe,
  CheckCircle,
  Plus,
  AlertCircle,
  Receipt,
  Trash2,
  Lock,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import type { MedicalAction } from "../types";

interface ActionFormProps {
  encounterNo: string;
  deptCode?: string;
  existingActions?: MedicalAction[];
  readOnly?: boolean;
  isPaid?: boolean;
  onSuccess?: () => void;
}

export function ActionForm({ 
  encounterNo, 
  deptCode,
  existingActions = [],
  readOnly = false,
  isPaid = false,
  onSuccess 
}: ActionFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsible inline form state
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<MedicalAction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedAction, setSelectedAction] = useState<{ code: string; name: string; price: number } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [tindakanResults, setTindakanResults] = useState<{ code: string; name: string; price: number }[]>([]);
  const [popularActions, setPopularActions] = useState<{ code: string; name: string; price: number }[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showDropdown]);

  // Initial load for quick actions in this polyclinic
  useEffect(() => {
    if (!isFormOpen) return;
    const fetchPoliActions = async () => {
      try {
        const res = await searchMasterTindakan("", deptCode);
        if (res && res.length > 0) {
          setPopularActions(res.slice(0, 6));
        }
      } catch (err) {
        console.error("Failed to load polyclinic actions catalog", err);
      }
    };
    fetchPoliActions();
  }, [isFormOpen, deptCode]);

  useEffect(() => {
    const fetchTindakan = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setTindakanResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchMasterTindakan(debouncedSearch, deptCode);
        setTindakanResults(res);
      } catch (err) {
        console.error("Failed to fetch master tindakan", err);
      } finally {
        setSearching(false);
      }
    };
    fetchTindakan();
  }, [debouncedSearch, deptCode]);

  const totalActionsPrice = existingActions.reduce((sum, act) => sum + (Number(act.price) || 0), 0);

  const resetForm = () => {
    setSelectedAction(null);
    setNotes("");
    setSearchQuery("");
    setQuantity(1);
    setError(null);
    setShowDropdown(false);
  };

  const handleOpenForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) {
      setError("Silakan pilih tindakan medis terlebih dahulu.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const quantityPrefix = quantity > 1 ? `[Qty: ${quantity}] ` : "";
      const fullNotes = notes.trim() ? `${quantityPrefix}${notes.trim()}` : (quantity > 1 ? `[Qty: ${quantity}]` : "");
      const unitPrice = selectedAction.price * quantity;

      await addMedicalAction(
        encounterNo,
        selectedAction.code,
        selectedAction.name,
        unitPrice,
        fullNotes
      );
      setSuccess(true);
      toast.success(`Tindakan [${selectedAction.name}] berhasil ditambahkan.`);
      
      // Auto-close form on success & refresh data
      handleCloseForm();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal menambahkan tindakan");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDelete = (act: MedicalAction) => {
    if (readOnly || isPaid || act.is_paid) {
      toast.error("Tindakan tidak dapat dihapus karena tagihan tindakan sudah dibayar di kasir atau sesi telah selesai.");
      return;
    }
    if (!act.id) {
      toast.error("ID tindakan tidak ditemukan.");
      return;
    }
    setDeleteTarget(act);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    setIsDeleting(true);
    try {
      await removeMedicalAction(deleteTarget.id, encounterNo, deleteTarget.action_code);
      toast.success(`Tindakan [${deleteTarget.action_name}] berhasil dihapus.`);
      setDeleteTarget(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Gagal menghapus tindakan";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ─── SECTION HEADER & ACTION TRIGGER ─── */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <Syringe className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">Tindakan & Prosedur Medis</h3>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {existingActions.length} Tindakan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar tindakan, prosedur klinis, dan tarif pelayanan rawat jalan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-right">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Total Biaya</span>
            <span className="text-xs font-black text-slate-900">
              Rp {totalActionsPrice.toLocaleString("id-ID")}
            </span>
          </div>

          {!readOnly && !isPaid && (
            <Button
              type="button"
              onClick={isFormOpen ? handleCloseForm : handleOpenForm}
              className={cn(
                "h-9.5 px-4 rounded-xl font-bold text-xs gap-2 transition-all cursor-pointer shadow-xs",
                isFormOpen
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
              )}
            >
              {isFormOpen ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  <span>Tutup Form</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Tindakan</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ─── SUCCESS / ERROR ALERTS ─── */}
      {success && !isFormOpen && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Tindakan medis berhasil disimpan dan otomatis masuk ke tagihan kasir.</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="text-emerald-600 hover:text-emerald-800 text-xs p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ─── COLLAPSIBLE INLINE FORM (OPTION 1) ─── */}
      {isFormOpen && !readOnly && !isPaid && (
        <form
          onSubmit={handleSubmit}
          className="p-5 bg-gradient-to-b from-emerald-50/40 via-white to-white rounded-2xl border-2 border-emerald-300/80 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header Form */}
          <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="font-bold text-sm text-slate-900">Form Input Tindakan Medis</h4>
              <span className="text-[10px] font-semibold bg-emerald-100/70 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                Poli Aktif
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCloseForm}
              className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Tutup Form"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2.5 text-xs">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Gagal Menyimpan: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Pencarian Tindakan Autocomplete */}
          <div ref={searchContainerRef} className="relative space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Cari Nama Tindakan / Prosedur Medis <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Ketik minimal 2 huruf (cth: Konsultasi, Jahit Luka, EKG, Injeksi)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-9 pr-8 bg-white border-slate-300 rounded-xl text-xs h-10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-500"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedAction(null);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Chips dari Master Tindakan Poli */}
            {popularActions.length > 0 && !searchQuery && (
              <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-semibold text-slate-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  Pilihan Cepat:
                </span>
                {popularActions.map((pop) => (
                  <button
                    key={pop.code}
                    type="button"
                    onClick={() => {
                      setSelectedAction(pop);
                      setSearchQuery(`${pop.code} - ${pop.name}`);
                      setShowDropdown(false);
                    }}
                    className="text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 border border-emerald-200/80 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {pop.name}
                  </button>
                ))}
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {showDropdown && searchQuery.length >= 2 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                {searching ? (
                  <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    <span>Mencari katalog tindakan medis...</span>
                  </div>
                ) : tindakanResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 italic">
                    Tidak ditemukan tindakan dengan kata kunci &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  tindakanResults.map((item) => (
                    <div
                      key={item.code}
                      onClick={() => {
                        setSelectedAction(item);
                        setSearchQuery(`${item.code} - ${item.name}`);
                        setShowDropdown(false);
                      }}
                      className="p-3 hover:bg-emerald-50/60 cursor-pointer transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">Kode: {item.code}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Rp {item.price.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Action Banner */}
          {selectedAction && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Tindakan Terpilih:
                </span>
                <div className="font-bold text-slate-900 text-xs truncate">
                  {selectedAction.name} <span className="font-mono text-emerald-700">({selectedAction.code})</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">Tarif Satuan:</span>
                <span className="font-black text-emerald-700 text-sm">
                  Rp {selectedAction.price.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          )}

          {/* Grid: Qty & Total Biaya Tindakan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Jumlah (Qty)
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-white border-slate-300 rounded-xl text-xs h-9.5 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Total Biaya Pos Tindakan
              </label>
              <div className="h-9.5 px-3.5 rounded-xl border border-emerald-200/90 bg-emerald-50/70 flex items-center justify-between font-bold text-emerald-950 text-xs">
                <span className="text-[11px] text-emerald-700 font-semibold">{quantity}x Layanan</span>
                <span className="font-extrabold text-sm text-emerald-800">
                  Rp {((selectedAction?.price || 0) * quantity).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Catatan Tindakan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Catatan / Keterangan Prosedur (Opsional)
            </label>
            <Input
              type="text"
              placeholder="Contoh: Regio antebrachii dextra, 3 simpul jahitan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white border-slate-300 rounded-xl text-xs h-9.5 text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {/* Form Actions Footer */}
          <div className="pt-3 border-t border-emerald-100 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10.5px] text-slate-400 hidden sm:inline-block">
              * Tindakan otomatis tersinkronisasi ke tagihan kasir & rekam medis
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForm}
                className="h-8.5 px-3.5 rounded-xl border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading || !selectedAction}
                className="h-8.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs shadow-emerald-600/20"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{loading ? "Menyimpan..." : "Tambahkan ke Tindakan"}</span>
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ─── TABEL DAFTAR TINDAKAN PASIEN ─── */}
      <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs bg-white">
        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 uppercase tracking-wider">
            <Receipt className="h-4 w-4 text-emerald-600" />
            <span>Rincian Tindakan Pasien ({existingActions.length})</span>
          </h4>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
            Total Tarif: Rp {totalActionsPrice.toLocaleString("id-ID")}
          </span>
        </div>

        {existingActions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="p-3 bg-slate-100 rounded-2xl w-fit mx-auto text-slate-400">
              <Syringe className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800">Belum Ada Tindakan Medis</p>
              <p className="text-[11px] text-slate-400">
                Gunakan tombol &quot;Tambah Tindakan&quot; di atas untuk mencatat tindakan klinis pasien.
              </p>
            </div>
            {!readOnly && !isPaid && !isFormOpen && (
              <Button
                type="button"
                onClick={handleOpenForm}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-8.5 gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Tindakan Pertama</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/50 text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-5 py-3">Nama Tindakan</th>
                  <th className="px-5 py-3">Catatan / Keterangan</th>
                  <th className="px-5 py-3 text-right">Tarif</th>
                  <th className="px-4 py-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {existingActions.map((act, i) => {
                  const isRegistrationFee = 
                    act.action_code === "TND-001" || 
                    act.action_code === "TND-002" || 
                    (act.notes && (act.notes.includes("Pendaftaran") || act.notes.includes("Karcis")));

                  const isActionLocked = readOnly || isPaid || act.is_paid;

                  return (
                    <tr key={act.id || i} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{act.action_code}</span>
                          {isRegistrationFee && (
                            <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded font-bold">
                              Karcis Registrasi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-900">{act.action_name}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{act.notes || "—"}</td>
                      <td className="px-5 py-3 text-right font-extrabold text-emerald-700">
                        Rp {Number(act.price || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isActionLocked ? (
                          <span
                            className="inline-flex items-center justify-center p-1.5 text-slate-300 rounded-lg cursor-not-allowed"
                            title="Tindakan sudah dibayar di kasir / sesi selesai (terkunci)"
                          >
                            <Lock className="h-4 w-4" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(act)}
                            className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Tindakan"
                            aria-label={`Hapus ${act.action_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL CONFIRMATION: DELETE ACTION ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-xl">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Hapus Tindakan Medis?</h4>
                <p className="text-xs text-slate-500">Tindakan ini akan dihapus dari rekam medis dan penagihan kasir.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  {deleteTarget.action_code}
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {deleteTarget.action_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 pt-1">
                <span>{deleteTarget.notes || "Tanpa catatan"}</span>
                <span className="font-bold text-emerald-700 text-sm">
                  Rp {Number(deleteTarget.price || 0).toLocaleString("id-ID")}
                </span>
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
                {isDeleting ? "Menghapus..." : "Ya, Hapus Tindakan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
