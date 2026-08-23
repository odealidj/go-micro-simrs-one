import { useState, useEffect } from "react";
import { addMedicalAction, searchMasterTindakan } from "../api/emrApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Search,
  Syringe,
  CheckCircle,
  Plus,
  AlertCircle,
  Receipt,
  UserCheck,
} from "lucide-react";
import type { MedicalAction } from "../types";

interface ActionFormProps {
  encounterNo: string;
  deptCode?: string;
  existingActions?: MedicalAction[];
  onSuccess?: () => void;
}

export function ActionForm({ 
  encounterNo, 
  deptCode,
  existingActions = [],
  onSuccess 
}: ActionFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal menambahkan tindakan");
    } finally {
      setLoading(false);
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
              <p className="text-sm mt-0.5">Tindakan medis telah dicatat dan terintegrasi ke rincian tagihan kasir.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 bg-slate-50/50 p-5 rounded-xl border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Search Tindakan */}
            <div className="md:col-span-6 relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Tindakan / Prosedur <span className="text-red-500">*</span>
              </label>
              
              {selectedAction ? (
                <div className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                  <div>
                    <span className="font-bold text-emerald-700 mr-2 text-xs">[{selectedAction.code}]</span>
                    <span className="text-slate-800 font-medium text-sm">{selectedAction.name}</span>
                    <div className="text-xs text-slate-500 mt-0.5 font-semibold">
                      Tarif Dasar: Rp {selectedAction.price.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAction(null);
                      setSearchQuery("");
                    }}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-1 bg-white rounded border border-emerald-200"
                  >
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Ketik nama tindakan / prosedur..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="pl-9 h-11 bg-white rounded-xl text-sm"
                  />
                  
                  {showDropdown && searchQuery.length >= 2 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {searching ? (
                        <div className="p-3 text-xs text-slate-500 text-center">Mencari master tindakan...</div>
                      ) : tindakanResults.length > 0 ? (
                        <ul className="divide-y divide-slate-100 text-sm">
                          {tindakanResults.map((tindakan) => (
                            <li 
                              key={tindakan.code}
                              onClick={() => {
                                setSelectedAction(tindakan);
                                setShowDropdown(false);
                              }}
                              className="p-3 hover:bg-emerald-50/60 cursor-pointer flex justify-between items-center transition-colors"
                            >
                              <div>
                                <div className="font-medium text-slate-800">{tindakan.name}</div>
                                <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                                  Rp {tindakan.price.toLocaleString('id-ID')}
                                </div>
                              </div>
                              <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {tindakan.code}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-3 text-xs text-slate-500 text-center">Tindakan tidak ditemukan</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Qty & Pelaksana */}
            <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jumlah (Qty)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="h-11 bg-white text-center font-bold text-slate-800 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                  Pelaksana
                </label>
                <select
                  value={performer}
                  onChange={(e) => setPerformer(e.target.value)}
                  className="h-11 px-2.5 w-full bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="DOKTER">Dokter</option>
                  <option value="PERAWAT">Perawat</option>
                  <option value="BERSAMA">Bersama</option>
                </select>
              </div>
            </div>

            {/* Keterangan */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Keterangan Lokasi / Catatan
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Regio abdomen kanan..."
                className="h-11 bg-white rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              {selectedAction && (
                <span>Subtotal Tindakan: <strong className="text-emerald-700 font-bold">Rp {(selectedAction.price * quantity).toLocaleString('id-ID')}</strong></span>
              )}
            </div>
            <Button 
              type="submit" 
              disabled={loading || !selectedAction}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {loading ? "Menyimpan..." : "Tambahkan ke Tindakan"}
            </Button>
          </div>
        </form>
      </div>

      {/* Tabel Daftar Tindakan Terdaftar */}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {existingActions.map((act, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-900 text-xs">{act.action_code}</td>
                    <td className="px-5 py-3 font-medium">{act.action_name}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{act.notes || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                      Rp {Number(act.price || 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
