import { Search, GitFork, Layers, Building2, Tag } from "lucide-react";
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
import { getICD10Mappings, type ICD10MappingDetailsResponse } from "@/lib/masterDataApi";

interface ICD10Data {
  icd10_code: string;
  name_en: string;
  name_id: string;
  chapter_code: string;
  block_code: string;
  is_active: boolean;
  polyclinics: string[];
  kbm_count?: number;
  snomed_count?: number;
}

export function ICD10Page() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);
  
  const [selectedIcd10, setSelectedIcd10] = useState<ICD10Data | null>(null);
  const [mappingDetails, setMappingDetails] = useState<ICD10MappingDetailsResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, loading, error, page, setPage, setSearch, meta } =
    useMasterData<ICD10Data>("/master/icd10");

  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch, setSearch, setPage]);

  const handleViewDetailMap = async (item: ICD10Data) => {
    setSelectedIcd10(item);
    setMappingDetails(null);
    setIsModalOpen(true);
    setLoadingDetails(true);
    try {
      const details = await getICD10Mappings(item.icd10_code);
      setMappingDetails(details);
    } catch (e) {
      console.error("Failed to load ICD-10 mapping details", e);
    } finally {
      setLoadingDetails(false);
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
                <th className="px-6 py-4 text-center">Pemetaan</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    Memuat data ICD-10...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Tidak ada data diagnosa ICD-10 yang ditemukan.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.icd10_code} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{item.icd10_code}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{item.name_id}</div>
                      <div className="text-xs text-slate-400 italic mt-0.5">{item.name_en}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        Ch. {item.chapter_code} | {item.block_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {item.kbm_count && item.kbm_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Layers className="w-3 h-3" /> {item.kbm_count} KBM
                          </span>
                        ) : null}
                        {item.snomed_count && item.snomed_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <Tag className="w-3 h-3" /> {item.snomed_count} SNOMED
                          </span>
                        ) : null}
                        {(!item.kbm_count || item.kbm_count === 0) && (!item.snomed_count || item.snomed_count === 0) ? (
                          <span className="text-xs text-slate-400">Belum Ada Map</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={item.is_active ? "default" : "secondary"} className={item.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" : "bg-slate-100 text-slate-500"}>
                        {item.is_active ? "Aktif" : "Non-Aktif"}
                      </Badge>
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
              <Button 
                variant="outline"
                size="sm"
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
                className="text-xs h-8"
              >
                Sebelumnya
              </Button>
              <div className="text-xs font-medium px-2">
                Halaman {page} dari {meta.total_pages}
              </div>
              <Button 
                variant="outline"
                size="sm"
                disabled={page >= meta.total_pages} 
                onClick={() => setPage(p => p + 1)}
                className="text-xs h-8"
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Map ICD-10 */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <GitFork className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Detail Pemetaan ICD-10
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  Relasi lengkap diagnosis ke KBM, SNOMED-CT (SATUSEHAT), dan Poliklinik
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedIcd10 && (
            <div className="mt-4 space-y-5">
              {/* ICD-10 Info Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-blue-700">
                    {selectedIcd10.icd10_code}
                  </span>
                  <span className="text-xs font-medium text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                    Chapter {selectedIcd10.chapter_code} | {selectedIcd10.block_code}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-slate-800 mt-1.5">
                  {selectedIcd10.name_id}
                </h4>
                <p className="text-xs text-slate-500 italic mt-0.5">
                  {selectedIcd10.name_en}
                </p>
              </div>

              {loadingDetails ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Mengambil relasi pemetaan...
                </div>
              ) : (
                <div className="space-y-5">
                  {/* 1. KBM Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Layers className="h-5 w-5 text-emerald-600" />
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        1. Pemetaan KBM (Kelompok Basis Masalah)
                      </h4>
                    </div>
                    {mappingDetails?.kbm_mappings && mappingDetails.kbm_mappings.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Kode KBM</th>
                              <th className="px-4 py-3">Nama KBM</th>
                              <th className="px-4 py-3 text-center">Confidence</th>
                              <th className="px-4 py-3 text-center">Tipe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {mappingDetails.kbm_mappings.map((k) => {
                              const score = parseFloat(k.mapping_confidence || "0") * 100;
                              return (
                                <tr key={k.kbm_code} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                                    {k.kbm_code}
                                  </td>
                                  <td className="px-4 py-3 text-slate-800 font-medium">
                                    {k.kbm_name}
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
                                    {k.is_primary ? (
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
                        Belum ada pemetaan KBM untuk diagnosis ICD-10 ini.
                      </div>
                    )}
                  </div>

                  {/* 2. SNOMED-CT Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Tag className="h-5 w-5 text-blue-600" />
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        2. Pemetaan SNOMED-CT (SATUSEHAT FHIR)
                      </h4>
                    </div>
                    {mappingDetails?.snomed_mappings && mappingDetails.snomed_mappings.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Concept ID</th>
                              <th className="px-4 py-3">Fully Specified Name (FSN)</th>
                              <th className="px-4 py-3">Istilah Klinis</th>
                              <th className="px-4 py-3 text-center">Tag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {mappingDetails.snomed_mappings.map((s) => (
                              <tr key={s.concept_id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-mono font-bold text-blue-700">
                                  {s.concept_id}
                                </td>
                                <td className="px-4 py-3 text-slate-800 font-medium">
                                  {s.fsn}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {s.term_id}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {s.semantic_tag}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                        Belum ada pemetaan SNOMED-CT untuk diagnosis ICD-10 ini.
                      </div>
                    )}
                  </div>

                  {/* 3. Poliklinik Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Building2 className="h-5 w-5 text-purple-600" />
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        3. Poliklinik Terkait
                      </h4>
                    </div>
                    {mappingDetails?.polyclinics && mappingDetails.polyclinics.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        {mappingDetails.polyclinics.map((p) => (
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
