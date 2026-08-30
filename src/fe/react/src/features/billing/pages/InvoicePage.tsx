import { useState, useEffect, useMemo, useRef } from "react";
import {
  getRevenueReport,
  getBillingQueue,
  getInvoice,
  type Invoice,
  type SettlementTransactionItem,
} from "../api/billingApi";
import {
  Receipt,
  Search,
  Calendar,
  RefreshCw,
  Clock,
  Printer,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Banknote,
  QrCode,
  CreditCard,
  Layers,
  X,
  Stethoscope,
  Activity,
  User,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KasirPageHeader } from "../components/KasirPageHeader";
import { kasirTheme, formatRupiah } from "../theme";
import { cn } from "@/lib/utils";

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDepartmentName(code?: string) {
  if (!code || code === "-") return "Poliklinik";
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

function parseActionItem(desc: string, itemType?: string) {
  let code = "-";
  let title = desc;
  let category = "Tindakan Medis Poli";

  const codeMatch = desc.match(/^\[(.*?)\]\s*(.*)$/);
  if (codeMatch) {
    code = codeMatch[1];
    title = codeMatch[2];
  }

  if (
    itemType === "MEDICINE" ||
    desc.toLowerCase().includes("prescription") ||
    desc.toLowerCase().includes("obat") ||
    desc.toLowerCase().includes("resep")
  ) {
    category = "Farmasi & Resep Obat";
  } else if (
    desc.toLowerCase().includes("registrasi") ||
    desc.toLowerCase().includes("pendaftaran") ||
    desc.toLowerCase().includes("konsultasi") ||
    desc.toLowerCase().includes("pemeriksaan dokter")
  ) {
    category = "Pemeriksaan & Konsultasi";
  } else if (
    desc.toLowerCase().includes("lab") ||
    desc.toLowerCase().includes("darah") ||
    desc.toLowerCase().includes("urin") ||
    desc.toLowerCase().includes("gula") ||
    desc.toLowerCase().includes("rontgen") ||
    desc.toLowerCase().includes("radiologi")
  ) {
    category = "Laboratorium & Penunjang";
  } else if (itemType === "ACTION") {
    category = "Tindakan Medis Poli";
  }

  return { code, title, category };
}

export function InvoicePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [invoices, setInvoices] = useState<SettlementTransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal Detail Kwitansi & Print State
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [activePatient, setActivePatient] = useState<SettlementTransactionItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  // Modal Rincian Tindakan & Tarif State (Query berdasarkan No. Registrasi & No. Kwitansi)
  const [activeActionRecord, setActiveActionRecord] = useState<SettlementTransactionItem | null>(null);
  const [actionInvoice, setActionInvoice] = useState<Invoice | null>(null);
  const [loadingActionDetail, setLoadingActionDetail] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  const fetchInvoiceList = async (date: string) => {
    setLoading(true);
    try {
      // 1. Fetch real settlements/transactions from revenue report
      const report = await getRevenueReport({ date });
      if (report) {
        setInvoices(report.transactions || []);
        return;
      }

      // 2. Fallback to registration queue if no report response
      const queueData = await getBillingQueue(date);
      const paidOnly: SettlementTransactionItem[] = queueData
        .filter(
          (item) => item.status !== "WAITING_FOR_PAYMENT" && item.status !== "REGISTERED" && item.status !== "CANCELLED" && item.status !== "BATAL"
        )
        .map((item) => ({
          encounter_no: item.encounter_no,
          mrn: item.mrn,
          patient_name: item.patient_name,
          department_code: item.department_code,
          department_name: getDepartmentName(item.department_code),
          payment_method: (item.status_pasien?.toLowerCase().includes("bpjs") ? "BPJS" : "CASH") as any,
          total_amount: 50000,
          paid_at: item.registered_time || new Date().toISOString(),
          cashier_name: "Staf Kasir 1",
          status: "PAID",
          items: [
            {
              item_type: "ACTION",
              description: `Pemeriksaan & Konsultasi ${getDepartmentName(item.department_code)}`,
              qty: 1,
              amount: 50000,
            },
          ],
        }));
      setInvoices(paidOnly);
    } catch (err) {
      console.error("Failed to load invoices", err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceList(selectedDate);
  }, [selectedDate]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((item) => {
      const q = searchQuery.toLowerCase();
      const kwitansiNo = (item.receipt_no || (item.invoice_id ? `KW-${item.invoice_id.replace(/^INV-/, "")}` : `KW-${item.encounter_no}`)).toLowerCase();
      const deptName = (item.department_name || getDepartmentName(item.department_code)).toLowerCase();
      return (
        !searchQuery ||
        item.patient_name.toLowerCase().includes(q) ||
        item.mrn.toLowerCase().includes(q) ||
        item.encounter_no.toLowerCase().includes(q) ||
        kwitansiNo.includes(q) ||
        deptName.includes(q)
      );
    });
  }, [invoices, searchQuery]);

  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
  }, [filteredInvoices]);

  // Pagination calculation
  const totalData = filteredInvoices.length;
  const totalPages = Math.ceil(totalData / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // Handler: Buka Modal Rincian Tindakan & Tarif (Query berdasarkan No. Registrasi & Kwitansi)
  const handleOpenActionDetail = async (item: SettlementTransactionItem) => {
    setActiveActionRecord(item);
    setIsActionModalOpen(true);
    setLoadingActionDetail(true);
    try {
      const invId = item.invoice_id || (item.receipt_no ? item.receipt_no.replace(/^KW-/, "INV-") : undefined);
      const inv = await getInvoice(item.encounter_no, invId);
      setActionInvoice(inv);
    } catch (err) {
      console.error("Failed to load action details and tariff", err);
      setActionInvoice(null);
    } finally {
      setLoadingActionDetail(false);
    }
  };

  // Handler: Buka Modal Kwitansi Resmi SIMRS
  const handleOpenReceipt = async (item: SettlementTransactionItem) => {
    setActivePatient(item);
    setIsModalOpen(true);
    setLoadingDetail(true);
    try {
      const invId = item.invoice_id || (item.receipt_no ? item.receipt_no.replace(/^KW-/, "INV-") : undefined);
      const inv = await getInvoice(item.encounter_no, invId);
      setActiveInvoice(inv);
    } catch (err) {
      console.error("Failed to load invoice for receipt", err);
      setActiveInvoice(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const renderPaymentBadge = (method: string) => {
    switch (method) {
      case "QRIS":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            <QrCode className="h-3 w-3 text-amber-600" />
            QRIS / Digital
          </span>
        );
      case "DEBIT":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
            <CreditCard className="h-3 w-3 text-blue-600" />
            Kartu Debit
          </span>
        );
      case "BPJS":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
            <Layers className="h-3 w-3 text-purple-600" />
            BPJS Klaim
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            <Banknote className="h-3 w-3 text-emerald-600" />
            Tunai (Cash)
          </span>
        );
    }
  };

  return (
    <div className={kasirTheme.layout.container}>
      {/* Header */}
      <KasirPageHeader
        title="Riwayat Pembayaran & Kwitansi"
        description="Arsip seluruh transaksi pembayaran rawat jalan yang telah lunas dan pencetakan bukti kuitansi resmi."
        badge="Kwitansi Kasir"
        icon={FileText}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => fetchInvoiceList(selectedDate)}
              disabled={loading}
              variant="outline"
              className="h-10 px-4 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs gap-2"
            >
              <RefreshCw className={cn("h-4 w-4 text-amber-600", loading && "animate-spin")} />
              <span>Muat Ulang</span>
            </Button>
          </div>
        }
        quickStats={[
          { label: "Total Transaksi Lunas", value: `${invoices.length} Transaksi`, icon: CheckCircle2 },
          { label: "Total Pendapatan Terarsip", value: formatRupiah(totalRevenue), icon: Receipt },
          { label: "Tanggal Terpilih", value: selectedDate, icon: Calendar },
          { label: "Hasil Filter", value: `${filteredInvoices.length} Data`, icon: Clock },
        ]}
      />

      {/* Main Table Card */}
      <Card className="card-premium overflow-hidden flex flex-col">
        {/* Filter Controls Bar */}
        <CardHeader className="bg-slate-50/60 border-b border-slate-100/80 p-5 shrink-0">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari No. Kwitansi, Nama Pasien, No. RM, atau Poli..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-11 h-11 bg-white border-slate-200/80 rounded-xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 text-xs shadow-2xs"
              />
            </div>

            {/* Date Picker Filter with Quick Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl p-1 shadow-2xs">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedDate === getTodayString() ? "default" : "ghost"}
                  onClick={() => {
                    setSelectedDate(getTodayString());
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "h-8 px-2.5 text-xs font-semibold rounded-lg",
                    selectedDate === getTodayString()
                      ? "bg-amber-600 text-white hover:bg-amber-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  Hari Ini
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedDate === getYesterdayString() ? "default" : "ghost"}
                  onClick={() => {
                    setSelectedDate(getYesterdayString());
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "h-8 px-2.5 text-xs font-semibold rounded-lg",
                    selectedDate === getYesterdayString()
                      ? "bg-amber-600 text-white hover:bg-amber-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  Kemarin
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3.5 h-11 shadow-2xs">
                <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Table */}
        <div className="p-0 overflow-x-auto custom-scrollbar flex-1 flex flex-col min-h-[420px]">
          <Table className="w-full min-w-[960px]">
            <TableHeader className="bg-slate-50/70 border-b border-slate-100 shrink-0">
              <TableRow>
                <TableHead className="w-[150px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  No. Kwitansi
                </TableHead>
                <TableHead className="w-[130px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  No. RM
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Nama Pasien
                </TableHead>
                <TableHead className="w-[170px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Pelayanan
                </TableHead>
                <TableHead className="w-[140px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Metode Bayar
                </TableHead>
                <TableHead className="w-[140px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Total Bayar
                </TableHead>
                <TableHead className="w-[110px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Status
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 w-[120px]">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                      <span className="text-xs font-semibold text-slate-600">Memuat riwayat pembayaran kasir...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => {
                  const kwitansiNo = item.receipt_no || (item.invoice_id ? `KW-${item.invoice_id.replace(/^INV-/, "")}` : `KW-${item.encounter_no}`);
                  const dept = item.department_name || getDepartmentName(item.department_code);

                  return (
                    <TableRow key={item.invoice_id || `${item.encounter_no}-${idx}`} className="hover:bg-amber-50/30 transition-colors border-b border-slate-100/80">
                      {/* No. Kwitansi */}
                      <TableCell className="py-3 px-4 font-mono font-bold text-xs text-amber-700">
                        <div className="flex items-center gap-1.5">
                          <Receipt className="h-3.5 w-3.5 text-amber-600" />
                          <span>{kwitansiNo}</span>
                        </div>
                      </TableCell>

                      {/* No. RM */}
                      <TableCell className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-md text-xs tracking-wider inline-block shadow-2xs">
                          {item.mrn}
                        </span>
                      </TableCell>

                      {/* Nama Pasien */}
                      <TableCell className="py-3 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs">{item.patient_name}</p>
                          <p className="text-[11px] text-slate-500">
                            Encounter: #{item.encounter_no}
                          </p>
                        </div>
                      </TableCell>

                      {/* Pelayanan (Poli Code + Nama Poliklinik) */}
                      <TableCell className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-sky-100/90 text-sky-800 border border-sky-200 shadow-2xs">
                            {item.department_code || "01"}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {dept}
                          </span>
                        </div>
                      </TableCell>

                      {/* Metode Bayar */}
                      <TableCell className="py-3 px-4">
                        {renderPaymentBadge(item.payment_method)}
                      </TableCell>

                      {/* Total Bayar */}
                      <TableCell className="py-3 px-4 font-bold text-xs text-slate-900">
                        {formatRupiah(item.total_amount)}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Lunas
                        </span>
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => handleOpenActionDetail(item)}
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs font-bold text-sky-700 border-sky-200 bg-sky-50/80 hover:bg-sky-100 rounded-lg gap-1.5 shadow-2xs transition-all cursor-pointer"
                            title="Lihat Rincian Tindakan & Tarif Pasien"
                          >
                            <FileText className="h-3.5 w-3.5 text-sky-600" />
                            <span>Tindakan & Tarif</span>
                          </Button>
                          <Button
                            onClick={() => handleOpenReceipt(item)}
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs font-semibold text-amber-700 border-amber-200 bg-amber-50/50 hover:bg-amber-100 rounded-lg gap-1.5 shadow-2xs transition-all cursor-pointer"
                            title="Cetak Kwitansi & Struk"
                          >
                            <Printer className="h-3.5 w-3.5 text-amber-600" />
                            <span>Kwitansi</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-20 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">Tidak ada riwayat pembayaran</p>
                      <p className="text-slate-400 text-[11px]">
                        Belum ada transaksi pembayaran lunas yang tercatat pada tanggal {selectedDate}.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer with Pagination */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {totalData > 0 ? (
              <>
                Menampilkan <span className="font-semibold text-slate-700">{((currentPage - 1) * pageSize) + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(currentPage * pageSize, totalData)}</span> dari <span className="font-semibold text-slate-700">{totalData}</span> data
                {totalPages > 1 && <span className="text-slate-400 ml-1.5">(Halaman {currentPage} dari {totalPages})</span>}
              </>
            ) : (
              <span>Total: 0 data</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-xs text-slate-500">Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 text-xs bg-white border border-slate-200 rounded-lg px-2 text-slate-700 font-medium outline-none focus:ring-1 focus:ring-amber-500"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>{size} / hal</option>
                ))}
              </select>
            </div>

            {/* Prev Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1 text-slate-600 rounded-lg border-slate-200 hover:bg-white hover:border-slate-300 transition-all"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Sebelumnya
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                })
                .map((page, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && page - prev > 1;
                  return (
                    <div key={page} className="flex items-center">
                      {showEllipsis && <span className="px-1 text-slate-400 text-xs">...</span>}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0 text-xs rounded-lg font-semibold",
                          currentPage === page
                            ? "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                            : "text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    </div>
                  );
                })}
            </div>

            {/* Next Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1 text-slate-600 rounded-lg border-slate-200 hover:bg-white hover:border-slate-300 transition-all"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              Selanjutnya
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal Detail Rincian Tindakan & Tarif (Query Berdasarkan No. Registrasi & Kwitansi) */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl md:max-w-3xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-800 text-white flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/15 text-white backdrop-blur-xs border border-white/20">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <span>Rincian Tindakan & Tarif Pelayanan</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    LUNAS
                  </span>
                </DialogTitle>
                <p className="text-xs text-sky-100 mt-0.5 font-mono">
                  Encounter #{activeActionRecord?.encounter_no} • Kwitansi #{activeActionRecord?.receipt_no || (activeActionRecord?.invoice_id ? `KW-${activeActionRecord.invoice_id.replace(/^INV-/, "")}` : `KW-${activeActionRecord?.encounter_no}`)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsActionModalOpen(false)}
                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="p-5 sm:p-6 bg-slate-50/50 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Meta Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Card Identitas Pasien & Registrasi */}
              <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Data Pasien & Registrasi</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nama Pasien</span>
                    <span className="font-bold text-slate-900">{activeActionRecord?.patient_name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">No. Rekam Medis (MRN)</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200 inline-block">
                      {activeActionRecord?.mrn || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">No. Registrasi (Encounter)</span>
                    <span className="font-mono font-bold text-sky-700">
                      #{activeActionRecord?.encounter_no || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Unit Pelayanan / Poli</span>
                    <span className="font-semibold text-slate-800">
                      {activeActionRecord?.department_name || getDepartmentName(activeActionRecord?.department_code)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Data Kwitansi & Kasir */}
              <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Receipt className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Data Kwitansi & Transaksi</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">No. Kwitansi</span>
                    <span className="font-mono font-bold text-amber-700">
                      #{activeActionRecord?.receipt_no || (activeActionRecord?.invoice_id ? `KW-${activeActionRecord.invoice_id.replace(/^INV-/, "")}` : `KW-${activeActionRecord?.encounter_no}`)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Waktu Pembayaran</span>
                    <span className="font-medium text-slate-800">
                      {activeActionRecord?.paid_at ? new Date(activeActionRecord.paid_at).toLocaleString("id-ID") : selectedDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Metode Pembayaran</span>
                    <div className="mt-0.5">
                      {activeActionRecord?.payment_method ? renderPaymentBadge(activeActionRecord.payment_method) : (
                        <span className="text-xs font-semibold text-slate-700">CASH (Tunai)</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Petugas Kasir</span>
                    <span className="font-semibold text-slate-800">
                      {activeActionRecord?.cashier_name || "Staf Kasir SIMRS"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Detail Tindakan & Tarif */}
            <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-800">Daftar Tindakan, Layanan & Tarif Medis</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                  Query: No. Registrasi & Kwitansi
                </span>
              </div>

              <div className="overflow-x-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-b border-slate-100">
                      <TableHead className="w-10 text-center font-bold text-slate-500 py-3">#</TableHead>
                      <TableHead className="font-bold text-slate-500 py-3">Uraian Tindakan / Layanan</TableHead>
                      <TableHead className="w-[170px] font-bold text-slate-500 py-3">Kategori</TableHead>
                      <TableHead className="w-[60px] text-center font-bold text-slate-500 py-3">Qty</TableHead>
                      <TableHead className="w-[120px] text-right font-bold text-slate-500 py-3">Tarif Satuan</TableHead>
                      <TableHead className="w-[130px] text-right font-bold text-slate-500 py-3">Subtotal</TableHead>
                      <TableHead className="w-[90px] text-center font-bold text-slate-500 py-3">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingActionDetail ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="h-5 w-5 animate-spin text-sky-600" />
                            <span className="text-xs font-semibold text-slate-600">
                              Mengambil rincian tindakan dan tarif dari modul billing...
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : actionInvoice?.items && actionInvoice.items.length > 0 ? (
                      actionInvoice.items.map((it, idx) => {
                        const parsed = parseActionItem(it.description, it.item_type);
                        const qty = it.quantity || 1;
                        const subtotal = it.amount * qty;

                        return (
                          <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100/70">
                            <TableCell className="text-center font-bold text-slate-400 py-3">{idx + 1}</TableCell>
                            <TableCell className="py-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {parsed.code !== "-" && (
                                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                      {parsed.code}
                                    </span>
                                  )}
                                  <span className="font-bold text-slate-900 text-xs">{parsed.title}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <Tag className="h-3 w-3 text-slate-500" />
                                {parsed.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-bold text-slate-700 py-3">{qty}x</TableCell>
                            <TableCell className="text-right font-medium text-slate-700 py-3">{formatRupiah(it.amount)}</TableCell>
                            <TableCell className="text-right font-bold text-slate-900 py-3">{formatRupiah(subtotal)}</TableCell>
                            <TableCell className="text-center py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Lunas
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : activeActionRecord?.items && activeActionRecord.items.length > 0 ? (
                      activeActionRecord.items.map((it, idx) => {
                        const parsed = parseActionItem(it.description, it.item_type);
                        const qty = it.qty || 1;
                        const subtotal = it.amount * qty;

                        return (
                          <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100/70">
                            <TableCell className="text-center font-bold text-slate-400 py-3">{idx + 1}</TableCell>
                            <TableCell className="py-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {parsed.code !== "-" && (
                                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                      {parsed.code}
                                    </span>
                                  )}
                                  <span className="font-bold text-slate-900 text-xs">{parsed.title}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <Tag className="h-3 w-3 text-slate-500" />
                                {parsed.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-bold text-slate-700 py-3">{qty}x</TableCell>
                            <TableCell className="text-right font-medium text-slate-700 py-3">{formatRupiah(it.amount)}</TableCell>
                            <TableCell className="text-right font-bold text-slate-900 py-3">{formatRupiah(subtotal)}</TableCell>
                            <TableCell className="text-center py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Lunas
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell className="text-center font-bold text-slate-400 py-3">1</TableCell>
                        <TableCell className="py-3">
                          <span className="font-bold text-slate-900 text-xs">
                            Biaya Pemeriksaan & Pelayanan {activeActionRecord?.department_name || getDepartmentName(activeActionRecord?.department_code)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <Tag className="h-3 w-3 text-slate-500" />
                            Pemeriksaan & Konsultasi
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-700 py-3">1x</TableCell>
                        <TableCell className="text-right font-medium text-slate-700 py-3">
                          {formatRupiah(activeActionRecord?.total_amount || 50000)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900 py-3">
                          {formatRupiah(activeActionRecord?.total_amount || 50000)}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Lunas
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Total Summary Footer */}
              <div className="bg-slate-50 border-t border-slate-200/90 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-600">
                    Status Tagihan: <strong className="text-emerald-700">Lunas & Terverifikasi Kasir</strong>
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 font-medium">Total Tarif Layanan:</span>
                  <span className="text-base font-black text-slate-900">
                    {formatRupiah(activeActionRecord?.total_amount || actionInvoice?.total_amount || 50000)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsActionModalOpen(false)}
              className="text-xs font-semibold text-slate-600"
            >
              Tutup
            </Button>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (activeActionRecord) {
                    setIsActionModalOpen(false);
                    handleOpenReceipt(activeActionRecord);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs gap-2"
              >
                <Printer className="h-4 w-4" />
                <span>Lihat / Cetak Kwitansi</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kwitansi Resmi SIMRS Print Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                  No. Kwitansi: #{activePatient?.receipt_no || (activePatient?.invoice_id ? `KW-${activePatient.invoice_id.replace(/^INV-/, "")}` : `KW-${activePatient?.encounter_no}`)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrint}
                className="bg-white hover:bg-amber-50 text-amber-900 font-bold text-xs h-9 px-4 rounded-xl shadow-sm gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Nota</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors"
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
                <p><span className="text-slate-400">No. Kwitansi:</span> <strong className="font-mono text-slate-900">#{activePatient?.receipt_no || (activePatient?.invoice_id ? `KW-${activePatient.invoice_id.replace(/^INV-/, "")}` : `KW-${activePatient?.encounter_no}`)}</strong></p>
                <p><span className="text-slate-400">No. Rekam Medis:</span> <strong className="font-mono text-slate-900">{activePatient?.mrn}</strong></p>
                <p><span className="text-slate-400">Nama Pasien:</span> <strong className="text-slate-900">{activePatient?.patient_name}</strong></p>
              </div>
              <div className="space-y-1 text-right sm:text-left">
                <p><span className="text-slate-400">Tanggal:</span> <strong className="text-slate-900">{selectedDate}</strong></p>
                <p><span className="text-slate-400">Poliklinik:</span> <strong className="text-slate-900">{activePatient?.department_name || getDepartmentName(activePatient?.department_code)}</strong></p>
                <p><span className="text-slate-400">Metode Bayar:</span> <strong className="text-slate-900">{activePatient?.payment_method || "CASH"}</strong></p>
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
                  {loadingDetail ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">Memuat rincian tindakan...</td>
                    </tr>
                  ) : activePatient?.items && activePatient.items.length > 0 ? (
                    activePatient.items.map((it, i) => (
                      <tr key={i}>
                        <td className="py-2.5 font-medium text-slate-800">{it.description}</td>
                        <td className="py-2.5 text-center text-slate-600">{it.qty || 1}</td>
                        <td className="py-2.5 text-right font-bold text-slate-900">{formatRupiah(it.amount)}</td>
                      </tr>
                    ))
                  ) : activeInvoice?.items && activeInvoice.items.length > 0 ? (
                    activeInvoice.items.map((it, i) => (
                      <tr key={i}>
                        <td className="py-2.5 font-medium text-slate-800">{it.description}</td>
                        <td className="py-2.5 text-center text-slate-600">1</td>
                        <td className="py-2.5 text-right font-bold text-slate-900">{formatRupiah(it.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2.5 font-medium text-slate-800">Biaya Pemeriksaan Dokter & Pelayanan Poli</td>
                      <td className="py-2.5 text-center text-slate-600">1</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{formatRupiah(activePatient?.total_amount || 50000)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Section */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between font-bold text-base text-slate-900 pt-1">
                <span>TOTAL PEMBAYARAN:</span>
                <span className="text-amber-700">{formatRupiah(activePatient?.total_amount || activeInvoice?.total_amount || 50000)}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Metode Pembayaran:</span>
                <span className="font-semibold text-slate-800">{activePatient?.payment_method || "CASH"}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Status Transaksi:</span>
                <span className="font-bold text-emerald-600">LUNAS (PAID)</span>
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="pt-6 border-t-2 border-dashed border-slate-300 grid grid-cols-2 gap-6 text-center text-xs">
              <div>
                <p className="text-slate-400 text-[11px]">Pasien / Penanggung Jawab,</p>
                <div className="h-14" />
                <p className="font-bold text-slate-800 underline">{activePatient?.patient_name || "(.........................)"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Petugas Kasir,</p>
                <div className="h-14" />
                <p className="font-bold text-slate-800 underline">{activePatient?.cashier_name || "Staf Kasir SIMRS"}</p>
              </div>
            </div>

            <div className="text-center pt-2 text-[10px] text-slate-400">
              <p>Simpan bukti pembayaran ini sebagai tanda bukti pembayaran yang sah.</p>
              <p>Terima kasih atas kepercayaan Anda kepada CODINA SIMRS ONE.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)} className="text-xs font-semibold text-slate-600">
              Tutup
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs gap-2"
            >
              <Printer className="h-4 w-4" />
              Cetak Nota Sekarang
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
