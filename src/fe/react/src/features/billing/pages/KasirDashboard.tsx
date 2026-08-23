import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getBillingQueue, type BillingPatientQueueItem } from "../api/billingApi";
import {
  Wallet,
  Receipt,
  CheckCircle2,
  Clock,
  ChevronRight,
  Search,
  TrendingUp,
  ArrowRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, bgColor, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={cn("p-3.5 rounded-2xl shrink-0 shadow-2xs", bgColor)}>
        <Icon className={cn("h-6 w-6", color)} />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function KasirDashboard() {
  const [encounterSearch, setEncounterSearch] = useState("");
  const [queue, setQueue] = useState<BillingPatientQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBillingQueue()
      .then((data) => setQueue(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const countUnpaid = queue.filter((item) => item.status === "WAITING_FOR_PAYMENT").length;
  const countPaid = queue.filter(
    (item) => item.status !== "WAITING_FOR_PAYMENT" && item.status !== "CANCELLED"
  ).length;

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-black text-slate-900">Dashboard Kasir & Pembayaran</h1>
        </div>
        <p className="text-slate-500 text-sm">{today}</p>
      </div>

      {/* Stats Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Menunggu Pembayaran"
          value={loading ? "..." : `${countUnpaid} Pasien`}
          sub="Prioritas kasir untuk ditagihkan"
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-100"
        />
        <StatCard
          label="Lunas Hari Ini"
          value={loading ? "..." : `${countPaid} Pasien`}
          sub="Telah diteruskan ke Poliklinik"
          icon={CheckCircle2}
          color="text-emerald-600"
          bgColor="bg-emerald-100"
        />
        <StatCard
          label="Total Pasien Terdaftar"
          value={loading ? "..." : `${queue.length} Pasien`}
          sub="Total registrasi hari ini"
          icon={TrendingUp}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
      </div>

      {/* Shortcut Utama Kasir Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            Alur Utama Kasir
          </div>
          <h2 className="text-xl font-black">Antrean Tagihan & Transaksi Pembayaran Pasien</h2>
          <p className="text-amber-100 text-xs max-w-xl">
            Buka antrean kasir untuk melihat pasien yang menunggu pembayaran, rincian biaya pendaftaran/tindakan medis/obat, dan cetak kuitansi resmi.
          </p>
        </div>
        <Link
          to="/kasir/antrean"
          className="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-amber-50 text-amber-900 rounded-xl font-black text-sm transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer"
        >
          <span>Buka Antrean Tagihan</span>
          <ArrowRight className="h-4 w-4 text-amber-600" />
        </Link>
      </div>

      {/* Cari Invoice Cepat */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-sm">Pencarian Invoice Cepat</h2>
          <p className="text-xs text-slate-500 mt-0.5">Masukkan nomor encounter atau nomor registrasi pasien</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Contoh: 202608030008 atau ENC-..."
                value={encounterSearch}
                onChange={(e) => setEncounterSearch(e.target.value)}
                className="pl-10 h-11 border-slate-200 rounded-xl"
              />
            </div>
            <Link
              to={encounterSearch ? `/kasir/bayar/${encounterSearch}` : "/kasir/antrean"}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Proses Bayar <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Shortcut Aksi Navigasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/kasir/antrean"
          className="group bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-amber-400 transition-all"
        >
          <div className="p-3.5 bg-amber-50 rounded-2xl group-hover:bg-amber-100 transition-colors border border-amber-200">
            <Receipt className="h-6 w-6 text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-900">Antrean Tagihan Pasien</p>
            <p className="text-xs text-slate-500 mt-0.5">Lihat daftar seluruh pasien yang menunggu pembayaran</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-amber-600 transition-colors" />
        </Link>

        <Link
          to="/kasir/invoice"
          className="group bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
        >
          <div className="p-3.5 bg-blue-50 rounded-2xl group-hover:bg-blue-100 transition-colors border border-blue-200">
            <FileText className="h-6 w-6 text-blue-700" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-900">Riwayat Pembayaran</p>
            <p className="text-xs text-slate-500 mt-0.5">Lihat arsip transaksi lunas dan cetak ulang kwitansi</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </Link>
      </div>
    </div>
  );
}
