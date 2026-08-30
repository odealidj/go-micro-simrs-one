import { useState, useEffect } from "react";
import { addMedicalAction, removeMedicalAction, searchMasterTindakan } from "../api/rawatJalanApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
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

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<MedicalAction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [performer, setPerformer] = useState("DOKTER");
  const [selectedAction, setSelectedAction] = useState<{ code: string; name: string; price: number } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [tindakanResults, setTindakanResults] = useState<{ code: string; name: string; price: number }[]>([]);

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
      const fullNotes = `[Pelaksana: ${performer}] [Qty: ${quantity}] ${notes}`.trim();
      const unitPrice = selectedAction.price * quantity;

      await addMedicalAction(
        encounterNo,
        selectedAction.code,
        selectedAction.name,
        unitPrice,
        fullNotes
      );
      setSuccess(true);
      setSelectedAction(null);
      setNotes("");
      setSearchQuery("");
      setQuantity(1);
      toast.success(`Tindakan [${selectedAction.name}] berhasil ditambahkan.`);
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
      await removeMedicalAction(deleteTarget.id, encounterNo);
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
    <div className="space-y-6">
      {/* Form Tambah Tindakan */}
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-slate-800 text-lg">Input Tindakan Medis & Prosedur</h3>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            Dapat diisi oleh Dokter / Perawat
          </span>
        </div>

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
            <div>
              <h4 className="font-medium">Tindakan Berhasil Ditambahkan</h4>
              <p className="text-xs text-emerald-600 mt-0.5">Tindakan telah tersimpan dan biaya tindakan diperbarui.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-medium">Gagal Menyimpan Tindakan</h4>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!readOnly && (
          <form onSubmit={handleSubmit} className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cari Nama Tindakan / Prosedur Medis <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Ketik minimal 2 huruf (cth: Konsultasi, Jahit Luka, EKG)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="pl-9 bg-white border-slate-200"
                />
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {showDropdown && searchQuery.length >= 2 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {searching ? (
                    <div className="p-4 text-center text-xs text-slate-500">Mencari katalog tindakan...</div>
                  ) : tindakanResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">Tidak ditemukan tindakan yang cocok</div>
                  ) : (
                    tindakanResults.map((item) => (
                      <div
                        key={item.code}
                        onClick={() => {
                          setSelectedAction(item);
                          setSearchQuery(`${item.code} - ${item.name}`);
                          setShowDropdown(false);
                        }}
                        className="p-3 hover:bg-emerald-50/60 cursor-pointer transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-500">Kode: {item.code}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            Rp {item.price.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedAction && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Tindakan Dipilih:</span>
                  <div className="font-bold text-slate-900 text-sm">{selectedAction.name} ({selectedAction.code})</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Tarif Satuan:</span>
                  <span className="font-extrabold text-emerald-700 text-base">
                    Rp {selectedAction.price.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pelaksana Tindakan</label>
                <select
                  value={performer}
                  onChange={(e) => setPerformer(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="DOKTER">Dokter Pemeriksa</option>
                  <option value="PERAWAT">Perawat Poli</option>
                  <option value="BERSAMA">Dokter & Perawat (Tim)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jumlah (Qty)</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-white border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Total Biaya Pos</label>
                <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-100/80 flex items-center font-bold text-slate-800 text-sm">
                  Rp {((selectedAction?.price || 0) * quantity).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan / Keterangan Prosedur (Opsional)
              </label>
              <Input
                type="text"
                placeholder="Contoh: Regio antebrachii dextra, 3 simpul jahitan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-white border-slate-200"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={loading || !selectedAction}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {loading ? "Menyimpan..." : "Tambahkan ke Tindakan"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-600" />
            Daftar Tindakan Pasien ({existingActions.length})
          </h4>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            Total: Rp {totalActionsPrice.toLocaleString('id-ID')}
          </span>
        </div>

        {existingActions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm italic">
            Belum ada tindakan medis yang tercatat untuk pasien ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 text-slate-500 font-semibold text-xs border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-5 py-3">Nama Tindakan</th>
                  <th className="px-5 py-3">Catatan / Pelaksana</th>
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
                    <tr key={act.id || i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{act.action_code}</span>
                          {isRegistrationFee && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                              Karcis Registrasi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">{act.action_name}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{act.notes || "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                        Rp {Number(act.price || 0).toLocaleString('id-ID')}
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
                  Rp {Number(deleteTarget.price || 0).toLocaleString('id-ID')}
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
