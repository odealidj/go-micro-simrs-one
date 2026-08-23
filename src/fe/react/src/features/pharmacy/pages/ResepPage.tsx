import { useState } from "react";
import { dispensePrescription } from "../api/pharmacyApi";
import type { Prescription } from "../api/pharmacyApi";
import {
  ClipboardList,
  PackageCheck,
  AlertCircle,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ResepPage() {
  const [search, setSearch] = useState("");
  const [prescriptions] = useState<Prescription[]>([]);
  const [loading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = prescriptions.filter((p) =>
    (p.patient_name || p.encounter_no || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDispense = async (p: Prescription) => {
    setProcessingId(p.prescription_id);
    try {
      await dispensePrescription(p.prescription_id);
      toast.success("Dispensing Berhasil", {
        description: `Resep pasien ${p.patient_name} telah diselesaikan.`,
      });
    } catch (err: any) {
      toast.error("Gagal", {
        description: err?.response?.data?.message || "Terjadi kesalahan saat dispensing.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 text-violet-600" />
            <h1 className="text-2xl font-bold text-slate-800">Resep Masuk</h1>
          </div>
          <p className="text-slate-500 text-sm">Daftar resep yang menunggu penyiapan obat</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari nama pasien / encounter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Info: Integrasi SSE */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl px-5 py-4">
        <AlertCircle className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
        <div className="text-sm text-violet-700">
          <p className="font-medium">Antrian Real-time Farmasi</p>
          <p className="mt-1 text-violet-600">
            Sistem mendukung Server-Sent Events (SSE) via <code className="bg-violet-100 px-1 rounded">/queue/pharmacy/stream</code>. 
            Integrasi real-time akan menampilkan resep baru secara otomatis tanpa refresh halaman.
          </p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            Daftar Resep{" "}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              {filtered.length}
            </span>
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
            <ClipboardList className="h-14 w-14" />
            <p className="text-slate-400 text-sm">Belum ada resep yang masuk</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <div key={p.prescription_id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-slate-800">{p.patient_name}</p>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium border",
                        p.status === "DISPENSED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {p.status === "DISPENSED" ? "Sudah Dilayani" : "Menunggu"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-3 mb-2">
                      <span>#{p.encounter_no}</span>
                      <span>dr. {p.doctor_name}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.created_at}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(p.items || []).map((item, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 text-xs border border-violet-100">
                          {item.drug_name} — {item.quantity} {item.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                  {p.status !== "DISPENSED" && (
                    <Button
                      size="sm"
                      onClick={() => handleDispense(p)}
                      disabled={processingId === p.prescription_id}
                      className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                    >
                      {processingId === p.prescription_id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-1.5"><PackageCheck className="h-4 w-4" /> Dispense</span>
                      )}
                    </Button>
                  )}
                  {p.status === "DISPENSED" && (
                    <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Selesai
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
