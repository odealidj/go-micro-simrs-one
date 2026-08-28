import { useState, useEffect, useMemo, useRef } from "react";
import { getRevenueReport, getInvoice, type Invoice } from "../api/billingApi";
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Banknote,
  QrCode,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Wallet,
  Receipt,
  X,
  CreditCard,
  Layers,
  TrendingUp,
  PieChart,
  BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
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
import { toast } from "sonner";
import type { SettlementItem } from "../api/billingApi";

export interface SettlementRecord {
  encounter_no: string;
  mrn: string;
  patient_name: string;
  department_code: string;
  payment_method: "CASH" | "QRIS" | "DEBIT" | "BPJS";
  total_amount: number;
  paid_at: string;
  cashier_name: string;
  status?: string;
  items?: SettlementItem[];
}

export interface FlattenedActionItem {
  encounter_no: string;
  mrn: string;
  patient_name: string;
  department_code: string;
  department_name: string;
  action_name: string;
  qty: number;
  payment_method: "CASH" | "QRIS" | "DEBIT" | "BPJS";
  amount: number;
  status: string;
  cashier_name: string;
  paid_at: string;
  original_record: SettlementRecord;
}

const DEFAULT_SETTLEMENTS: SettlementRecord[] = [
  {
    encounter_no: "202608010010",
    mrn: "10-00-00-01",
    patient_name: "Ny. Siti Rahma",
    department_code: "01",
    payment_method: "CASH",
    total_amount: 50000,
    paid_at: "08:15",
    cashier_name: "Staf Kasir 1",
    status: "PAID",
    items: [
      { item_type: "ACTION", description: "Pemeriksaan & Konsultasi Dokter Umum", qty: 1, amount: 50000 },
    ],
  },
  {
    encounter_no: "202608010011",
    mrn: "10-00-00-02",
    patient_name: "Tn. Budi Santoso",
    department_code: "02",
    payment_method: "QRIS",
    total_amount: 75000,
    paid_at: "08:30",
    cashier_name: "Staf Kasir 1",
    status: "PAID",
    items: [
      { item_type: "ACTION", description: "Pemeriksaan & Konsultasi Gigi", qty: 1, amount: 50000 },
      { item_type: "ACTION", description: "Pembersihan Karang Gigi (Scaling)", qty: 1, amount: 25000 },
    ],
  },
  {
    encounter_no: "202608010012",
    mrn: "10-00-00-03",
    patient_name: "An. Rizky Pratama",
    department_code: "03",
    payment_method: "CASH",
    total_amount: 60000,
    paid_at: "08:45",
    cashier_name: "Staf Kasir 1",
    status: "PAID",
    items: [
      { item_type: "ACTION", description: "Pemeriksaan Spesialis Anak", qty: 1, amount: 60000 },
    ],
  },
  {
    encounter_no: "202608010013",
    mrn: "10-00-00-04",
    patient_name: "Ny. Dewi Sartika",
    department_code: "04",
    payment_method: "BPJS",
    total_amount: 120000,
    paid_at: "09:10",
    cashier_name: "Staf Kasir 1",
    status: "PAID",
    items: [
      { item_type: "ACTION", description: "Konsultasi Spesialis Penyakit Dalam", qty: 1, amount: 80000 },
      { item_type: "ACTION", description: "Pemeriksaan EKG Rekam Jantung", qty: 1, amount: 40000 },
    ],
  },
  {
    encounter_no: "202608010014",
    mrn: "10-00-00-05",
    patient_name: "Tn. Hendra Gunawan",
    department_code: "05",
    payment_method: "DEBIT",
    total_amount: 150000,
    paid_at: "09:25",
    cashier_name: "Staf Kasir 1",
    status: "PAID",
    items: [
      { item_type: "ACTION", description: "Konsultasi Spesialis Bedah", qty: 1, amount: 100000 },
      { item_type: "ACTION", description: "Tindakan Perawatan & Rawat Luka (Wound Care)", qty: 1, amount: 50000 },
    ],
  },
  {
    encounter_no: "202608010015",
    mrn: "10-00-00-06",
    patient_name: "Ny. Ratna Sari",
    department_code: "08",
    payment_method: "QRIS",
    total_amount: 95000,
    paid_at: "09:40",
    cashier_name: "Staf Kasir 1",
    status: "PAID",
    items: [
      { item_type: "ACTION", description: "Konsultasi Spesialis Kandungan", qty: 1, amount: 75000 },
      { item_type: "ACTION", description: "Pemeriksaan USG Kandungan Dasar", qty: 1, amount: 20000 },
    ],
  },
  {
    encounter_no: "202608010016",
    mrn: "10-00-00-07",
    patient_name: "Tn. Ahmad Fauzi",
    department_code: "01",
    payment_method: "CASH",
    total_amount: 50000,
    paid_at: "10:05",
    cashier_name: "Staf Kasir 1",
    status: "PAID",
    items: [
      { item_type: "ACTION", description: "Pemeriksaan & Konsultasi Dokter Umum", qty: 1, amount: 50000 },
    ],
  },
];

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

export function RevenueReportPage() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("TODAY");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [activeReportTab, setActiveReportTab] = useState<"rekap" | "rincian">("rekap");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Receipt & Action modal states
  const [selectedReceiptRecord, setSelectedReceiptRecord] = useState<SettlementRecord | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  // Settlement raw records
  const [settlements, setSettlements] = useState<SettlementRecord[]>(DEFAULT_SETTLEMENTS);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const printableRef = useRef<HTMLDivElement>(null);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await getRevenueReport({
        date: dateFilter,
        department_code: serviceFilter,
        payment_method: methodFilter,
      });

      if (res && res.transactions && res.transactions.length > 0) {
        setSettlements(
          res.transactions.map((tx) => ({
            encounter_no: tx.encounter_no,
            mrn: tx.mrn,
            patient_name: tx.patient_name,
            department_code: tx.department_code,
            payment_method: tx.payment_method,
            total_amount: tx.total_amount,
            paid_at: tx.paid_at,
            cashier_name: tx.cashier_name,
            status: tx.status || "PAID",
            items:
              tx.items && tx.items.length > 0
                ? tx.items
                : [
                    {
                      item_type: "ACTION",
                      description: `Pemeriksaan & Konsultasi ${getDepartmentName(tx.department_code)}`,
                      qty: 1,
                      amount: tx.total_amount,
                    },
                  ],
          }))
        );
      } else {
        // Fallback demo default settlements when no backend transactions on filtered date
        setSettlements(DEFAULT_SETTLEMENTS);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data rekap penerimaan kasir.");
      setSettlements(DEFAULT_SETTLEMENTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [dateFilter, serviceFilter, methodFilter]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return settlements.filter((item) => {
      const deptName = getDepartmentName(item.department_code);
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        !searchQuery ||
        item.encounter_no.toLowerCase().includes(q) ||
        item.mrn.toLowerCase().includes(q) ||
        item.patient_name.toLowerCase().includes(q) ||
        deptName.toLowerCase().includes(q) ||
        item.payment_method.toLowerCase().includes(q) ||
        item.cashier_name.toLowerCase().includes(q);

      const matchesService =
        serviceFilter === "ALL" ||
        item.department_code === serviceFilter ||
        deptName.toLowerCase().includes(serviceFilter.toLowerCase());

      const matchesMethod =
        methodFilter === "ALL" || item.payment_method === methodFilter;

      return matchesSearch && matchesService && matchesMethod;
    });
  }, [settlements, searchQuery, serviceFilter, methodFilter]);

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    const totalTransactions = filteredData.length;
    let totalRevenue = 0;
    let tunaiCount = 0;
    let tunaiAmount = 0;
    let qrisCount = 0;
    let qrisAmount = 0;
    let debitCount = 0;
    let debitAmount = 0;
    let bpjsCount = 0;
    let bpjsAmount = 0;

    filteredData.forEach((item) => {
      totalRevenue += item.total_amount;
      if (item.payment_method === "CASH") {
        tunaiCount++;
        tunaiAmount += item.total_amount;
      } else if (item.payment_method === "QRIS") {
        qrisCount++;
        qrisAmount += item.total_amount;
      } else if (item.payment_method === "DEBIT") {
        debitCount++;
        debitAmount += item.total_amount;
      } else if (item.payment_method === "BPJS") {
        bpjsCount++;
        bpjsAmount += item.total_amount;
      }
    });

    const nonTunaiAmount = qrisAmount + debitAmount + bpjsAmount;
    const nonTunaiCount = qrisCount + debitCount + bpjsCount;

    return {
      totalTransactions,
      totalRevenue,
      tunaiCount,
      tunaiAmount,
      qrisCount,
      qrisAmount,
      debitCount,
      debitAmount,
      bpjsCount,
      bpjsAmount,
      nonTunaiAmount,
      nonTunaiCount,
    };
  }, [filteredData]);

  // Service breakdown
  const serviceBreakdown = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number; total: number }>();

    filteredData.forEach((item) => {
      const code = item.department_code;
      const name = getDepartmentName(code);
      const prev = map.get(code) || { code, name, count: 0, total: 0 };
      prev.count += 1;
      prev.total += item.total_amount;
      map.set(code, prev);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredData]);

  // Flattened Action Items for Rincian Tab
  const flattenedActionItems = useMemo<FlattenedActionItem[]>(() => {
    const list: FlattenedActionItem[] = [];
    filteredData.forEach((tx) => {
      const deptName = getDepartmentName(tx.department_code);
      if (tx.items && tx.items.length > 0) {
        tx.items.forEach((itm) => {
          list.push({
            encounter_no: tx.encounter_no,
            mrn: tx.mrn,
            patient_name: tx.patient_name,
            department_code: tx.department_code,
            department_name: deptName,
            action_name: itm.description,
            qty: itm.qty || 1,
            payment_method: tx.payment_method,
            amount: itm.amount,
            status: tx.status || "PAID",
            cashier_name: tx.cashier_name,
            paid_at: tx.paid_at,
            original_record: tx,
          });
        });
      } else {
        list.push({
          encounter_no: tx.encounter_no,
          mrn: tx.mrn,
          patient_name: tx.patient_name,
          department_code: tx.department_code,
          department_name: deptName,
          action_name: `Pemeriksaan & Konsultasi ${deptName}`,
          qty: 1,
          payment_method: tx.payment_method,
          amount: tx.total_amount,
          status: tx.status || "PAID",
          cashier_name: tx.cashier_name,
          paid_at: tx.paid_at,
          original_record: tx,
        });
      }
    });
    return list;
  }, [filteredData]);

  // Filtered action items for rincian mode (supports action_name search query)
  const filteredActionItems = useMemo(() => {
    if (!searchQuery) return flattenedActionItems;
    const q = searchQuery.toLowerCase();
    return flattenedActionItems.filter(
      (item) =>
        item.encounter_no.toLowerCase().includes(q) ||
        item.mrn.toLowerCase().includes(q) ||
        item.patient_name.toLowerCase().includes(q) ||
        item.department_name.toLowerCase().includes(q) ||
        item.action_name.toLowerCase().includes(q) ||
        item.payment_method.toLowerCase().includes(q)
    );
  }, [flattenedActionItems, searchQuery]);

  // Pagination calculation
  const totalItemsCount = activeReportTab === "rekap" ? filteredData.length : filteredActionItems.length;
  const totalPages = Math.ceil(totalItemsCount / pageSize) || 1;

  const paginatedRekapData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const paginatedActionData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActionItems.slice(start, start + pageSize);
  }, [filteredActionItems, currentPage, pageSize]);

  // Open Receipt Modal Handler
  const handleOpenReceipt = async (record: SettlementRecord) => {
    setSelectedReceiptRecord(record);
    setIsReceiptModalOpen(true);
    setLoadingReceipt(true);
    try {
      const inv = await getInvoice(record.encounter_no);
      setReceiptInvoice(inv);
    } catch (err) {
      console.error("Failed to load invoice details for receipt", err);
      setReceiptInvoice(null);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (activeReportTab === "rekap") {
      if (filteredData.length === 0) {
        toast.info("Tidak ada data rekap untuk diekspor.");
        return;
      }

      // Format Laporan Rekap: noregistrasi, norm, nama pasien, poli/pelayanan, metode bayar, total bayar, status
      const headers = ["No. Registrasi", "No. RM", "Nama Pasien", "Poli / Pelayanan", "Metode Bayar", "Total Bayar", "Status"];
      const rows = filteredData.map((item) => [
        `"${item.encounter_no}"`,
        item.mrn,
        `"${item.patient_name}"`,
        `"${item.department_code} - ${getDepartmentName(item.department_code)}"`,
        item.payment_method,
        item.total_amount.toString(),
        item.status || "PAID",
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Laporan_Rekap_Penerimaan_Kasir_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("File CSV Rekap Berhasil Diunduh", {
        description: `Rekap ${filteredData.length} transaksi penerimaan kasir telah diekspor.`,
      });
    } else {
      if (filteredActionItems.length === 0) {
        toast.info("Tidak ada data rincian untuk diekspor.");
        return;
      }

      // Format Laporan Rincian: noregistrasi, norm, nama pasien, poli/pelayanan, tindakan, qty, metode bayar, total bayar, status
      const headers = ["No. Registrasi", "No. RM", "Nama Pasien", "Poli / Pelayanan", "Tindakan / Pelayanan", "Qty", "Metode Bayar", "Total Bayar", "Status"];
      const rows = filteredActionItems.map((item) => [
        `"${item.encounter_no}"`,
        item.mrn,
        `"${item.patient_name}"`,
        `"${item.department_code} - ${item.department_name}"`,
        `"${item.action_name}"`,
        item.qty.toString(),
        item.payment_method,
        item.amount.toString(),
        item.status,
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Laporan_Rincian_Tindakan_Kasir_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("File CSV Rincian Berhasil Diunduh", {
        description: `Rincian ${filteredActionItems.length} item tindakan/layanan kasir telah diekspor.`,
      });
    }
  };

  function formatReportDate(dateVal: string) {
    if (!dateVal || dateVal === "TODAY") {
      return new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    const parts = dateVal.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    }
    return dateVal;
  }

  const handlePrintDocument = (_actionType?: "print" | "pdf") => {
    const content = printableRef.current;
    if (!content) return;

    const dateLabel =
      dateFilter === "TODAY" ? new Date().toISOString().split("T")[0] : dateFilter;
    const docTitle =
      activeReportTab === "rekap"
        ? `Laporan_Rekap_Penerimaan_Kasir_${dateLabel}`
        : `Laporan_Rincian_Tindakan_Kasir_${dateLabel}`;

    const printWindow = window.open("", "_blank", "width=1050,height=850");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>${docTitle}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 15mm 15mm;
            }
            * {
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
            }
            body {
              margin: 0;
              padding: 16px;
              font-size: 11px;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              margin-bottom: 8px;
            }
            th, td {
              border: 1px solid #94a3b8;
              padding: 5px 7px;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 700;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #334155;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .gap-3 { gap: 0.75rem; }
            .gap-8 { gap: 2rem; }
            .p-4 { padding: 0.85rem; }
            .bg-slate-50 { background-color: #f8fafc !important; }
            .bg-slate-100 { background-color: #f1f5f9 !important; }
            .border { border: 1px solid #cbd5e1; }
            .border-slate-200 { border-color: #e2e8f0; }
            .border-slate-300 { border-color: #cbd5e1; }
            .border-slate-800 { border-color: #1e293b; }
            .border-b { border-bottom-width: 1px; }
            .border-b-2 { border-bottom-width: 2px; }
            .rounded-xl { border-radius: 0.75rem; }
            .pb-4 { padding-bottom: 1rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-6 { padding-top: 1.5rem; }
            .mt-0\\.5 { margin-top: 0.125rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }
            .space-y-4 > * + * { margin-top: 1rem; }
            .space-y-6 > * + * { margin-top: 1.5rem; }
            .space-y-14 > * + * { margin-top: 3.5rem; }
            .text-\\[10px\\] { font-size: 10px; }
            .text-\\[11px\\] { font-size: 11px; }
            .text-xs { font-size: 12px; }
            .text-sm { font-size: 14px; }
            .text-lg { font-size: 18px; }
            .uppercase { text-transform: uppercase; }
            .underline { text-decoration: underline; }
            .tracking-wide { letter-spacing: 0.025em; }
            .tracking-wider { letter-spacing: 0.05em; }
            .text-slate-400 { color: #94a3b8; }
            .text-slate-500 { color: #64748b; }
            .text-slate-600 { color: #475569; }
            .text-slate-700 { color: #334155; }
            .text-slate-800 { color: #1e293b; }
            .text-slate-900 { color: #0f172a; }
            .text-emerald-700 { color: #047857; }
            .text-amber-700 { color: #b45309; }
            .text-amber-800 { color: #92400e; }
            .text-purple-700 { color: #7e22ce; }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  };

  return (
    <div className={kasirTheme.layout.container}>
      {/* Header */}
      <KasirPageHeader
        title="Rekap Penerimaan & Pendapatan Kasir"
        description="Laporan rekapitulasi transaksi kasir, rekonsiliasi setoran harian, dan pertanggungjawaban penerimaan rumah sakit."
        badge="Laporan Keuangan"
        icon={FileText}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-10 px-3.5 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs gap-2 cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <span>Ekspor CSV</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsPrintModalOpen(true)}
              className="h-10 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 gap-2 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Rekap Resmi</span>
            </Button>
          </div>
        }
      />

      {/* 4 Executive KPI Cards */}
      <div className={kasirTheme.layout.gridStats}>
        {/* KPI 1: Total Penerimaan Bersih */}
        <Card className="card-premium overflow-hidden relative group">
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className={kasirTheme.typography.statLabel}>Total Penerimaan Bersih</p>
              <p className="text-2xl font-black text-amber-700 tracking-tight mt-1">
                {formatRupiah(metrics.totalRevenue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span className="text-emerald-600 font-bold">100%</span> dari total transaksi lunas
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0 group-hover:scale-105 transition-transform">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500 w-full" />
        </Card>

        {/* KPI 2: Total Transaksi Lunas */}
        <Card className="card-premium overflow-hidden relative group">
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className={kasirTheme.typography.statLabel}>Total Transaksi Selesai</p>
              <p className={kasirTheme.typography.statNumber}>
                {metrics.totalTransactions} <span className="text-sm font-semibold text-slate-500">Pasien</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" />
                <span>Terverifikasi loket kasir</span>
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-sky-500 w-full" />
        </Card>

        {/* KPI 3: Penerimaan Kas Tunai */}
        <Card className="card-premium overflow-hidden relative group">
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className={kasirTheme.typography.statLabel}>Penerimaan Tunai (Kas)</p>
              <p className="text-2xl font-black text-emerald-700 tracking-tight mt-1">
                {formatRupiah(metrics.tunaiAmount)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Uang fisik kasir ({metrics.tunaiCount} Transaksi)
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Banknote className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-emerald-500 w-full" />
        </Card>

        {/* KPI 4: Non-Tunai & BPJS */}
        <Card className="card-premium overflow-hidden relative group">
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className={kasirTheme.typography.statLabel}>Non-Tunai & Penjamin</p>
              <p className="text-2xl font-black text-purple-700 tracking-tight mt-1">
                {formatRupiah(metrics.nonTunaiAmount)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                QRIS, EDC & BPJS ({metrics.nonTunaiCount} Transaksi)
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <QrCode className="h-6 w-6" />
            </div>
          </div>
          <div className="h-1 bg-purple-500 w-full" />
        </Card>
      </div>

      {/* 2 Visual Breakdown Cards (Payment Composition & Service Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card Left: Komposisi Metode Pembayaran (6 cols) */}
        <Card className="card-premium lg:col-span-6 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Komposisi Metode Pembayaran
                </CardTitle>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                Total: {metrics.totalTransactions} Transaksi
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Multi-segment Progress Bar */}
            <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${metrics.totalRevenue > 0 ? (metrics.tunaiAmount / metrics.totalRevenue) * 100 : 0}%` }}
                className="bg-emerald-500 h-full transition-all"
                title="Tunai"
              />
              <div
                style={{ width: `${metrics.totalRevenue > 0 ? (metrics.qrisAmount / metrics.totalRevenue) * 100 : 0}%` }}
                className="bg-amber-500 h-full transition-all"
                title="QRIS"
              />
              <div
                style={{ width: `${metrics.totalRevenue > 0 ? (metrics.debitAmount / metrics.totalRevenue) * 100 : 0}%` }}
                className="bg-blue-500 h-full transition-all"
                title="Debit EDC"
              />
              <div
                style={{ width: `${metrics.totalRevenue > 0 ? (metrics.bpjsAmount / metrics.totalRevenue) * 100 : 0}%` }}
                className="bg-purple-500 h-full transition-all"
                title="BPJS / Klaim"
              />
            </div>

            {/* List Breakdown Items */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-slate-700">Tunai (Cash Loket Kasir)</span>
                </div>
                <div className="text-right font-mono">
                  <strong className="text-slate-900 font-bold">{formatRupiah(metrics.tunaiAmount)}</strong>
                  <span className="text-slate-400 text-[11px] ml-2">({metrics.tunaiCount} Tx)</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="font-semibold text-slate-700">QRIS / Transfer Bank</span>
                </div>
                <div className="text-right font-mono">
                  <strong className="text-slate-900 font-bold">{formatRupiah(metrics.qrisAmount)}</strong>
                  <span className="text-slate-400 text-[11px] ml-2">({metrics.qrisCount} Tx)</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="font-semibold text-slate-700">Kartu Debit / Mesin EDC</span>
                </div>
                <div className="text-right font-mono">
                  <strong className="text-slate-900 font-bold">{formatRupiah(metrics.debitAmount)}</strong>
                  <span className="text-slate-400 text-[11px] ml-2">({metrics.debitCount} Tx)</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-purple-500" />
                  <span className="font-semibold text-slate-700">BPJS Kesehatan / Penjamin</span>
                </div>
                <div className="text-right font-mono">
                  <strong className="text-slate-900 font-bold">{formatRupiah(metrics.bpjsAmount)}</strong>
                  <span className="text-slate-400 text-[11px] ml-2">({metrics.bpjsCount} Tx)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Right: Pendapatan per Unit Pelayanan (6 cols) */}
        <Card className="card-premium lg:col-span-6 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-sky-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Distribusi per Unit Pelayanan
                </CardTitle>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                {serviceBreakdown.length} Unit Pelayanan
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5">
            {serviceBreakdown.length > 0 ? (
              serviceBreakdown.map((srv, idx) => {
                const percent = metrics.totalRevenue > 0 ? Math.round((srv.total / metrics.totalRevenue) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                          {srv.code}
                        </span>
                        <span className="font-bold text-slate-800">{srv.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(srv.total)} <span className="text-slate-400 font-normal">({percent}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className="h-full bg-sky-500 rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Belum ada data distribusi unit layanan.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="card-premium overflow-hidden flex flex-col">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5 shrink-0 space-y-4">
          {/* Top Bar: Title & Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-black text-slate-900 tracking-tight">
                  {activeReportTab === "rekap"
                    ? "Laporan Rekap Penerimaan Kasir (Per-Hari)"
                    : "Laporan Rincian Tindakan & Pelayanan Kasir (Per-Hari)"}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  {activeReportTab === "rekap"
                    ? "Ikhtisar transaksi penerimaan harian per pasien dan metode pembayaran"
                    : "Rincian menyeluruh seluruh item tindakan medis, pemeriksaan, dan kuantitas per transaksi"}
                </CardDescription>
              </div>
            </div>

            {/* Tab Switcher: Rekap vs Rincian */}
            <div className="flex items-center p-1 bg-slate-200/80 rounded-2xl border border-slate-300/70 shadow-inner shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveReportTab("rekap");
                  setCurrentPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeReportTab === "rekap"
                    ? "bg-white text-amber-700 shadow-sm shadow-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Laporan Rekap</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-extrabold",
                    activeReportTab === "rekap"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-300/80 text-slate-700"
                  )}
                >
                  {filteredData.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveReportTab("rincian");
                  setCurrentPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeReportTab === "rincian"
                    ? "bg-white text-amber-700 shadow-sm shadow-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Laporan Rincian Tindakan</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-extrabold",
                    activeReportTab === "rincian"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-300/80 text-slate-700"
                  )}
                >
                  {filteredActionItems.length}
                </span>
              </button>
            </div>
          </div>

          {/* Filter & Search Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={
                  activeReportTab === "rekap"
                    ? "Cari No. Registrasi, RM, Pasien..."
                    : "Cari No. Reg, Pasien, Tindakan..."
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 h-10 text-xs bg-white border-slate-200 rounded-xl focus:border-amber-500 shadow-2xs"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tanggal Harian (Per-Hari) with Quick Presets */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-10 text-xs shadow-2xs">
                <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-400">Tanggal:</span>
                <input
                  type="date"
                  value={
                    dateFilter === "TODAY"
                      ? new Date().toISOString().split("T")[0]
                      : dateFilter
                  }
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-0 text-slate-800 font-bold focus:outline-none cursor-pointer pr-1 text-xs"
                />
                <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter("TODAY");
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer",
                      dateFilter === "TODAY"
                        ? "bg-amber-100 text-amber-800"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    )}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yest = new Date();
                      yest.setDate(yest.getDate() - 1);
                      setDateFilter(yest.toISOString().split("T")[0]);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer",
                      dateFilter !== "TODAY" &&
                        dateFilter ===
                          new Date(Date.now() - 86400000).toISOString().split("T")[0]
                        ? "bg-amber-100 text-amber-800"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    )}
                  >
                    Kemarin
                  </button>
                </div>
              </div>

              {/* Pelayanan Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-10 text-xs shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={serviceFilter}
                  onChange={(e) => {
                    setServiceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-0 text-slate-700 font-semibold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">Semua Pelayanan</option>
                  <option value="01">01 - Poli Umum</option>
                  <option value="02">02 - Poli Gigi</option>
                  <option value="03">03 - Poli Anak</option>
                  <option value="04">04 - Poli Penyakit Dalam</option>
                  <option value="05">05 - Poli Bedah</option>
                  <option value="08">08 - Poli Kandungan</option>
                </select>
              </div>

              {/* Metode Bayar Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-10 text-xs shadow-2xs">
                <Wallet className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={methodFilter}
                  onChange={(e) => {
                    setMethodFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-0 text-slate-700 font-semibold focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">Semua Metode</option>
                  <option value="CASH">Tunai (Cash)</option>
                  <option value="QRIS">QRIS / Digital</option>
                  <option value="DEBIT">Kartu Debit</option>
                  <option value="BPJS">BPJS / Klaim</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchReportData}
                className="h-10 w-10 bg-white border-slate-200 text-slate-500 hover:text-amber-600 rounded-xl shadow-2xs cursor-pointer"
                title="Muat Ulang Data"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-amber-600")} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Table Content: Rekap vs Rincian */}
        <div className="p-0 overflow-x-auto custom-scrollbar flex-1 flex flex-col min-h-[380px]">
          {activeReportTab === "rekap" ? (
            /* TABULAR LAPORAN REKAP: No. Registrasi, No. RM, Nama Pasien, Poli/Pelayanan, Metode Bayar, Total Bayar, Status */
            <Table className="w-full min-w-[1000px]">
              <TableHeader className="bg-slate-50/70 border-b border-slate-100 shrink-0">
                <TableRow>
                  <TableHead className="w-[50px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 text-center">
                    No
                  </TableHead>
                  <TableHead className="w-[160px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    No. Registrasi
                  </TableHead>
                  <TableHead className="w-[130px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    No. RM
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Nama Pasien
                  </TableHead>
                  <TableHead className="w-[190px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Poli / Pelayanan
                  </TableHead>
                  <TableHead className="w-[150px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Metode Bayar
                  </TableHead>
                  <TableHead className="w-[140px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Total Bayar
                  </TableHead>
                  <TableHead className="w-[100px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Status
                  </TableHead>
                  <TableHead className="w-[110px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 text-center">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                        <span className="text-xs font-semibold text-slate-600">
                          Memuat data rekap penerimaan kasir...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedRekapData.length > 0 ? (
                  paginatedRekapData.map((item, idx) => {
                    const dept = getDepartmentName(item.department_code);

                    return (
                      <TableRow
                        key={idx}
                        className="hover:bg-amber-50/30 transition-colors border-b border-slate-100/80"
                      >
                        {/* 0. No. Urut */}
                        <TableCell className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-500">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </TableCell>

                        {/* 1. No. Registrasi */}
                        <TableCell className="py-3 px-4 font-mono font-bold text-xs text-amber-700">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 tracking-wider inline-block shadow-2xs">
                            {item.encounter_no}
                          </span>
                        </TableCell>

                        {/* 2. No. RM */}
                        <TableCell className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-md text-xs tracking-wider inline-block shadow-2xs">
                            {item.mrn}
                          </span>
                        </TableCell>

                        {/* 3. Nama Pasien */}
                        <TableCell className="py-3 px-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900 text-xs">
                              {item.patient_name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Pukul {item.paid_at} • {item.cashier_name}
                            </p>
                          </div>
                        </TableCell>

                        {/* 4. Poli / Pelayanan */}
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-sky-100/90 text-sky-800 border border-sky-200 shadow-2xs">
                              {item.department_code}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {dept}
                            </span>
                          </div>
                        </TableCell>

                        {/* 5. Metode Bayar */}
                        <TableCell className="py-3 px-4">
                          {item.payment_method === "CASH" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Tunai (Cash)</span>
                            </span>
                          ) : item.payment_method === "QRIS" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              <QrCode className="h-3.5 w-3.5 text-amber-600" />
                              <span>QRIS / Digital</span>
                            </span>
                          ) : item.payment_method === "DEBIT" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                              <span>Debit EDC</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg shadow-2xs">
                              <Layers className="h-3.5 w-3.5 text-purple-600" />
                              <span>BPJS Klaim</span>
                            </span>
                          )}
                        </TableCell>

                        {/* 6. Total Bayar */}
                        <TableCell className="py-3 px-4 font-mono font-black text-xs text-slate-900">
                          {formatRupiah(item.total_amount)}
                        </TableCell>

                        {/* 7. Status */}
                        <TableCell className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>Lunas</span>
                          </span>
                        </TableCell>

                        {/* 8. Aksi (Kwitansi & Rincian Struk) */}
                        <TableCell className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenReceipt(item)}
                            className="h-8 px-2.5 text-xs font-bold text-amber-700 bg-amber-50/70 border-amber-200 hover:bg-amber-100 hover:text-amber-800 rounded-lg shadow-2xs gap-1.5 cursor-pointer"
                            title="Lihat Struk / Kwitansi & Rincian Tindakan"
                          >
                            <Receipt className="h-3.5 w-3.5 text-amber-600" />
                            <span>Kwitansi</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="h-8 w-8 text-slate-300" />
                        <p className="font-bold text-slate-600 text-sm">
                          Tidak ada data rekap penerimaan kasir
                        </p>
                        <p className="text-xs text-slate-400">
                          Silakan sesuaikan filter tanggal atau kata kunci pencarian.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter className="bg-slate-100/90 border-t-2 border-slate-300 font-bold">
                <TableRow>
                  <TableCell colSpan={6} className="py-3 px-4 text-right text-xs font-black text-slate-800 uppercase tracking-wider">
                    Total Penerimaan:
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono font-black text-xs text-amber-800">
                    {formatRupiah(metrics.totalRevenue)}
                  </TableCell>
                  <TableCell colSpan={2} className="py-3 px-4 text-center text-xs font-bold text-emerald-700">
                    {filteredData.length} Pasien / Transaksi
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            /* TABULAR LAPORAN RINCIAN: No. Registrasi, No. RM, Nama Pasien, Poli/Pelayanan, Tindakan/Pelayanan, Qty, Metode Bayar, Total Bayar, Status */
            <Table className="w-full min-w-[1100px]">
              <TableHeader className="bg-slate-50/70 border-b border-slate-100 shrink-0">
                <TableRow>
                  <TableHead className="w-[50px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 text-center">
                    No
                  </TableHead>
                  <TableHead className="w-[150px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    No. Registrasi
                  </TableHead>
                  <TableHead className="w-[120px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    No. RM
                  </TableHead>
                  <TableHead className="w-[170px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Nama Pasien
                  </TableHead>
                  <TableHead className="w-[160px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Poli / Pelayanan
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Tindakan / Pelayanan
                  </TableHead>
                  <TableHead className="w-[80px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 text-center">
                    Qty
                  </TableHead>
                  <TableHead className="w-[140px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Metode Bayar
                  </TableHead>
                  <TableHead className="w-[130px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Total Bayar
                  </TableHead>
                  <TableHead className="w-[90px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                    Status
                  </TableHead>
                  <TableHead className="w-[90px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 text-center">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                        <span className="text-xs font-semibold text-slate-600">
                          Memuat rincian tindakan kasir...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedActionData.length > 0 ? (
                  paginatedActionData.map((item, idx) => {
                    return (
                      <TableRow
                        key={idx}
                        className="hover:bg-amber-50/30 transition-colors border-b border-slate-100/80"
                      >
                        {/* 0. No. Urut */}
                        <TableCell className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-500">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </TableCell>

                        {/* 1. No. Registrasi */}
                        <TableCell className="py-3 px-4 font-mono font-bold text-xs text-amber-700">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 tracking-wider inline-block">
                            {item.encounter_no}
                          </span>
                        </TableCell>

                        {/* 2. No. RM */}
                        <TableCell className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs tracking-wider inline-block">
                            {item.mrn}
                          </span>
                        </TableCell>

                        {/* 3. Nama Pasien */}
                        <TableCell className="py-3 px-4 font-bold text-slate-900 text-xs">
                          {item.patient_name}
                        </TableCell>

                        {/* 4. Poli / Pelayanan */}
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                              {item.department_code}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {item.department_name}
                            </span>
                          </div>
                        </TableCell>

                        {/* 5. Tindakan / Pelayanan */}
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-bold text-slate-900">
                              {item.action_name}
                            </span>
                          </div>
                        </TableCell>

                        {/* 6. Qty */}
                        <TableCell className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-md font-mono font-black text-xs bg-slate-100 text-slate-800 border border-slate-200 inline-block shadow-2xs">
                            {item.qty}x
                          </span>
                        </TableCell>

                        {/* 7. Metode Bayar */}
                        <TableCell className="py-3 px-4">
                          {item.payment_method === "CASH" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                              <Banknote className="h-3 w-3 text-emerald-600" />
                              <span>Tunai</span>
                            </span>
                          ) : item.payment_method === "QRIS" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md shadow-2xs">
                              <QrCode className="h-3 w-3 text-amber-600" />
                              <span>QRIS</span>
                            </span>
                          ) : item.payment_method === "DEBIT" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shadow-2xs">
                              <CreditCard className="h-3 w-3 text-blue-600" />
                              <span>Debit</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md shadow-2xs">
                              <Layers className="h-3 w-3 text-purple-600" />
                              <span>BPJS</span>
                            </span>
                          )}
                        </TableCell>

                        {/* 8. Total Bayar */}
                        <TableCell className="py-3 px-4 font-mono font-black text-xs text-slate-900">
                          {formatRupiah(item.amount)}
                        </TableCell>

                        {/* 9. Status */}
                        <TableCell className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>Lunas</span>
                          </span>
                        </TableCell>

                        {/* 10. Aksi */}
                        <TableCell className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenReceipt(item.original_record)}
                            className="h-7 px-2 text-xs font-bold text-amber-700 hover:bg-amber-100 rounded-md cursor-pointer"
                            title="Buka Kuitansi"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Layers className="h-8 w-8 text-slate-300" />
                        <p className="font-bold text-slate-600 text-sm">
                          Tidak ada rincian tindakan ditemukan
                        </p>
                        <p className="text-xs text-slate-400">
                          Silakan sesuaikan filter tanggal atau kata kunci pencarian tindakan.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter className="bg-slate-100/90 border-t-2 border-slate-300 font-bold">
                <TableRow>
                  <TableCell colSpan={8} className="py-3 px-4 text-right text-xs font-black text-slate-800 uppercase tracking-wider">
                    Total Nilai Tindakan & Layanan:
                  </TableCell>
                  <TableCell className="py-3 px-4 font-mono font-black text-xs text-amber-800">
                    {formatRupiah(metrics.totalRevenue)}
                  </TableCell>
                  <TableCell colSpan={2} className="py-3 px-4 text-center text-xs font-bold text-emerald-700">
                    {filteredActionItems.length} Item Tindakan
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </div>

        {/* Standard SIMRS Pagination Footer */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan{" "}
              <strong>
                {totalItemsCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </strong>{" "}
              -{" "}
              <strong>
                {Math.min(currentPage * pageSize, totalItemsCount)}
              </strong>{" "}
              dari <strong>{totalItemsCount}</strong>{" "}
              {activeReportTab === "rekap" ? "transaksi lunas" : "item tindakan/layanan"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Baris:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
              >
                <option value={5}>5 / hal</option>
                <option value={10}>10 / hal</option>
                <option value={20}>20 / hal</option>
                <option value={50}>50 / hal</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 text-xs rounded-lg border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Sebelumnya
              </Button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((pageNum, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && pageNum - prev > 1;

                    return (
                      <div key={pageNum} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "h-8 w-8 rounded-lg text-xs font-bold transition-all cursor-pointer",
                            currentPage === pageNum
                              ? "bg-amber-600 text-white shadow-2xs"
                              : "text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {pageNum}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2.5 text-xs rounded-lg border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Selanjutnya <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Official A4 Settlement Report Print Dialog */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-4xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl"
        >
          {/* Dialog Header */}
          <DialogHeader className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-5 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Printer className="h-5 w-5" />
                {activeReportTab === "rekap"
                  ? "Laporan Rekapitulasi Penerimaan Kasir"
                  : "Laporan Rincian Tindakan & Pelayanan Kasir"}
              </DialogTitle>
              <p className="text-xs text-amber-100 mt-0.5">
                {activeReportTab === "rekap"
                  ? "Dokumen Berita Acara Rekonsiliasi & Setoran Kasir Resmi (Dapat Dicetak atau Disimpan ke PDF)"
                  : "Dokumen Rincian Seluruh Tindakan, Layanan & Kuantitas Kasir Resmi (Dapat Dicetak atau Disimpan ke PDF)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrintDocument("pdf")}
                className="bg-white/95 text-amber-900 hover:bg-white font-bold text-xs h-8 px-3 rounded-lg shadow-sm gap-1.5 cursor-pointer border border-amber-200"
                title="Simpan sebagai file PDF"
              >
                <Download className="h-3.5 w-3.5 text-amber-700" />
                Simpan PDF
              </Button>
              <Button
                size="sm"
                onClick={() => handlePrintDocument("print")}
                className="bg-slate-900 text-white hover:bg-black font-bold text-xs h-8 px-3.5 rounded-lg shadow-sm gap-1.5 cursor-pointer"
                title="Cetak langsung ke printer fisik"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak ke Printer
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-white hover:bg-white/20 h-8 w-8 rounded-lg cursor-pointer ml-1"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Sub-toolbar: Date Picker (Bisa pilih tanggal sebelumnya) & Tab Switcher */}
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white border border-amber-300/80 rounded-lg px-2.5 py-1 shadow-2xs">
                <Calendar className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span className="text-[11px] font-bold text-slate-600">Pilih Tanggal Laporan:</span>
                <input
                  type="date"
                  value={
                    dateFilter === "TODAY"
                      ? new Date().toISOString().split("T")[0]
                      : dateFilter
                  }
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-0 text-slate-900 font-bold focus:outline-none cursor-pointer text-xs"
                />
              </div>

              <div className="flex items-center gap-1 bg-white p-0.5 border border-amber-200 rounded-lg shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter("TODAY");
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                    dateFilter === "TODAY"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const yest = new Date();
                    yest.setDate(yest.getDate() - 1);
                    setDateFilter(yest.toISOString().split("T")[0]);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                    dateFilter !== "TODAY" &&
                      dateFilter ===
                        new Date(Date.now() - 86400000).toISOString().split("T")[0]
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  Kemarin
                </button>
              </div>
            </div>

            {/* In-Modal Tab Switcher */}
            <div className="flex items-center p-0.5 bg-white rounded-lg border border-amber-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveReportTab("rekap")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  activeReportTab === "rekap"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Laporan Rekap ({filteredData.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveReportTab("rincian")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                  activeReportTab === "rincian"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Laporan Rincian ({filteredActionItems.length})
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div ref={printableRef} className="p-8 bg-white space-y-6 text-slate-800 text-xs font-sans max-h-[72vh] overflow-y-auto custom-scrollbar">
            {/* Hospital Official Header */}
            <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
              <h2 className="text-lg font-black tracking-wider text-slate-900 uppercase">
                CODINA SIMRS ONE - RSUD KOTA
              </h2>
              <p className="text-[11px] text-slate-600">
                Pusat Pelayanan Kesehatan Terpadu • Jl. Kesehatan No. 1 • Telp: (021) 555-1234
              </p>
              <h3 className="text-sm font-black text-slate-900 tracking-wide uppercase pt-2">
                {activeReportTab === "rekap"
                  ? "BERITA ACARA REKAPITULASI PENERIMAAN KASIR (HARIAN)"
                  : "LAPORAN RINCIAN TINDAKAN & PELAYANAN KASIR (HARIAN)"}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Periode: {formatReportDate(dateFilter)} • Dicetak: {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
              </p>
            </div>

            {/* Table Content: Rekap Tabular vs Rincian Tabular */}
            {activeReportTab === "rekap" ? (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Daftar Transaksi Rekapitulasi Kasir ({filteredData.length} Pasien)
                </h4>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 p-1.5 text-center w-10 font-bold">No</th>
                      <th className="border border-slate-300 p-1.5 text-left">No. Registrasi</th>
                      <th className="border border-slate-300 p-1.5 text-left">No. RM</th>
                      <th className="border border-slate-300 p-1.5 text-left">Nama Pasien</th>
                      <th className="border border-slate-300 p-1.5 text-left">Pelayanan</th>
                      <th className="border border-slate-300 p-1.5 text-center">Metode</th>
                      <th className="border border-slate-300 p-1.5 text-right">Total Bayar</th>
                      <th className="border border-slate-300 p-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-1.5 text-center font-bold text-slate-700">{i + 1}</td>
                        <td className="border border-slate-300 p-1.5 font-mono font-bold">{item.encounter_no}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{item.mrn}</td>
                        <td className="border border-slate-300 p-1.5 font-medium">{item.patient_name}</td>
                        <td className="border border-slate-300 p-1.5">{getDepartmentName(item.department_code)}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-semibold">{item.payment_method}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">{formatRupiah(item.total_amount)}</td>
                        <td className="border border-slate-300 p-1.5 text-center text-emerald-700 font-bold">{item.status || "LUNAS"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={6} className="border border-slate-300 p-2 text-right">TOTAL KESELURUHAN:</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-black text-amber-800">
                        {formatRupiah(metrics.totalRevenue)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center text-emerald-700">LUNAS</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Daftar Rincian Tindakan Medis & Layanan ({filteredActionItems.length} Item Tindakan)
                </h4>
                <table className="w-full border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 p-1.5 text-center w-10 font-bold">No</th>
                      <th className="border border-slate-300 p-1.5 text-left">No. Registrasi</th>
                      <th className="border border-slate-300 p-1.5 text-left">No. RM</th>
                      <th className="border border-slate-300 p-1.5 text-left">Nama Pasien</th>
                      <th className="border border-slate-300 p-1.5 text-left">Pelayanan</th>
                      <th className="border border-slate-300 p-1.5 text-left">Tindakan / Pelayanan</th>
                      <th className="border border-slate-300 p-1.5 text-center w-12">Qty</th>
                      <th className="border border-slate-300 p-1.5 text-center">Metode</th>
                      <th className="border border-slate-300 p-1.5 text-right">Total Bayar</th>
                      <th className="border border-slate-300 p-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActionItems.map((item, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-1.5 text-center font-bold text-slate-700">{i + 1}</td>
                        <td className="border border-slate-300 p-1.5 font-mono font-bold">{item.encounter_no}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{item.mrn}</td>
                        <td className="border border-slate-300 p-1.5 font-medium">{item.patient_name}</td>
                        <td className="border border-slate-300 p-1.5">{item.department_name}</td>
                        <td className="border border-slate-300 p-1.5 font-bold text-slate-900">{item.action_name}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">{item.qty}x</td>
                        <td className="border border-slate-300 p-1.5 text-center font-semibold">{item.payment_method}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">{formatRupiah(item.amount)}</td>
                        <td className="border border-slate-300 p-1.5 text-center text-emerald-700 font-bold">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={8} className="border border-slate-300 p-2 text-right">TOTAL KESELURUHAN:</td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-black text-amber-800">
                        {formatRupiah(metrics.totalRevenue)}
                      </td>
                      <td className="border border-slate-300 p-2 text-center text-emerald-700">LUNAS</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Dual Signature Section */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-14">
                <p className="font-medium text-slate-600">Diserahkan oleh (Petugas Kasir),</p>
                <div>
                  <p className="font-bold underline text-slate-900">Staf Kasir SIMRS</p>
                  <p className="text-[10px] text-slate-400 font-mono">NIP: 19920815 202012 1 002</p>
                </div>
              </div>

              <div className="space-y-14">
                <p className="font-medium text-slate-600">Diverifikasi oleh (Supervisor Keuangan),</p>
                <div>
                  <p className="font-bold underline text-slate-900">Kabag Keuangan & Akuntansi</p>
                  <p className="text-[10px] text-slate-400 font-mono">NIP: 19850420 201001 2 005</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setIsPrintModalOpen(false)} className="cursor-pointer">
              Tutup
            </Button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrintDocument("pdf")}
                className="bg-white border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-xs gap-1.5 cursor-pointer shadow-2xs"
                title="Simpan Dokumen ke Format PDF"
              >
                <Download className="h-4 w-4 text-amber-600" />
                Simpan PDF
              </Button>
              <Button
                size="sm"
                onClick={() => handlePrintDocument("print")}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-sm"
                title="Cetak Langsung ke Mesin Printer"
              >
                <Printer className="h-4 w-4" />
                Cetak ke Printer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kwitansi & Rincian Tindakan Transaksi Kasir Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-xl md:max-w-2xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl"
        >
          <DialogHeader className="p-5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/20 text-white">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white">
                  Kwitansi & Rincian Transaksi Kasir
                </DialogTitle>
                <p className="text-xs text-amber-100 mt-0.5 font-mono">
                  No. Registrasi: #{selectedReceiptRecord?.encounter_no} • No. RM: {selectedReceiptRecord?.mrn}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrintReceipt}
                className="bg-white hover:bg-amber-50 text-amber-900 font-bold text-xs h-9 px-4 rounded-xl shadow-sm gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Nota</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-white hover:bg-white/20 h-8 w-8 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Printable Receipt Paper Container */}
          <div ref={receiptPrintRef} className="p-6 sm:p-8 bg-white text-slate-800 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar font-sans">
            {/* Header RS */}
            <div className="text-center pb-4 border-b-2 border-dashed border-slate-300 space-y-1">
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">CODINA SIMRS ONE - RSUD KOTA</h2>
              <p className="text-xs text-slate-500 font-medium">Pusat Pelayanan Kesehatan Terpadu • Loket Kasir Rawat Jalan</p>
              <p className="text-[11px] text-slate-400">Jl. Kesehatan No. 1 • Telp: (021) 555-1234 • Email: kasir@simrs-one.id</p>
              <h3 className="text-xs font-black text-amber-700 tracking-wider uppercase pt-2">
                KWITANSI & BUKTI PELUNASAN PASIEN
              </h3>
            </div>

            {/* Kwitansi Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <p><span className="text-slate-400">No. Registrasi:</span> <strong className="font-mono text-amber-700">{selectedReceiptRecord?.encounter_no}</strong></p>
                <p><span className="text-slate-400">No. Rekam Medis:</span> <strong className="font-mono text-slate-900">{selectedReceiptRecord?.mrn}</strong></p>
                <p><span className="text-slate-400">Nama Pasien:</span> <strong className="text-slate-900">{selectedReceiptRecord?.patient_name}</strong></p>
              </div>
              <div className="space-y-1 text-right sm:text-left">
                <p><span className="text-slate-400">Pelayanan:</span> <strong className="text-slate-900">[{selectedReceiptRecord?.department_code}] {getDepartmentName(selectedReceiptRecord?.department_code)}</strong></p>
                <p><span className="text-slate-400">Waktu Bayar:</span> <strong className="text-slate-900">{formatReportDate(dateFilter)} • {selectedReceiptRecord?.paid_at}</strong></p>
                <p><span className="text-slate-400">Petugas Kasir:</span> <strong className="text-slate-900">{selectedReceiptRecord?.cashier_name}</strong></p>
              </div>
            </div>

            {/* Rincian Tindakan & Item Layanan Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Rincian Tindakan & Tarif Layanan
                </h4>
                <span className="text-[11px] text-slate-400">
                  {receiptInvoice?.items && receiptInvoice.items.length > 0 ? `${receiptInvoice.items.length} Komponen Biaya` : "Paket Layanan Standar"}
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="text-center py-2.5 px-3 w-10">No</th>
                      <th className="text-left py-2.5 px-3">Uraian Pelayanan / Tindakan Medis</th>
                      <th className="text-center py-2.5 px-3 w-16">Qty</th>
                      <th className="text-right py-2.5 px-3 w-28">Tarif Satuan</th>
                      <th className="text-right py-2.5 px-3 w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingReceipt ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
                            <span>Memuat rincian tindakan medis...</span>
                          </div>
                        </td>
                      </tr>
                    ) : receiptInvoice?.items && receiptInvoice.items.length > 0 ? (
                      receiptInvoice.items.map((it, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{i + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{it.description}</td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-mono">1</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatRupiah(it.amount)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(it.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <>
                        <tr className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">1</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">Biaya Pendaftaran & Administrasi Rekam Medis</td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-mono">1</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatRupiah(15000)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(15000)}</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">2</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            Jasa Pemeriksaan & Konsultasi Dokter ({getDepartmentName(selectedReceiptRecord?.department_code)})
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-mono">1</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatRupiah(35000)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(35000)}</td>
                        </tr>
                        {selectedReceiptRecord && selectedReceiptRecord.total_amount > 50000 && (
                          <tr className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">3</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">Tindakan Medis & Pemeriksaan Penunjang Poli</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 font-mono">1</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              {formatRupiah(selectedReceiptRecord.total_amount - 50000)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatRupiah(selectedReceiptRecord.total_amount - 50000)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right text-slate-600">TOTAL PEMBAYARAN:</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-700 text-sm">
                        {formatRupiah(selectedReceiptRecord?.total_amount || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Financial Summary & Payment Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-50/40 p-4 rounded-xl border border-amber-200/80 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Metode Pembayaran:</span>
                  <strong className="text-slate-900">{selectedReceiptRecord?.payment_method}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Status Pembayaran:</span>
                  <span className="font-bold text-emerald-700">LUNAS (PAID)</span>
                </div>
              </div>
              <div className="space-y-1.5 sm:border-l sm:border-amber-200/60 sm:pl-4">
                <div className="flex justify-between">
                  <span className="text-slate-600">Jumlah Uang Diterima:</span>
                  <strong className="font-mono text-slate-900">{formatRupiah(selectedReceiptRecord?.total_amount || 0)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Kembalian:</span>
                  <strong className="font-mono text-slate-900">{formatRupiah(0)}</strong>
                </div>
              </div>
            </div>

            {/* Dual Signatures */}
            <div className="pt-4 border-t-2 border-dashed border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-12">
                <p className="text-slate-500 font-medium">Pasien / Penanggung Jawab,</p>
                <div>
                  <p className="font-bold text-slate-900 underline">{selectedReceiptRecord?.patient_name || "(.........................)"}</p>
                </div>
              </div>
              <div className="space-y-12">
                <p className="text-slate-500 font-medium">Petugas Loket Kasir,</p>
                <div>
                  <p className="font-bold text-slate-900 underline">{selectedReceiptRecord?.cashier_name || "Staf Kasir"}</p>
                  <p className="text-[10px] text-slate-400 font-mono">RSUD Kota - SIMRS ONE</p>
                </div>
              </div>
            </div>

            <div className="text-center pt-1 text-[10px] text-slate-400">
              <p>Simpan bukti pembayaran ini sebagai tanda bukti pelunasan yang sah.</p>
              <p>Terima kasih atas kunjungan Anda di RSUD Kota.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => setIsReceiptModalOpen(false)} className="cursor-pointer">
              Tutup
            </Button>
            <Button
              onClick={handlePrintReceipt}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs gap-2 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Cetak Kwitansi Sekarang
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
