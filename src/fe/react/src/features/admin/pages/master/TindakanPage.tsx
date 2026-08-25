import { MasterDataTable } from "../../components/MasterDataTable";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitFork, Layers, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getICD9SuggestionsForTindakan, type ICD9SuggestionItem, type PolyclinicItem } from "@/features/emr/api/emrApi";

interface TindakanItem {
  kode_tindakan: string;
  nama_tindakan: string;
  base_price: number;
  icd9_count?: number;
  polyclinics?: string[];
}

export function TindakanPage() {
  const [selectedTindakan, setSelectedTindakan] = useState<TindakanItem | null>(null);
  const [icd9Suggestions, setIcd9Suggestions] = useState<ICD9SuggestionItem[]>([]);
  const [tindakanPolis, setTindakanPolis] = useState<PolyclinicItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewDetailMap = async (item: TindakanItem) => {
    setSelectedTindakan(item);
    setIcd9Suggestions([]);
    setTindakanPolis([]);
    setIsModalOpen(true);
    setLoadingSuggestions(true);
    try {
      const res = await getICD9SuggestionsForTindakan(item.kode_tindakan);
      setIcd9Suggestions(res.suggestions || []);
      setTindakanPolis(res.polyclinics || []);
    } catch (e) {
      console.error("Failed to load ICD-9 suggestions for Tindakan", e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <>
      <MasterDataTable<TindakanItem>
        title="Tindakan & Tarif"
        description="Data master tindakan medis beserta tarif dan pemetaan kode prosedur ICD-9"
        endpoint="/master/tindakan"
        requiresPoliFilter={false}
        columns={["ID Tindakan", "Nama Tindakan", "Harga Dasar", "Pemetaan", "Aksi"]}
        renderRow={(item, i) => (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-mono font-bold text-blue-600">{item.kode_tindakan || "-"}</td>
            <td className="px-6 py-4 font-medium text-slate-900">{item.nama_tindakan || "-"}</td>
            <td className="px-6 py-4 font-mono font-semibold text-slate-700">
              {Number(item.base_price || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}
            </td>
            <td className="px-6 py-4 text-center">
              <div className="flex flex-col items-center gap-1">
                {item.icd9_count && item.icd9_count > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Layers className="w-3 h-3" /> {item.icd9_count} ICD-9
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Belum Ada Map</span>
                )}
              </div>
            </td>
            <td className="px-6 py-4 text-right">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => handleViewDetailMap(item)}
              >
                <GitFork className="w-3.5 h-3.5" />
                Detail Map
              </Button>
            </td>
          </tr>
        )}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <GitFork className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Detail Pemetaan Tindakan & Tarif
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  Relasi tindakan SIMRS ke prosedur ICD-9 (INA-CBGs) dan Poliklinik
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedTindakan && (
            <div className="mt-4 space-y-5">
              {/* Tindakan Info Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-blue-700">
                    {selectedTindakan.kode_tindakan}
                  </span>
                  <span className="text-xs font-medium text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                    Tarif Dasar: {Number(selectedTindakan.base_price || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-slate-800 mt-1.5">
                  {selectedTindakan.nama_tindakan}
                </h4>
              </div>

              {/* 1. ICD-9 Suggestions Section */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Layers className="h-5 w-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    1. Pemetaan Prosedur ICD-9-CM
                  </h4>
                </div>
                {loadingSuggestions ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Memuat pemetaan ICD-9...
                  </div>
                ) : icd9Suggestions.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Kode ICD-9</th>
                          <th className="px-4 py-3">Nama Prosedur</th>
                          <th className="px-4 py-3 text-center">Tipe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {icd9Suggestions.map((m) => (
                          <tr key={m.icd9_code} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">
                              {m.icd9_code}
                            </td>
                            <td className="px-4 py-3 text-slate-800 font-medium">
                              {m.icd9_name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {m.is_primary ? (
                                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                                  PRIMARY
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                                  SECONDARY
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                    Belum ada pemetaan ICD-9 untuk tindakan ini.
                  </div>
                )}
              </div>

              {/* 2. Poliklinik Section */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    2. Poliklinik Terkait
                  </h4>
                </div>
                {tindakanPolis && tindakanPolis.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    {tindakanPolis.map((p) => (
                      <div
                        key={p.code}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-purple-800 shadow-2xs text-sm"
                      >
                        <span className="font-mono font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                          {p.code}
                        </span>
                        <span className="font-medium text-slate-800">{p.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                    Belum di-assign ke Poliklinik manapun.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
