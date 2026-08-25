import { Search, ShieldCheck, Layers, Pill, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMasterData } from "@/hooks/useMasterData";
import { useDebounce } from "@/hooks/useDebounce";
import { useState } from "react";
import type { DPHOItem } from "@/features/emr/api/emrApi";

export function DPHOPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "fornas" | "prb">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const debouncedSearch = useDebounce(search, 400);

  let endpoint = `/master/dpho?page=${page}&page_size=${pageSize}`;
  if (debouncedSearch) {
    endpoint += `&search=${encodeURIComponent(debouncedSearch)}`;
  }
  if (filterType === "fornas") {
    endpoint += `&is_fornas=true`;
  } else if (filterType === "prb") {
    endpoint += `&is_prb=true`;
  }

  const { data, loading, error, meta } = useMasterData<DPHOItem>(endpoint);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Katalog DPHO / FORNAS (BPJS)
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Daftar dan Plafon Harga Obat & Formularium Nasional untuk Standar Klaim BPJS Kesehatan
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Badge */}
        {meta && (
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <Pill className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-600">
              Total Master DPHO:
            </span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {meta.total_data || 0}
            </span>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari kode DPHO atau nama obat..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-slate-50 border-slate-200 focus:bg-white text-sm"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              className={filterType === "all" ? "bg-slate-800 hover:bg-slate-700" : "text-slate-600"}
              onClick={() => {
                setFilterType("all");
                setPage(1);
              }}
            >
              Semua
            </Button>
            <Button
              variant={filterType === "fornas" ? "default" : "outline"}
              size="sm"
              className={filterType === "fornas" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"}
              onClick={() => {
                setFilterType("fornas");
                setPage(1);
              }}
            >
              FORNAS BPJS
            </Button>
            <Button
              variant={filterType === "prb" ? "default" : "outline"}
              size="sm"
              className={filterType === "prb" ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-blue-700 border-blue-200 hover:bg-blue-50"}
              onClick={() => {
                setFilterType("prb");
                setPage(1);
              }}
            >
              Program Rujuk Balik (PRB)
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 uppercase font-semibold text-xs border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Kode DPHO</th>
                <th className="px-4 py-3">Nama Obat BPJS</th>
                <th className="px-4 py-3 text-center">Status Formularium</th>
                <th className="px-4 py-3">Catatan Restriksi BPJS</th>
                <th className="px-4 py-3 text-center">Maks. Klaim</th>
                <th className="px-4 py-3 text-center rounded-r-lg">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Memuat katalog DPHO BPJS...
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
                    Tidak ada data DPHO yang ditemukan.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.dpho_code} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                      {item.dpho_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{item.dpho_name}</div>
                      {item.mapped_item_count && item.mapped_item_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 mt-0.5">
                          <Layers className="w-3 h-3" /> Dipetakan ke {item.mapped_item_count} item RS
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {item.is_fornas && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> FORNAS
                          </span>
                        )}
                        {item.is_prb && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            PRB
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-sm">
                      {item.restriction ? (
                        <div className="flex items-start gap-1.5 bg-amber-50/60 text-amber-900 p-2 rounded-lg border border-amber-200/70">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{item.restriction}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Tidak ada restriksi khusus</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.max_qty_per_claim && item.max_qty_per_claim > 0 ? (
                        <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {item.max_qty_per_claim} unit
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={item.is_active !== false ? "default" : "secondary"}
                        className={
                          item.is_active !== false
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500"
                        }
                      >
                        {item.is_active !== false ? "Aktif" : "Non-aktif"}
                      </Badge>
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
              Menampilkan <span className="font-semibold text-slate-800">{data.length}</span> dari{" "}
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
    </div>
  );
}
