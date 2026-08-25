import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  GitFork,
  ShieldCheck,
  BookOpen,
  Building2,
  AlertCircle,
  Search,
  Pill,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import {
  getObatMappingDetails,
  type ObatKFAMapDetail,
  type ObatDPHOMapDetail,
} from "@/features/emr/api/emrApi";
import { useMasterData } from "@/hooks/useMasterData";
import { useDebounce } from "@/hooks/useDebounce";

interface ObatItem {
  item_code: string;
  name: string;
  price: number;
  stock_quantity?: number;
  polyclinics?: string[];
  kfa_count?: number;
  dpho_count?: number;
  is_fornas?: boolean;
  is_prb?: boolean;
  kfa_code?: string;
  bpjs_dpho_code?: string;
  restriction?: string;
}

export function ObatPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "fornas" | "prb" | "unmapped">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const debouncedSearch = useDebounce(search, 400);

  // Detail Map Modal State
  const [selectedObat, setSelectedObat] = useState<ObatItem | null>(null);
  const [kfaMappings, setKfaMappings] = useState<ObatKFAMapDetail[]>([]);
  const [dphoMappings, setDphoMappings] = useState<ObatDPHOMapDetail[]>([]);
  const [polyclinics, setPolyclinics] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);

  const endpoint = `/master/obat?page=${page}&page_size=${pageSize}${
    debouncedSearch ? `&search_name=${encodeURIComponent(debouncedSearch)}` : ""
  }`;

  const { data: rawData, loading, error, meta } = useMasterData<ObatItem>(endpoint);
  const { data: polyclinicList } = useMasterData<any>("/master/polyclinics?page_size=100");

  const getPolyclinicName = (code: string) => {
    const found = polyclinicList?.find((p: any) => p.code === code);
    return found ? found.name : `Poli ${code}`;
  };

  // Client-side quick filtering if user selects FORNAS/PRB/Unmapped
  const filteredData = useMemo(() => {
    if (!rawData) return [];
    if (filterType === "fornas") {
      return rawData.filter((item) => item.is_fornas);
    }
    if (filterType === "prb") {
      return rawData.filter((item) => item.is_prb);
    }
    if (filterType === "unmapped") {
      return rawData.filter(
        (item) => (!item.kfa_count || item.kfa_count === 0) && (!item.dpho_count || item.dpho_count === 0)
      );
    }
    return rawData;
  }, [rawData, filterType]);

  const handleViewDetailMap = async (obat: ObatItem) => {
    setSelectedObat(obat);
    setIsModalOpen(true);
    setLoadingMap(true);
    try {
      const res = await getObatMappingDetails(obat.item_code);
      setKfaMappings(res.kfa_mappings || []);
      setDphoMappings(res.dpho_mappings || []);
      setPolyclinics(res.polyclinics || []);
    } catch (err) {
      console.error("Failed to load obat mapping details", err);
      setKfaMappings([]);
      setDphoMappings([]);
      setPolyclinics([]);
    } finally {
      setLoadingMap(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Inventaris Obat & Standarisasi
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Master obat terintegrasi KFA Kemenkes (SATUSEHAT FHIR) & DPHO/FORNAS (BPJS Kesehatan)
              </p>
            </div>
          </div>
        </div>

        {meta && (
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-600">Total Obat RS:</span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {meta.total_data || 0}
            </span>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        {/* Search & Quick Filter Toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-5">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari kode obat, nama obat..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-slate-50 border-slate-200 focus:bg-white text-sm"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              className={filterType === "all" ? "bg-slate-800 hover:bg-slate-700 text-white" : "text-slate-600"}
              onClick={() => setFilterType("all")}
            >
              Semua Obat
            </Button>
            <Button
              variant={filterType === "fornas" ? "default" : "outline"}
              size="sm"
              className={
                filterType === "fornas"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              }
              onClick={() => setFilterType("fornas")}
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              FORNAS (BPJS)
            </Button>
            <Button
              variant={filterType === "prb" ? "default" : "outline"}
              size="sm"
              className={
                filterType === "prb"
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "text-blue-700 border-blue-200 hover:bg-blue-50"
              }
              onClick={() => setFilterType("prb")}
            >
              PRB (Kronis)
            </Button>
            <Button
              variant={filterType === "unmapped" ? "default" : "outline"}
              size="sm"
              className={
                filterType === "unmapped"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "text-amber-700 border-amber-200 hover:bg-amber-50"
              }
              onClick={() => setFilterType("unmapped")}
            >
              <AlertCircle className="w-3.5 h-3.5 mr-1" />
              Belum Mapping
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 uppercase font-semibold text-xs border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Kode Obat</th>
                <th className="px-4 py-3">Nama Obat</th>
                <th className="px-4 py-3">Tarif / Harga</th>
                <th className="px-4 py-3 text-center">Stok</th>
                <th className="px-4 py-3 text-center">Pemetaan Standar</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Memuat inventaris obat...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-rose-500">
                    {error}
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Tidak ada obat yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.item_code} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-600 align-middle">
                      {item.item_code}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 align-middle">
                      {item.name}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-800 align-middle">
                      {Number(item.price || 0).toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          (item.stock_quantity ?? 0) > 50
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : (item.stock_quantity ?? 0) > 0
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {item.stock_quantity ?? 0} unit
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <div className="flex flex-col items-center gap-1">
                        {item.kfa_count && item.kfa_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <BookOpen className="w-3 h-3" /> {item.kfa_count} KFA
                          </span>
                        ) : null}

                        {item.is_fornas ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> FORNAS
                          </span>
                        ) : item.dpho_count && item.dpho_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <ShieldCheck className="w-3 h-3" /> {item.dpho_count} DPHO
                          </span>
                        ) : null}

                        {item.is_prb && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            PRB
                          </span>
                        )}

                        {(!item.kfa_count || item.kfa_count === 0) &&
                          (!item.dpho_count || item.dpho_count === 0) && (
                            <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              Belum Ada Map
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 font-medium"
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

        {/* Pagination */}
        {meta && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{filteredData.length}</span> dari{" "}
              <span className="font-semibold text-slate-800">{meta.total_data || 0}</span> data (Halaman{" "}
              <span className="font-semibold text-slate-800">{meta.page || 1}</span> dari{" "}
              <span className="font-semibold text-slate-800">{meta.total_pages || 1}</span>)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-slate-600"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </Button>
              <div className="text-xs font-semibold px-2 text-slate-700">
                {page} / {meta.total_pages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-slate-600"
                disabled={page >= (meta.total_pages || 1) || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Selanjutnya
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Map */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <GitFork className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Detail Pemetaan Standar Obat
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  Relasi obat SIMRS ke standar KFA Kemenkes (SATUSEHAT), DPHO/FORNAS BPJS, dan Poliklinik
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedObat && (
            <div className="mt-4 space-y-5">
              {/* Obat Info Header Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-blue-700">
                    {selectedObat.item_code}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                      Tarif:{" "}
                      {Number(selectedObat.price || 0).toLocaleString("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                      Stok: {selectedObat.stock_quantity ?? 0} unit
                    </span>
                  </div>
                </div>
                <h4 className="text-base font-bold text-slate-800 mt-1.5">
                  {selectedObat.name}
                </h4>
              </div>

              {/* Section 1: KFA Kemenkes SATUSEHAT */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    1. Pemetaan KFA Kemenkes (SATUSEHAT FHIR)
                  </h4>
                </div>
                {loadingMap ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    Memuat data KFA...
                  </div>
                ) : kfaMappings.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Kode KFA</th>
                          <th className="px-4 py-2.5">Nama Produk KFA</th>
                          <th className="px-4 py-2.5">Zat Aktif & Sediaan</th>
                          <th className="px-4 py-2.5">NIE BPOM</th>
                          <th className="px-4 py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {kfaMappings.map((kfa) => (
                          <tr key={kfa.kfa_code} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-bold text-blue-600 text-xs">
                              {kfa.kfa_code}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              <div>{kfa.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {kfa.atc_code ? `ATC: ${kfa.atc_code}` : ""}{" "}
                                {kfa.snomed_concept_id ? `| SNOMED: ${kfa.snomed_concept_id}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              <div>{kfa.active_substance || "-"}</div>
                              <div className="text-slate-400">
                                {kfa.dosage_form} {kfa.strength ? `(${kfa.strength})` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-600">
                              {kfa.bpom_nie || "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {kfa.is_primary ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                                  Primary
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium">
                                  Sekunder
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-5 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm">
                    Belum dipetakan ke Katalog KFA Kemenkes
                  </div>
                )}
              </div>

              {/* Section 2: BPJS DPHO / FORNAS */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    2. Pemetaan BPJS Kesehatan (DPHO / FORNAS / PRB)
                  </h4>
                </div>
                {loadingMap ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    Memuat data DPHO BPJS...
                  </div>
                ) : dphoMappings.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Kode DPHO</th>
                          <th className="px-4 py-2.5">Nama Obat BPJS</th>
                          <th className="px-4 py-2.5 text-center">Formularium</th>
                          <th className="px-4 py-2.5">Restriksi & Batas Peresepan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dphoMappings.map((dpho) => (
                          <tr key={dpho.dpho_code} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-bold text-emerald-700 text-xs">
                              {dpho.dpho_code}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {dpho.dpho_name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {dpho.is_fornas && (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                    FORNAS
                                  </Badge>
                                )}
                                {dpho.is_prb && (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                    PRB
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {dpho.restriction ? (
                                <div className="flex items-start gap-1 bg-amber-50 text-amber-900 p-2 rounded border border-amber-200/60">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span>{dpho.restriction}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">Tidak ada restriksi khusus</span>
                              )}
                              {dpho.max_qty_per_claim ? (
                                <div className="text-[11px] text-slate-500 mt-1">
                                  Batas klaim: <span className="font-semibold">{dpho.max_qty_per_claim} unit</span>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-5 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm">
                    Belum dipetakan ke Katalog DPHO / FORNAS BPJS
                  </div>
                )}
              </div>

              {/* Section 3: Poliklinik Terkait */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    3. Poliklinik Terkait
                  </h4>
                </div>
                {loadingMap ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    Memuat data poliklinik...
                  </div>
                ) : polyclinics.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    {polyclinics.map((code) => {
                      const poliName = getPolyclinicName(code);
                      return (
                        <div
                          key={code}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-purple-800 shadow-2xs text-sm"
                        >
                          <span className="font-mono font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                            {code}
                          </span>
                          <span className="font-medium text-slate-800">{poliName}</span>
                        </div>
                      );
                    })}
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
