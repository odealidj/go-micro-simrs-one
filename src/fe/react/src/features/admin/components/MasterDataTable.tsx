import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMasterData } from "@/hooks/useMasterData";
import { useDebounce } from "@/hooks/useDebounce";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface MasterDataTableProps<T> {
  title: string;
  description: string;
  endpoint: string;
  columns: string[];
  renderRow: (item: T, index: number) => ReactNode;
  requiresPoliFilter?: boolean;
}

export function MasterDataTable<T>({
  title,
  description,
  endpoint,
  columns,
  renderRow,
  requiresPoliFilter = false
}: MasterDataTableProps<T>) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);

  const [poliCode, setPoliCode] = useState(requiresPoliFilter ? "UMUM" : "");
  const debouncedPoliCode = useDebounce(poliCode, 500);

  const actualEndpoint = requiresPoliFilter 
    ? `${endpoint}/poli/${debouncedPoliCode || 'UMUM'}` 
    : endpoint;

  const { data, loading, error, page, setPage, setSearch, meta } = 
    useMasterData<T>(actualEndpoint);

  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch, setSearch, setPage, debouncedPoliCode]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <p className="text-slate-500 text-sm mt-1">{description}</p>
        
        <div className="mt-6 flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex gap-4 w-full md:w-1/2">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari data..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 transition-colors"
              />
            </div>
            {requiresPoliFilter && (
              <Input
                type="text"
                placeholder="Kode Poli (e.g. UMUM)"
                value={poliCode}
                onChange={(e) => setPoliCode(e.target.value)}
                className="w-48 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 transition-colors"
              />
            )}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          {error && <div className="text-red-500 mb-4">{error}</div>}
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className="px-6 py-4">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={columns.length} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={columns.length} className="text-center py-8 text-slate-500">Tidak ada data</td></tr>
              ) : (
                data.map((item, i) => renderRow(item, i))
              )}
            </tbody>
          </table>
        </div>
        
        {meta && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Total data: {meta.total_count}
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm">Halaman {page} dari {meta.total_pages}</span>
              <button 
                disabled={page >= meta.total_pages} 
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
