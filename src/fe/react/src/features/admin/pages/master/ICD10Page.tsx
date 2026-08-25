import { Search, Activity, Book, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMasterData } from "@/hooks/useMasterData";
import { useDebounce } from "@/hooks/useDebounce";
import { useEffect, useState } from "react";
import { getKBMSuggestionsForICD10 } from "@/features/emr/api/emrApi";

interface ICD10Data {
  icd10_code: string;
  name_en: string;
  name_id: string;
  chapter_code: string;
  block_code: string;
  is_active: boolean;
  polyclinics: string[];
  kbm_count?: number;
}

export function ICD10Page() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);
  
  const [selectedIcd10, setSelectedIcd10] = useState<ICD10Data | null>(null);
  const [kbmSuggestions, setKbmSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, loading, error, page, setPage, setSearch, meta } =
    useMasterData<ICD10Data>("/master/icd10");

  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch, setSearch, setPage]);

  const handleViewKbm = async (item: ICD10Data) => {
    setSelectedIcd10(item);
    setKbmSuggestions([]);
    setIsModalOpen(true);
    setLoadingSuggestions(true);
    try {
      const suggestions = await getKBMSuggestionsForICD10(item.icd10_code);
      setKbmSuggestions(suggestions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Katalog ICD-10</h2>
            <p className="text-slate-500 text-sm mt-1">Katalog klasifikasi diagnosa internasional standar WHO & Kemenkes</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari kode atau diagnosa..."
                value={searchInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          {error && <div className="text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
              <tr>
                <th className="px-6 py-4">Kode ICD-10</th>
                <th className="px-6 py-4">Diagnosa (ID / EN)</th>
                <th className="px-6 py-4">Kategori (Chapter / Block)</th>
                <th className="px-6 py-4">Pemetaan KBM</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p>Memuat katalog...</p>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <Book className="h-12 w-12 text-slate-200" />
                      <p>Tidak ada data ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item, i) => (
                  <tr key={item.icd10_code || i} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-blue-600 bg-blue-50/50 inline-flex px-2.5 py-1 rounded-md border border-blue-100 group-hover:bg-blue-100/50 transition-colors">
                        {item.icd10_code || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="flex flex-col space-y-1">
                        <span className="font-medium text-slate-900">{item.name_id || "-"}</span>
                        <span className="text-xs text-slate-500 italic">{item.name_en || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(item.chapter_code || item.block_code) ? (
                        <div className="flex flex-col space-y-1.5">
                          {item.chapter_code && (
                            <Badge variant="outline" className="w-fit bg-slate-50 text-slate-600 border-slate-200">
                              Chapter {item.chapter_code}
                            </Badge>
                          )}
                          {item.block_code && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              Block {item.block_code}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {item.kbm_count && item.kbm_count > 0 ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Terpetakan ({item.kbm_count} KBM)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50/80 text-amber-700 border-amber-200/90 hover:bg-amber-100/80 font-medium inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Belum Dipetakan
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={item.is_active ? "default" : "secondary"} className={item.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" : "bg-slate-100 text-slate-500"}>
                        {item.is_active ? "Aktif" : "Non-Aktif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleViewKbm(item)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Pemetaan KBM
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {meta && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-medium text-slate-700">{data.length}</span> dari <span className="font-medium text-slate-700">{meta.total_count}</span> data
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sebelumnya
              </button>
              <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600">
                Hal {page} / {meta.total_pages}
              </div>
              <button 
                disabled={page >= meta.total_pages} 
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pemetaan Kasus Baru & Medis (KBM)</DialogTitle>
            <DialogDescription>
              {selectedIcd10 && (
                <span>
                  Pemetaan untuk diagnosa ICD-10: <strong>{selectedIcd10.icd10_code} - {selectedIcd10.name_id}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {loadingSuggestions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : kbmSuggestions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                Belum ada pemetaan KBM untuk diagnosa ini.
              </div>
            ) : (
              <div className="space-y-3">
                {kbmSuggestions.map((kbm, idx) => (
                  <div key={idx} className="flex items-start justify-between p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-blue-200 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{kbm.kbm_code || "-"}</span>
                        {kbm.is_primary && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600 text-sm">{kbm.kbm_name || "-"}</p>
                    </div>
                    {kbm.mapping_confidence && (
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block mb-1">Confidence</span>
                        <Badge variant="outline" className={`
                          ${kbm.mapping_confidence === 'HIGH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                          ${kbm.mapping_confidence === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                          ${kbm.mapping_confidence === 'LOW' ? 'bg-rose-50 text-rose-700 border-rose-200' : ''}
                          ${!['HIGH', 'MEDIUM', 'LOW'].includes(kbm.mapping_confidence) ? 'bg-slate-50' : ''}
                        `}>
                          {kbm.mapping_confidence}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
