import { MasterDataTable } from "../../components/MasterDataTable";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getICD9SuggestionsForTindakan } from "@/features/emr/api/emrApi";

export function TindakanPage() {
  const [selectedTindakan, setSelectedTindakan] = useState<any>(null);
  const [icd9Suggestions, setIcd9Suggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewIcd9 = async (item: any) => {
    setSelectedTindakan(item);
    setIcd9Suggestions([]);
    setIsModalOpen(true);
    setLoadingSuggestions(true);
    try {
      const suggestions = await getICD9SuggestionsForTindakan(item.kode_tindakan);
      setIcd9Suggestions(suggestions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <>
      <MasterDataTable<any>
        title="Tindakan & Tarif"
        description="Data master tindakan medis beserta tarif dan pemetaan kode prosedur ICD-9"
        endpoint="/master/tindakan"
        requiresPoliFilter={false}
        columns={["ID Tindakan", "Nama Tindakan", "Harga Dasar", "Pemetaan ICD-9", "Aksi"]}
        renderRow={(item, i) => (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-medium text-slate-900">{item.kode_tindakan || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.nama_tindakan || "-"}</td>
            <td className="px-6 py-4 text-slate-600">
              {Number(item.base_price || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}
            </td>
            <td className="px-6 py-4">
              {item.icd9_count && item.icd9_count > 0 ? (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Terpetakan ({item.icd9_count} ICD-9)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50/80 text-amber-700 border-amber-200/90 hover:bg-amber-100/80 font-medium inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Belum Dipetakan
                </Badge>
              )}
            </td>
            <td className="px-6 py-4 text-right">
              <Button variant="outline" size="sm" onClick={() => handleViewIcd9(item)}>
                <Eye className="w-4 h-4 mr-2" />
                Pemetaan ICD-9
              </Button>
            </td>
          </tr>
        )}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pemetaan ICD-9</DialogTitle>
            <DialogDescription>
              {selectedTindakan && (
                <span>
                  Pemetaan untuk tindakan: <strong>{selectedTindakan.kode_tindakan} - {selectedTindakan.nama_tindakan}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {loadingSuggestions ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : icd9Suggestions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                Belum ada pemetaan ICD-9 untuk tindakan ini.
              </div>
            ) : (
              <div className="space-y-3">
                {icd9Suggestions.map((icd9, idx) => (
                  <div key={idx} className="flex items-start justify-between p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-blue-200 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{icd9.icd9_code || "-"}</span>
                        {icd9.is_primary && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600 text-sm">{icd9.icd9_name || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
