import { Search, BookOpen, Layers, Pill, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMasterData } from "@/hooks/useMasterData";
import { useDebounce } from "@/hooks/useDebounce";
import { useState } from "react";
import type { KFAItem } from "@/lib/masterDataApi";

export function KFAPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const debouncedSearch = useDebounce(search, 400);

  const endpoint = `/master/kfa?page=${page}&page_size=${pageSize}${
    debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""
  }`;

  const { data, loading, error, meta } = useMasterData<KFAItem>(endpoint);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Katalog KFA (Kemenkes)
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Kamus Farmasi & Alat Kesehatan RI untuk Integrasi SATUSEHAT (FHIR Medication)
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Badge */}
        {meta && (
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <Pill className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-600">
              Total Master KFA:
            </span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {meta.total_data || 0}
            </span>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        {/* Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari kode KFA, nama produk, atau zat aktif..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-slate-50 border-slate-200 focus:bg-white text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-slate-700 uppercase font-semibold text-xs border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Kode KFA</th>
                <th className="px-4 py-3">Nama Produk KFA</th>
                <th className="px-4 py-3">Zat Aktif (Substance)</th>
                <th className="px-4 py-3">Bentuk & Kekuatan</th>
                <th className="px-4 py-3">NIE BPOM</th>
                <th className="px-4 py-3 text-center">ATC / SNOMED</th>
                <th className="px-4 py-3 text-center rounded-r-lg">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Memuat katalog KFA...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-rose-500">
                    {error}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Tidak ada data KFA yang ditemukan.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.kfa_code} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">
                      {item.kfa_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{item.name}</div>
                      {item.mapped_item_count && item.mapped_item_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-0.5">
                          <Layers className="w-3 h-3" /> Dipetakan ke {item.mapped_item_count} item RS
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.active_substance || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.dosage_form && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {item.dosage_form}
                          </span>
                        )}
                        {item.strength && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                            {item.strength}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {item.bpom_nie ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {item.bpom_nie}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1 text-xs">
                        {item.atc_code && (
                          <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            ATC: {item.atc_code}
                          </span>
                        )}
                        {item.snomed_concept_id && (
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            SNOMED: {item.snomed_concept_id}
                          </span>
                        )}
                        {!item.atc_code && !item.snomed_concept_id && (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
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
