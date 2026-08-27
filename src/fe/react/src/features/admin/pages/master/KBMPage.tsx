import { Search, GitFork, BookOpen, Layers, Building2 } from "lucide-react";
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
import { getKBMICD10Suggestions, type ICD10SuggestionItem, type PolyclinicItem } from "@/lib/masterDataApi";

interface KBMItem {
  kbm_code: string;
  kbm_name: string;
  description?: string;
  body_system?: string;
  is_active?: boolean;
  polyclinics?: string[];
  icd10_count?: number;
}

export function KBMPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);

  const [selectedKBM, setSelectedKBM] = useState<KBMItem | null>(null);
  const [icd10Suggestions, setIcd10Suggestions] = useState<ICD10SuggestionItem[]>([]);
  const [kbmPolis, setKbmPolis] = useState<PolyclinicItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, loading, error, page, setPage, setSearch, meta } =
    useMasterData<KBMItem>("/master/kbm");

  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch, setSearch, setPage]);

  const handleViewDetailMap = async (item: KBMItem) => {
    setSelectedKBM(item);
    setIcd10Suggestions([]);
    setKbmPolis([]);
    setIsModalOpen(true);
    setLoadingSuggestions(true);
    try {
      const res = await getKBMICD10Suggestions(item.kbm_code);
      setIcd10Suggestions(res.suggestions || []);
      setKbmPolis(res.polyclinics || []);
    } catch (e) {
      console.error("Failed to load ICD-10 suggestions for KBM", e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Kamus Besar Medis (KBM)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Kelompok Masalah
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Katalog kelompok basis masalah / keluhan klinis standar untuk pengelompokan rekam medis
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari kode atau nama KBM..."
                value={searchInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Table List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 uppercase font-semibold text-xs border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Kode KBM</th>
                <th className="px-4 py-3">Nama KBM</th>
                <th className="px-4 py-3">Body System</th>
                <th className="px-4 py-3 text-center">Pemetaan</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Memuat data KBM...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-rose-500">
                    {error}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Tidak ada data KBM yang ditemukan.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.kbm_code} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {item.kbm_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {item.kbm_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.body_system || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {item.icd10_count && item.icd10_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Layers className="w-3 h-3" /> {item.icd10_count} ICD-10
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Belum Ada Map</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="secondary"
                        className={
                          item.is_active !== false
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100"
                        }
                      >
                        {item.is_active !== false ? "Aktif" : "Non-aktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleViewDetailMap(item)}
                      >
                        <GitFork className="h-3.5 w-3.5" />
                        Detail Map
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Menampilkan {data.length} dari {meta.total_count ?? meta.total_data ?? 0} KBM
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="text-xs h-8"
            >
              Sebelumnya
            </Button>
            <span className="text-xs font-medium px-2">
              Halaman {page} dari {meta.total_pages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (meta.total_pages || 1)}
              onClick={() => setPage(page + 1)}
              className="text-xs h-8"
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Detail Map KBM */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Detail Pemetaan KBM
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  Daftar diagnosa ICD-10 yang terpetakan ke Kelompok Basis Masalah ini
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedKBM && (
            <div className="mt-4 space-y-5">
              {/* KBM Info Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-blue-700">
                    {selectedKBM.kbm_code}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                    {selectedKBM.body_system || "Umum"}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-slate-800 mt-1.5">
                  {selectedKBM.kbm_name}
                </h4>
              </div>

              {/* ICD-10 Suggestions */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Layers className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    Daftar Diagnosa ICD-10 Terpetakan
                  </h4>
                </div>

                {loadingSuggestions ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Mengambil pemetaan ICD-10...
                  </div>
                ) : icd10Suggestions.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Kode ICD-10</th>
                          <th className="px-4 py-3">Nama Diagnosis</th>
                          <th className="px-4 py-3 text-center">Confidence</th>
                          <th className="px-4 py-3 text-center">Tipe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {icd10Suggestions.map((m) => {
                          const score = parseFloat(m.mapping_confidence || "0") * 100;
                          return (
                            <tr key={m.icd10_code} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                                {m.icd10_code}
                              </td>
                              <td className="px-4 py-3 text-slate-800 font-medium">
                                {m.icd10_name}
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                                  score >= 90
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}>
                                  {score > 0 ? `${score.toFixed(0)}%` : "Auto"}
                                </span>
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                    Belum ada pemetaan ICD-10 untuk KBM ini.
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
                {kbmPolis && kbmPolis.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    {kbmPolis.map((p) => (
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
    </div>
  );
}
