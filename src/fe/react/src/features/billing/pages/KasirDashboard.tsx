import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getBillingQueue,
  getInvoice,
  getRevenueReport,
  type BillingPatientQueueItem,
  type Invoice,
  type RevenueReportData,
  type SettlementTransactionItem,
} from "../api/billingApi";
import { useAuth } from "@/lib/AuthContext";
import {
  Wallet,
  Receipt,
  CheckCircle2,
  Clock,
  ChevronRight,
  Search,
  TrendingUp,
  FileText,
  CreditCard,
  RefreshCw,
  Eye,
  BadgeDollarSign,
  Banknote,
  QrCode,
  ShieldCheck,
  Printer,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KasirPageHeader } from "../components/KasirPageHeader";
import { kasirTheme, formatRupiah } from "../theme";
import { toast } from "sonner";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeText?: string;
  badgeColor?: string;
  sub?: string;
  highlight?: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  borderColor,
  badgeText,
  badgeColor = "bg-slate-100 text-slate-700 border-slate-200",
  sub,
  highlight,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between relative overflow-hidden group hover:shadow-md",
        highlight
          ? "bg-gradient-to-br from-amber-500/10 via-white to-white border-amber-200/90 shadow-sm shadow-amber-500/5 hover:border-amber-300"
          : "bg-white border-slate-200/80 shadow-2xs hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</p>
        </div>
        <div className={cn("p-3 rounded-xl shrink-0 shadow-2xs border transition-transform group-hover:scale-105", bgColor, borderColor)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between gap-2 text-xs">
        {sub && <span className="text-slate-500 text-[11px] truncate font-medium">{sub}</span>}
        {badgeText && (
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0", badgeColor)}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

function getDepartmentName(code?: string) {
  if (!code || code === "-") return "Poli Umum";
  if (code === "01" || code === "UMU" || code.toLowerCase().includes("umum")) return "Poli Umum";
  if (code === "02" || code.toLowerCase().includes("gigi")) return "Poli Gigi";
  if (code === "03" || code.toLowerCase().includes("anak")) return "Poli Anak";
  if (code === "04" || code.toLowerCase().includes("dalam")) return "Poli Penyakit Dalam";
  if (code === "05" || code.toLowerCase().includes("bedah")) return "Poli Bedah";
  if (code === "06" || code.toLowerCase().includes("mata")) return "Poli Mata";
  if (code === "07" || code.toLowerCase().includes("tht")) return "Poli THT";
  if (code === "08" || code.toLowerCase().includes("obgyn") || code.toLowerCase().includes("kandungan"))
    return "Poli Kandungan";
  return `Poli ${code}`;
}

function getShiftInfo() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 14) {
    return { name: "Pagi", time: "07:00 - 14:00 WIB", badge: "Shift Pagi" };
  } else if (hour >= 14 && hour < 21) {
    return { name: "Siang / Sore", time: "14:00 - 21:00 WIB", badge: "Shift Siang" };
  } else {
    return { name: "Malam", time: "21:00 - 07:00 WIB", badge: "Shift Malam" };
  }
}

export function KasirDashboard() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [encounterSearch, setEncounterSearch] = useState("");
  const [queue, setQueue] = useState<BillingPatientQueueItem[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick Invoice Detail Modal state
  const [selectedEncounter, setSelectedEncounter] = useState<BillingPatientQueueItem | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Quick Receipt Modal state
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<SettlementTransactionItem | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  const shiftInfo = useMemo(() => getShiftInfo(), []);

  const fetchDashboardData = async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    else setLoading(true);
    try {
      const [queueRes, reportRes] = await Promise.all([
        getBillingQueue(),
        getRevenueReport({ date: "TODAY" }),
      ]);
      setQueue(queueRes);
      setRevenueData(reportRes);
      if (showToast) toast.success("Data antrean dan penerimaan kasir berhasil diperbarui.");
    } catch (err) {
      console.error("Failed to load dashboard data", err);
      if (showToast) toast.error("Gagal memperbarui data antrean kasir.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const pendingList = useMemo(() => {
    return queue.filter(
      (item) => item.has_unpaid || item.status === "WAITING_FOR_PAYMENT" || item.status === "REGISTERED" || item.status === "MENUNGGU"
    );
  }, [queue]);

  const paidList = useMemo(() => {
    return queue.filter(
      (item) => !item.has_unpaid && item.status !== "WAITING_FOR_PAYMENT" && item.status !== "REGISTERED" && item.status !== "CANCELLED" && item.status !== "BATAL" && item.payment_status !== "CANCELLED"
    );
  }, [queue]);

  const totalRevenue = useMemo(() => {
    if (revenueData?.metrics?.total_revenue !== undefined) {
      return revenueData.metrics.total_revenue;
    }
    return 0;
  }, [revenueData]);

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
    const q = encounterSearch.trim().toLowerCase();
    const match = queue.find(
      (p) =>
        p.encounter_no.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.patient_name.toLowerCase().includes(q)
    );
    if (match) {
      navigate(`/kasir/bayar/${match.encounter_no}`);
    } else {
      navigate(`/kasir/antrean?q=${encodeURIComponent(encounterSearch.trim())}`);
    }
  };

  const handleOpenInvoiceDetail = async (item: BillingPatientQueueItem) => {
    setSelectedEncounter(item);
    setInvoiceLoading(true);
    try {
      const inv = await getInvoice(item.encounter_no);
      setInvoiceDetail(inv);
    } catch (err) {
      console.error("Failed to fetch invoice", err);
      toast.error("Gagal memuat rincian invoice pasien.");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const renderPaymentBadge = (method: string) => {
    switch (method?.toUpperCase()) {
      case "QRIS":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
            <QrCode className="h-3 w-3 text-sky-600" />
            QRIS
          </span>
        );
      case "DEBIT":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
            <CreditCard className="h-3 w-3 text-indigo-600" />
            DEBIT
          </span>
        );
      case "BPJS":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
            <ShieldCheck className="h-3 w-3 text-blue-600" />
            BPJS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            <Banknote className="h-3 w-3 text-emerald-600" />
            TUNAI
          </span>
        );
    }
  };

  const handleOpenReceiptModal = async (tx: SettlementTransactionItem) => {
    setSelectedReceiptTx(tx);
    setIsReceiptModalOpen(true);
    setReceiptLoading(true);
    try {
      const inv = await getInvoice(tx.encounter_no);
      setReceiptInvoice(inv);
    } catch (err) {
      console.error("Failed to fetch invoice for receipt", err);
      setReceiptInvoice(null);
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <div className={kasirTheme.layout.container}>
      {/* Kasir Page Header */}
      <KasirPageHeader
        title="Dashboard Kasir & Pembayaran"
        description={`Pusat kendali transaksi kasir • ${shiftInfo.badge} (${shiftInfo.time}) • ${todayStr}`}
        badge="Loket 01 Aktif"
        icon={Wallet}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing || loading}
              className="h-10 px-3.5 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", (isRefreshing || loading) && "animate-spin text-amber-600")} />
              <span>Segarkan</span>
            </Button>
            <Button
              onClick={() => navigate("/kasir/antrean")}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 gap-2 transition-all cursor-pointer"
            >
              <Receipt className="h-4 w-4" />
              <span>Antrean Tagihan ({pendingList.length})</span>
            </Button>
          </div>
        }
      />

      {/* Stats Ringkasan 4 Kartu Minimalis & Pro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Menunggu Pembayaran"
          value={loading ? "..." : `${pendingList.length} Pasien`}
          sub="Prioritas kasir untuk ditagihkan"
          badgeText="Prioritas Kasir"
          badgeColor="bg-amber-50 text-amber-800 border-amber-200 font-bold"
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
          badgeText="Selesai Ditagih"
          badgeColor="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold"
          icon={CheckCircle2}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          borderColor="border-emerald-200"
        />
        <StatCard
          label="Total Pasien Terdaftar"
          value={loading ? "..." : `${queue.length} Pasien`}
          sub="Kunjungan rawat jalan hari ini"
          badgeText="Registrasi Hari Ini"
          badgeColor="bg-sky-50 text-sky-800 border-sky-200 font-bold"
          icon={TrendingUp}
          color="text-sky-600"
          bgColor="bg-sky-50"
          borderColor="border-sky-200"
        />
        <StatCard
          label="Penerimaan Hari Ini"
          value={loading ? "..." : formatRupiah(totalRevenue)}
          sub={
            revenueData?.metrics
              ? `${revenueData.metrics.total_transactions} transaksi lunas terverifikasi`
              : `${paidList.length} transaksi selesai`
          }
          badgeText="Kas Masuk Riil"
          badgeColor="bg-purple-50 text-purple-800 border-purple-200 font-bold"
          icon={Receipt}
          color="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
        />
      </div>

      {/* Rekonsiliasi Kasir & Metode Pembayaran Riil Hari Ini */}
      {revenueData?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Banknote className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Tunai (Laci Kasir)
              </span>
              <p className="text-base font-black text-slate-900">
                {formatRupiah(revenueData.metrics.tunai_amount)}
              </p>
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {revenueData.metrics.tunai_count} transaksi fisik
              </span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold text-[10px] shrink-0">
              Uang Fisik
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <QrCode className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                QRIS / Digital
              </span>
              <p className="text-base font-black text-slate-900">
                {formatRupiah(revenueData.metrics.qris_amount)}
              </p>
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {revenueData.metrics.qris_count} transaksi QRIS
              </span>
            </div>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 font-extrabold text-[10px] shrink-0">
              Non-Tunai
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <CreditCard className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                Debit / EDC
              </span>
              <p className="text-base font-black text-slate-900">
                {formatRupiah(revenueData.metrics.debit_amount)}
              </p>
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {revenueData.metrics.debit_count} gesek kartu
              </span>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[10px] shrink-0">
              EDC Bank
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                Klaim BPJS / JKN
              </span>
              <p className="text-base font-black text-slate-900">
                {formatRupiah(revenueData.metrics.bpjs_amount)}
              </p>
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {revenueData.metrics.bpjs_count} klaim penjamin
              </span>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 font-extrabold text-[10px] shrink-0">
              Piutang
            </div>
          </div>
        </div>
      )}

      {/* Pencarian Invoice & Command Bar Cepat */}
      <Card className="card-premium border-slate-200/90 shadow-2xs">
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                  <Search className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-slate-900">Pencarian Cepat & Pembayaran Instan</span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline-block">
                Tekan <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 border border-slate-200 rounded text-slate-600">Enter</kbd> untuk proses transaksi
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Cari No. Rekam Medis (10-00-00-01), No. Registrasi, atau Nama Pasien..."
                  value={encounterSearch}
                  onChange={(e) => setEncounterSearch(e.target.value)}
                  className="pl-12 h-12 bg-slate-50/50 hover:bg-white focus:bg-white border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 text-sm transition-all"
                />
                {encounterSearch && (
                  <button
                    type="button"
                    onClick={() => setEncounterSearch("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                className="h-12 px-7 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition-all gap-2 shrink-0 cursor-pointer"
              >
                <CreditCard className="h-4 w-4 text-amber-400" />
                <span>Proses Pembayaran</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Equal Height Split Section: Antrean Terkini (8 cols) & Command Navigasi (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Antrean Tagihan Terkini (8 cols) */}
        <div className="xl:col-span-8 flex flex-col">
          <Card className="card-premium overflow-hidden flex flex-col h-full border-slate-200/90 shadow-2xs">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-slate-900">
                      Antrean Menunggu Pembayaran
                    </CardTitle>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Pasien prioritas yang siap dilakukan proses pelunasan biaya layanan
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full shrink-0">
                  {pendingList.length} Menunggu
                </span>
              </div>
            </CardHeader>

            <div className="flex-1 overflow-x-auto custom-scrollbar flex flex-col min-h-[380px]">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                  <span className="text-xs font-medium">Memuat antrean tagihan pasien...</span>
                </div>
              ) : pendingList.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {pendingList.slice(0, 5).map((item, idx) => {
                    const deptName = getDepartmentName(item.department_code);
                    const deptCode = item.department_code || "01";

                    return (
                      <div
                        key={item.encounter_no || idx}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-amber-50/30 transition-colors"
                      >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-extrabold text-sm shrink-0 shadow-2xs">
                            {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm truncate max-w-[200px] sm:max-w-[280px]">
                                {item.patient_name}
                              </span>
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/90 px-2 py-0.5 rounded-md text-[11px] tracking-wider shadow-2xs shrink-0">
                                {item.mrn}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md shrink-0">
                                <span className="font-mono font-bold text-amber-700">[{deptCode}]</span>
                                <span>{deptName}</span>
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2.5 flex-wrap">
                              <span className="font-mono text-slate-400">#{item.encounter_no}</span>
                              <span className="text-slate-300">•</span>
                              <span>
                                Penjamin:{" "}
                                <strong className="text-slate-700 font-semibold">{item.status_pasien || "Umum"}</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md">
                                Tagihan: {formatRupiah(item.unpaid_amount || item.total_amount || 50000)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenInvoiceDetail(item)}
                            className="h-9 px-3 border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer shadow-2xs"
                            title="Lihat Rincian Tagihan"
                          >
                            <Eye className="h-3.5 w-3.5 text-sky-600" />
                            <span className="hidden sm:inline">Rincian</span>
                          </Button>
                          <Button
                            onClick={() => navigate(`/kasir/bayar/${item.encounter_no}`)}
                            size="sm"
                            className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs shadow-amber-600/20 transition-all gap-1.5 cursor-pointer"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Bayar</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 gap-2.5">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/60">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Semua Tagihan Selesai</p>
                  <p className="text-xs text-slate-400">Tidak ada antrean pasien yang menunggu pembayaran saat ini.</p>
                </div>
              )}
            </div>

            <div className="mt-auto p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Menampilkan maksimal 5 antrean tagihan teratas
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/kasir/antrean")}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1 rounded-lg cursor-pointer"
              >
                <span>Buka Semua Antrean ({pendingList.length})</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Shift & Shortcut Navigasi (4 cols) */}
        <div className="xl:col-span-4 flex flex-col space-y-6">
          {/* Card 1: Transaksi Terakhir & Cetak Cepat Kwitansi */}
          <Card className="card-premium overflow-hidden border-slate-200/90 shadow-2xs">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-4 sm:p-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-700 shadow-2xs">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">Transaksi Terakhir</CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    Cetak cepat nota & kwitansi kasir
                  </CardDescription>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {revenueData?.transactions?.length ?? 0} Lunas
              </span>
            </CardHeader>
            <CardContent className="p-0 text-xs">
              {revenueData?.transactions && revenueData.transactions.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {revenueData.transactions.slice(0, 4).map((tx, idx) => (
                    <div
                      key={tx.encounter_no || idx}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-amber-50/20 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[140px] sm:max-w-[170px]">
                            {tx.patient_name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {tx.mrn}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{formatRupiah(tx.total_amount)}</span>
                          <span className="text-slate-300">•</span>
                          {renderPaymentBadge(tx.payment_method)}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenReceiptModal(tx)}
                        className="h-8 px-2.5 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 rounded-lg gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                        title="Cetak Ulang Kwitansi Resmi"
                      >
                        <Printer className="h-3.5 w-3.5 text-amber-600" />
                        <span className="hidden sm:inline">Cetak</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 space-y-1.5">
                  <div className="p-2.5 bg-slate-100 rounded-xl w-fit mx-auto text-slate-400">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Belum Ada Transaksi Lunas</p>
                  <p className="text-[11px] text-slate-400">Transaksi lunas hari ini akan tampil di sini untuk cetak kwitansi.</p>
                </div>
              )}

              <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                <Button
                  onClick={() => navigate("/kasir/riwayat-pembayaran")}
                  variant="ghost"
                  className="w-full h-8 text-xs font-bold text-slate-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg gap-1.5 cursor-pointer justify-center"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  <span>Buka Semua Riwayat Kwitansi ({revenueData?.transactions?.length ?? 0})</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Pintasan Operasional Kasir */}
          <Card className="card-premium overflow-hidden border-slate-200/90 shadow-2xs flex-1 flex flex-col">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-5 shrink-0">
              <CardTitle className="text-sm font-bold text-slate-900">Pintasan Operasional</CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Akses instan modul kasir dan keuangan
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
              <Link
                to="/kasir/antrean"
                className="group p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-amber-400 hover:shadow-xs transition-all flex items-center gap-3 cursor-pointer"
              >
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors border border-amber-200/60 shrink-0">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-xs">Antrean Tagihan Pasien</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">Daftar invoice menunggu bayar</p>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {pendingList.length}
                </span>
              </Link>

              <Link
                to="/kasir/riwayat-pembayaran"
                className="group p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-sky-400 hover:shadow-xs transition-all flex items-center gap-3 cursor-pointer"
              >
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-100 transition-colors border border-sky-200/60 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-xs">Riwayat Kwitansi</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">Arsip kuitansi & cetak nota resmi</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
              </Link>

              <Link
                to="/kasir/laporan"
                className="group p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-400 hover:shadow-xs transition-all flex items-center gap-3 cursor-pointer"
              >
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors border border-emerald-200/60 shrink-0">
                  <BadgeDollarSign className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-xs">Rekap Penerimaan & Closing</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">Laporan harian & cetak Berita Acara A4</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Quick Peek Detail Tagihan */}
      <Dialog open={!!selectedEncounter} onOpenChange={(open) => !open && setSelectedEncounter(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="bg-slate-900 text-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-slate-900">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white">
                    Rincian Tagihan Pasien
                  </DialogTitle>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Reg: #{selectedEncounter?.encounter_no}
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            {/* Demographic Strip */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nama Pasien</span>
                <span className="font-bold text-slate-900 text-sm">{selectedEncounter?.patient_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">No. Rekam Medis (RM)</span>
                <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                  {selectedEncounter?.mrn}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Pelayanan</span>
                <span className="font-semibold text-amber-800">
                  [{selectedEncounter?.department_code || "01"}] {getDepartmentName(selectedEncounter?.department_code)}
                </span>
              </div>
            </div>

            {/* Fee Items */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Komponen Biaya</span>
              {invoiceLoading ? (
                <div className="py-6 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
                  <span>Memuat komponen invoice...</span>
                </div>
              ) : invoiceDetail && invoiceDetail.items.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                  {invoiceDetail.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{it.description}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{it.item_type || "Tindakan"}</p>
                      </div>
                      <span className="font-bold text-slate-900">{formatRupiah(it.amount)}</span>
                    </div>
                  ))}
                  <div className="p-3 bg-amber-50/60 flex justify-between items-center font-bold text-slate-900">
                    <span>Total Tagihan</span>
                    <span className="text-amber-700 text-sm">{formatRupiah(invoiceDetail.total_amount)}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-slate-200/80 rounded-xl bg-slate-50 text-center space-y-1.5">
                  <p className="font-bold text-slate-800 text-xs">Komponen Tagihan Standar</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Rincian komponen tindakan medis dan tarif konsultasi poliklinik dikalkulasi otomatis saat membuka formulir pembayaran.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEncounter(null)}
                className="h-10 px-4 rounded-xl border-slate-200 text-slate-600 font-semibold cursor-pointer"
              >
                Tutup
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const enc = selectedEncounter?.encounter_no;
                  setSelectedEncounter(null);
                  if (enc) navigate(`/kasir/bayar/${enc}`);
                }}
                className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 cursor-pointer shadow-md shadow-amber-600/20"
              >
                <CreditCard className="h-4 w-4" />
                <span>Lanjut ke Pembayaran</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal Cetak Kwitansi Resmi Cepat */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-xl md:max-w-2xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/20 text-white">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">
                  Kwitansi Pembayaran Rawat Jalan
                </DialogTitle>
                <p className="text-xs text-amber-100 mt-0.5 font-mono">
                  No. Kwitansi: #KW-{selectedReceiptTx?.encounter_no}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => window.print()}
                className="bg-white hover:bg-amber-50 text-amber-900 font-bold text-xs h-9 px-4 rounded-xl shadow-sm gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Nota</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsReceiptModalOpen(false)}
                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          {/* Printable Receipt Paper Container */}
          <div ref={receiptPrintRef} className="p-6 sm:p-8 bg-white text-slate-800 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar font-sans">
            {/* Header RS */}
            <div className="text-center pb-4 border-b-2 border-dashed border-slate-300">
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">CODINA SIMRS ONE - RSUD KOTA</h2>
              <p className="text-xs text-slate-500 font-medium">Layanan Rawat Jalan & Kasir Terpadu</p>
              <p className="text-[11px] text-slate-400">Jl. Kesehatan No. 1 • Telp: (021) 555-1234 • Loket Kasir Utama</p>
            </div>

            {/* Kwitansi Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p><span className="text-slate-400">No. Kwitansi:</span> <strong className="font-mono text-slate-900">#KW-{selectedReceiptTx?.encounter_no}</strong></p>
                <p><span className="text-slate-400">No. Rekam Medis:</span> <strong className="font-mono text-slate-900">{selectedReceiptTx?.mrn}</strong></p>
                <p><span className="text-slate-400">Nama Pasien:</span> <strong className="text-slate-900">{selectedReceiptTx?.patient_name}</strong></p>
              </div>
              <div className="space-y-1 text-right sm:text-left">
                <p><span className="text-slate-400">Tanggal Bayar:</span> <strong className="text-slate-900">{selectedReceiptTx?.paid_at ? new Date(selectedReceiptTx.paid_at).toLocaleDateString("id-ID", { dateStyle: "long" }) : todayStr}</strong></p>
                <p><span className="text-slate-400">Poliklinik:</span> <strong className="text-slate-900">{selectedReceiptTx?.department_name || getDepartmentName(selectedReceiptTx?.department_code)}</strong></p>
                <p><span className="text-slate-400">Metode Bayar:</span> <strong className="text-slate-900">{selectedReceiptTx?.payment_method || "CASH"}</strong></p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border-t border-b border-slate-200 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 font-bold border-b border-slate-100">
                    <th className="text-left pb-2">Uraian Pelayanan / Tindakan</th>
                    <th className="text-center pb-2">Qty</th>
                    <th className="text-right pb-2">Tarif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiptLoading ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">Memuat rincian tindakan...</td>
                    </tr>
                  ) : receiptInvoice?.items && receiptInvoice.items.length > 0 ? (
                    receiptInvoice.items.map((it, i) => (
                      <tr key={i}>
                        <td className="py-2.5 font-medium text-slate-800">{it.description}</td>
                        <td className="py-2.5 text-center text-slate-600">{it.quantity || 1}</td>
                        <td className="py-2.5 text-right font-bold text-slate-900">{formatRupiah(it.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2.5 font-medium text-slate-800">Pelayanan & Tindakan Rawat Jalan</td>
                      <td className="py-2.5 text-center text-slate-600">1</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{formatRupiah(selectedReceiptTx?.total_amount || 0)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Block */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-sm font-black border-t-2 border-slate-900 pt-3">
                <span className="uppercase">Total Pelunasan</span>
                <span className="text-amber-700 text-base">{formatRupiah(selectedReceiptTx?.total_amount || 0)}</span>
              </div>
            </div>

            {/* Stempel & Signature Footer */}
            <div className="pt-6 border-t border-dashed border-slate-300 flex justify-between items-end text-[11px]">
              <div className="space-y-1 text-slate-400">
                <p>Kwitansi ini merupakan bukti pembayaran yang sah.</p>
                <p>Dicetak pada: {new Date().toLocaleString("id-ID")}</p>
                <div className="inline-block border-2 border-emerald-600 text-emerald-700 font-extrabold px-3 py-1 rounded text-xs tracking-wider uppercase rotate-[-3deg] mt-1">
                  LUNAS / VERIFIED
                </div>
              </div>
              <div className="text-center space-y-12">
                <p className="text-slate-500 font-medium">Petugas Loket Kasir,</p>
                <p className="font-bold text-slate-900 underline underline-offset-4">
                  {userId ? userId.charAt(0).toUpperCase() + userId.slice(1) : "Kasir Utama"}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
