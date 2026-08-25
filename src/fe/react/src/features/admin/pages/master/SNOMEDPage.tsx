import { Search, GitFork, Tag, Layers } from "lucide-react";
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
import { getSNOMEDMappings, type SNOMEDMappingResponse } from "@/features/emr/api/emrApi";

interface SNOMEDItem {
  concept_id: string;
  fsn: string;
  term_id: string;
  semantic_tag: string;
  is_active: boolean;
  icd10_count?: number;
  icd9_count?: number;
}

export function SNOMEDPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);

  const [selectedConcept, setSelectedConcept] = useState<SNOMEDItem | null>(null);
  const [mappingDetails, setMappingDetails] = useState<SNOMEDMappingResponse | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, loading, error, page, setPage, setSearch, meta } =
    useMasterData<SNOMEDItem>("/master/snomed");

  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch, setSearch, setPage]);

  const handleViewMapping = async (item: SNOMEDItem) => {
    setSelectedConcept(item);
    setMappingDetails(null);
    setIsModalOpen(true);
    setLoadingMapping(true);
    try {
      const details = await getSNOMEDMappings(item.concept_id);
      setMappingDetails(details);
    } catch (e) {
      console.error("Failed to load SNOMED mapping details", e);
    } finally {
      setLoadingMapping(false);
    }
  };

  const getSemanticTagBadge = (tag: string) => {
    switch (tag.toLowerCase()) {
      case "disorder":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Disorder
          </span>
        );
      case "procedure":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            Procedure
          </span>
        );
      case "finding":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            Finding
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {tag}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Katalog SNOMED-CT</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                SATUSEHAT HL7 FHIR
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Terminologi klinis komprehensif berstandar global dengan pemetaan otomatis (*cross-map*) ke ICD-10 & ICD-9-CM
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari Concept ID, FSN, atau istilah..."
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
                <th className="px-4 py-3 rounded-l-lg">Concept ID</th>
                <th className="px-4 py-3">Fully Specified Name (FSN)</th>
                <th className="px-4 py-3">Istilah Klinis (ID)</th>
                <th className="px-4 py-3">Kategori (Tag)</th>
                <th className="px-4 py-3 text-center">Pemetaan ICD-10</th>
                <th className="px-4 py-3 text-center">Pemetaan ICD-9</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Memuat katalog SNOMED-CT...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-rose-500">
                    {error}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Tidak ada data konsep SNOMED-CT yang ditemukan.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.concept_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {item.concept_id}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {item.fsn}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.term_id}
                    </td>
                    <td className="px-4 py-3">
                      {getSemanticTagBadge(item.semantic_tag)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.icd10_count && item.icd10_count > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Terpetakan ({item.icd10_count} ICD-10)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal bg-slate-100 text-slate-400 border border-slate-200">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.icd9_count && item.icd9_count > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Terpetakan ({item.icd9_count} ICD-9)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal bg-slate-100 text-slate-400 border border-slate-200">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="secondary"
                        className={
                          item.is_active
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100"
                        }
                      >
                        {item.is_active ? "Aktif" : "Non-aktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleViewMapping(item)}
                      >
                        <GitFork className="h-3.5 w-3.5" />
                        Detail Cross-Map
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
            Menampilkan {data.length} dari {meta.total_count ?? meta.total_data ?? 0} konsep SNOMED-CT
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

      {/* Modal Detail Cross-Map SNOMED-CT */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <GitFork className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-800">
                  Pemetaan Cross-Map SNOMED-CT
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Relasi bawaan standar SNOMED International ke klasifikasi ICD-10 (Diagnosis) & ICD-9-CM (Prosedur)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedConcept && (
            <div className="mt-2 space-y-4">
              {/* Concept Info Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-blue-700">
                    SCTID: {selectedConcept.concept_id}
                  </span>
                  {getSemanticTagBadge(selectedConcept.semantic_tag)}
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mt-1">
                  {selectedConcept.fsn}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Istilah Klinis: <span className="text-slate-700 font-medium">{selectedConcept.term_id}</span>
                </p>
              </div>

              {/* Mappings Content */}
              {loadingMapping ? (
                <div className="text-center py-6 text-slate-400 text-sm">
                  Mengambil relasi pemetaan...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ICD-10 Mappings Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Pemetaan ICD-10 (Diagnosis Medis)
                      </h4>
                    </div>
                    {mappingDetails?.icd10_mappings && mappingDetails.icd10_mappings.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2">Kode ICD-10</th>
                              <th className="px-3 py-2">Nama Diagnosis</th>
                              <th className="px-3 py-2">Map Advice</th>
                              <th className="px-3 py-2 text-center">Tipe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {mappingDetails.icd10_mappings.map((m) => (
                              <tr key={m.icd10_code} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-mono font-bold text-emerald-700">
                                  {m.icd10_code}
                                </td>
                                <td className="px-3 py-2 text-slate-800">
                                  {m.icd10_name_id || m.icd10_name_en}
                                </td>
                                <td className="px-3 py-2 text-slate-500 font-mono">
                                  {m.map_advice || "ALWAYS"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {m.is_primary ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      PRIMARY
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
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
                      <div className="bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        Tidak ada target pemetaan ICD-10 untuk konsep ini (umumnya untuk konsep non-disorder/prosedur).
                      </div>
                    )}
                  </div>

                  {/* ICD-9 Mappings Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-teal-600" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Pemetaan ICD-9-CM (Prosedur / Tindakan)
                      </h4>
                    </div>
                    {mappingDetails?.icd9_mappings && mappingDetails.icd9_mappings.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2">Kode ICD-9</th>
                              <th className="px-3 py-2">Nama Prosedur</th>
                              <th className="px-3 py-2">Kategori</th>
                              <th className="px-3 py-2 text-center">Tipe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {mappingDetails.icd9_mappings.map((m) => (
                              <tr key={m.icd9_code} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-mono font-bold text-teal-700">
                                  {m.icd9_code}
                                </td>
                                <td className="px-3 py-2 text-slate-800">
                                  {m.icd9_name_id || m.icd9_name_en}
                                </td>
                                <td className="px-3 py-2 text-slate-500 font-mono">
                                  {m.category || "-"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {m.is_primary ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                                      PRIMARY
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
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
                      <div className="bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        Tidak ada target pemetaan ICD-9-CM untuk konsep ini (umumnya untuk konsep disorder/diagnosa murni).
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
