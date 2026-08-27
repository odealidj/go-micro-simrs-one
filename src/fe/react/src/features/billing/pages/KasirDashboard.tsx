import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { KasirPageHeader } from "../components/KasirPageHeader";
import { kasirTheme, formatRupiah } from "../theme";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  sub?: string;
  highlight?: boolean;
}

function StatCard({ label, value, icon: Icon, color, bgColor, borderColor, sub, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex items-center gap-4 transition-all duration-200",
      highlight ? "bg-gradient-to-br from-amber-500/10 via-white to-white border-amber-200/80 shadow-md shadow-amber-500/5" : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
    )}>
      <div className={cn("p-3.5 rounded-2xl shrink-0 shadow-2xs border", bgColor, borderColor)}>
        <Icon className={cn("h-6 w-6", color)} />
      </div>
      <div className="overflow-hidden">
        <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export function KasirDashboard() {
  const navigate = useNavigate();
  const [encounterSearch, setEncounterSearch] = useState("");
  const [queue, setQueue] = useState<BillingPatientQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBillingQueue()
      .then((data) => setQueue(data))
      .catch((err) => console.error("Failed to load queue", err))
      .finally(() => setLoading(false));
  }, []);

  const pendingList = useMemo(() => {
    return queue.filter((item) => item.status === "WAITING_FOR_PAYMENT" || item.status === "REGISTERED");
  }, [queue]);

  const paidList = useMemo(() => {
    return queue.filter(
      (item) => item.status !== "WAITING_FOR_PAYMENT" && item.status !== "REGISTERED" && item.status !== "CANCELLED"
    );
  }, [queue]);

  const totalRevenueEst = useMemo(() => {
    return paidList.reduce((acc, curr) => acc + (curr.estimated_amount || 50000), 0);
  }, [paidList]);

  const todayStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounterSearch.trim()) {
      navigate("/kasir/antrean");
      return;
    }
    // Check if search matches any patient MRN or encounter in queue
    const match = queue.find(
      (p) =>
        p.encounter_no.toLowerCase().includes(encounterSearch.trim().toLowerCase()) ||
        p.mrn.toLowerCase().includes(encounterSearch.trim().toLowerCase()) ||
        p.patient_name.toLowerCase().includes(encounterSearch.trim().toLowerCase())
    );
    if (match) {
      navigate(`/kasir/bayar/${match.encounter_no}`);
    } else {
      navigate(`/kasir/antrean?q=${encodeURIComponent(encounterSearch.trim())}`);
    }
  };

  return (
    <div className={kasirTheme.layout.container}>
      {/* Kasir Page Header */}
      <KasirPageHeader
        title="Dashboard Kasir & Pembayaran"
        description={`Pusat kendali transaksi kasir, antrean pembayaran, dan laporan penerimaan harian • ${todayStr}`}
        badge="Kasir Rawat Jalan"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate("/kasir/antrean")}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 gap-2 transition-all"
            >
              <Receipt className="h-4 w-4" />
              Antrean Tagihan ({pendingList.length})
            </Button>
          </div>
        }
      />

      {/* Stats Ringkasan (4 Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Menunggu Pembayaran"
          value={loading ? "..." : `${pendingList.length} Pasien`}
          sub="Prioritas kasir untuk ditagihkan"
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
          borderColor="border-amber-200"
          highlight
        />
        <StatCard
          label="Lunas Hari Ini"
          value={loading ? "..." : `${paidList.length} Pasien`}
          sub="Telah diteruskan ke Poliklinik"
          icon={CheckCircle2}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-200"
        />
        <StatCard
          label="Total Pasien Terdaftar"
          value={loading ? "..." : `${queue.length} Pasien`}
          sub="Total registrasi hari ini"
          icon={TrendingUp}
          color="text-sky-600"
          bgColor="bg-sky-50"
          borderColor="border-sky-200"
        />
        <StatCard
          label="Penerimaan Hari Ini"
          value={loading ? "..." : formatRupiah(totalRevenueEst)}
          sub={`${paidList.length} transaksi selesai`}
          icon={Receipt}
          color="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
        />
      </div>

      {/* Hero Alur Utama Kasir Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 sm:p-8 text-white shadow-lg shadow-amber-500/20">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 transform skew-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-xs text-white">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              Alur Kasir Terintegrasi
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Antrean Tagihan & Transaksi Pembayaran Pasien
            </h2>
            <p className="text-amber-50/90 text-xs sm:text-sm leading-relaxed">
              Buka antrean tagihan untuk memproses pembayaran biaya pendaftaran, tindakan medis poliklinik, resep obat farmasi, dan cetak kuitansi resmi SIMRS.
            </p>
          </div>
          <Link
            to="/kasir/antrean"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-amber-50 text-amber-900 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shrink-0 active:scale-95 cursor-pointer"
          >
            <span>Buka Antrean Tagihan</span>
            <ArrowRight className="h-4 w-4 text-amber-600" />
          </Link>
        </div>
      </div>

      {/* Pencarian Invoice & Encounter Cepat */}
      <Card className="card-premium">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Pencarian Tagihan / Pasien Cepat</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Masukkan No. Rekam Medis (RM), Nomor Encounter/Registrasi, atau Nama Pasien
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Contoh: 10-00-00-01, 202608010015, atau Budi Santoso..."
                value={encounterSearch}
                onChange={(e) => setEncounterSearch(e.target.value)}
                className="pl-12 h-12 bg-white border-slate-200/80 rounded-xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 text-sm shadow-2xs"
              />
            </div>
            <Button
              type="submit"
              className="h-12 px-7 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition-all gap-2 shrink-0"
            >
              <CreditCard className="h-4 w-4 text-amber-400" />
              <span>Proses Pembayaran</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Equal Height Split Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Antrean Tagihan Terkini (8 cols) */}
        <div className="xl:col-span-8 flex flex-col">
          <Card className="card-premium overflow-hidden flex flex-col h-full">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Antrean Menunggu Pembayaran
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Pasien prioritas yang siap dilakukan proses pembayaran kasir
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  {pendingList.length} Menunggu
                </span>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-x-auto custom-scrollbar flex flex-col min-h-[360px]">
              {loading ? (
                <div className="flex-1 flex items-center justify-center py-16 text-slate-400">
                  <span>Memuat data antrean...</span>
                </div>
              ) : pendingList.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {pendingList.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-amber-50/30 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{item.patient_name}</span>
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {item.mrn}
                            </span>
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Poli Umum
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <span>Reg: #{item.encounter_no}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">
                              Estimasi: {formatRupiah(item.estimated_amount || 50000)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                          onClick={() => navigate(`/kasir/bayar/${item.encounter_no}`)}
                          size="sm"
                          className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs shadow-amber-600/20 transition-all gap-1.5"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Bayar Sekarang
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500/40" />
                  <p className="text-sm font-semibold text-slate-700">Semua Tagihan Selesai</p>
                  <p className="text-xs text-slate-400">Tidak ada antrean pasien yang menunggu pembayaran.</p>
                </div>
              )}
            </div>
            <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/40 rounded-b-2xl shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Menampilkan maksimal 5 antrean teratas
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/kasir/antrean")}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1 rounded-lg"
              >
                Buka Semua Antrean ({pendingList.length})
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Shortcut Menu (4 cols) */}
        <div className="xl:col-span-4 flex flex-col">
          <Card className="card-premium overflow-hidden flex flex-col h-full">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 shrink-0">
              <CardTitle className="text-base font-bold text-slate-900">Aksi & Navigasi Kasir</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">Pintasan menu operasional kasir</CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <Link
                to="/kasir/antrean"
                className="group p-4 rounded-xl border border-slate-200/80 bg-white hover:border-amber-400 hover:shadow-md transition-all flex items-center gap-3"
              >
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors border border-amber-200/60">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-xs">Antrean Tagihan Pasien</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Lihat seluruh antrean tagihan</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </Link>

              <Link
                to="/kasir/riwayat-pembayaran"
                className="group p-4 rounded-xl border border-slate-200/80 bg-white hover:border-sky-400 hover:shadow-md transition-all flex items-center gap-3"
              >
                <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-100 transition-colors border border-sky-200/60">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-xs">Riwayat & Cetak Kwitansi</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Arsip transaksi & cetak nota</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
              </Link>

              <Link
                to="/kasir/bayar"
                className="group p-4 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-400 hover:shadow-md transition-all flex items-center gap-3"
              >
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors border border-emerald-200/60">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-xs">Terminal Transaksi Langsung</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Proses pembayaran invoice mandiri</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </Link>
            </CardContent>
            <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/40 rounded-b-2xl shrink-0">
              <Button
                variant="outline"
                className="w-full font-semibold text-amber-700 border-amber-200 hover:bg-amber-50 rounded-xl text-xs h-10"
                onClick={() => navigate("/kasir/riwayat-pembayaran")}
              >
                Lihat Rekap Harian
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
