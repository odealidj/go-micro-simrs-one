import { useState } from "react";
import { MasterDataTable } from "../../components/MasterDataTable";
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
  Layers,
  ShieldCheck,
  BookOpen,
  Building2,
  AlertCircle,
} from "lucide-react";
import {
  getObatMappingDetails,
  type ObatKFAMapDetail,
  type ObatDPHOMapDetail,
} from "@/features/emr/api/emrApi";

interface ObatItem {
  item_code: string;
  name: string;
  price: number;
  stock_quantity?: number;
  polyclinics?: string[];
  kfa_count?: number;
  dpho_count?: number;
  is_fornas?: boolean;
  kfa_code?: string;
  bpjs_dpho_code?: string;
  restriction?: string;
}

export function ObatPage() {
  const [selectedObat, setSelectedObat] = useState<ObatItem | null>(null);
  const [kfaMappings, setKfaMappings] = useState<ObatKFAMapDetail[]>([]);
  const [dphoMappings, setDphoMappings] = useState<ObatDPHOMapDetail[]>([]);
  const [polyclinics, setPolyclinics] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);

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
    <>
      <MasterDataTable<ObatItem>
        title="Inventaris Obat"
        description="Master obat dan perbekalan farmasi terintegrasi standar KFA (SATUSEHAT) & DPHO/FORNAS (BPJS)"
        endpoint="/master/obat"
        requiresPoliFilter={false}
        columns={["Kode Obat", "Nama Obat", "Harga", "Stok", "Pemetaan", "Aksi"]}
        renderRow={(item, i) => (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-mono font-bold text-blue-600">
              {item.item_code || "-"}
            </td>
            <td className="px-6 py-4">
              <div className="font-medium text-slate-900">{item.name || "-"}</div>
              {item.restriction ? (
                <div className="text-xs text-amber-700 italic mt-0.5 truncate max-w-xs" title={item.restriction}>
                  Restriksi: {item.restriction}
                </div>
              ) : null}
            </td>
            <td className="px-6 py-4 font-mono font-semibold text-slate-700">
              {Number(item.price || 0).toLocaleString("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              })}
            </td>
            <td className="px-6 py-4">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
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
            <td className="px-6 py-4 text-center">
              <div className="flex flex-col items-center gap-1">
                {item.kfa_count && item.kfa_count > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Layers className="w-3 h-3" /> {item.kfa_count} KFA
                  </span>
                ) : null}
                {item.is_fornas ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <ShieldCheck className="w-3 h-3" /> FORNAS (BPJS)
                  </span>
                ) : item.dpho_count && item.dpho_count > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    <ShieldCheck className="w-3 h-3" /> {item.dpho_count} DPHO
                  </span>
                ) : null}
                {(!item.kfa_count || item.kfa_count === 0) && (!item.dpho_count || item.dpho_count === 0) && (
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
                <h4 className="text-base font-semibold text-slate-800 mt-1.5">
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
                    2. Pemetaan BPJS Kesehatan (DPHO / FORNAS)
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

              {/* Section 3: Poliklinik / Depo Terkait */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    3. Ketersediaan Poliklinik / Depo
                  </h4>
                </div>
                {loadingMap ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    Memuat data poliklinik...
                  </div>
                ) : polyclinics.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {polyclinics.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white text-indigo-700 border border-indigo-200 shadow-2xs"
                      >
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        Poli {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-5 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm">
                    Tersedia di semua unit / belum dikhususkan ke poliklinik tertentu
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
