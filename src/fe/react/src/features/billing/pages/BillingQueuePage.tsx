import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getBillingQueue, getInvoice, type BillingPatientQueueItem, type Invoice } from "../api/billingApi";
import {
  Wallet,
  Receipt,
  RefreshCw,
  Clock,
  Search,
  ListFilter,
  CreditCard,
  Eye,
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Printer,
  X,
  FileText,
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
import { kasirTheme, getKasirStatusBadge, formatRupiah } from "../theme";
import { cn } from "@/lib/utils";

function formatGender(gender?: string) {
  if (!gender || gender === "-") return "-";
  const g = gender.toLowerCase();
  if (g.startsWith("l") || g === "male") return "Laki-laki";
  if (g.startsWith("p") || g.startsWith("f") || g.startsWith("w")) return "Perempuan";
  return gender;
}

function calculateAge(birthDateStr?: string) {
  if (!birthDateStr || birthDateStr === "-") return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? `${age} th` : null;
}

function formatRegistrationTime(timeStr?: string) {
  if (!timeStr) return "-";
  try {
    if (timeStr.includes("T") || (timeStr.includes("-") && timeStr.includes(":"))) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      }
    }
    const match = timeStr.match(/\d{2}:\d{2}/);
    if (match) return match[0];
  } catch {
    // fallback
  }
  return timeStr;
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

export function BillingQueuePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [queue, setQueue] = useState<BillingPatientQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [poliFilter, setPoliFilter] = useState("ALL");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState<BillingPatientQueueItem | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getBillingQueue();
      setQueue(data);
    } catch (err) {
      console.error("Failed to load queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const countUnpaid = useMemo(() => {
    return queue.filter((item) => item.status === "WAITING_FOR_PAYMENT" || item.status === "REGISTERED").length;
  }, [queue]);

  const countPaid = useMemo(() => {
    return queue.filter(
      (item) => item.status !== "WAITING_FOR_PAYMENT" && item.status !== "REGISTERED" && item.status !== "CANCELLED"
    ).length;
  }, [queue]);

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      const deptName = getDepartmentName(item.department_code);
      const matchesSearch =
        !searchQuery ||
        item.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.encounter_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deptName.toLowerCase().includes(searchQuery.toLowerCase());

      const isUnpaid = item.status === "WAITING_FOR_PAYMENT" || item.status === "REGISTERED";
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "UNPAID" && isUnpaid) ||
        (statusFilter === "PAID" && !isUnpaid && item.status !== "CANCELLED");

      const matchesPoli =
        poliFilter === "ALL" ||
        item.department_code === poliFilter ||
        deptName.toLowerCase().includes(poliFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesPoli;
    });
  }, [queue, searchQuery, statusFilter, poliFilter]);

  // Pagination calculation
  const totalData = filteredQueue.length;
  const totalPages = Math.ceil(totalData / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQueue.slice(start, start + pageSize);
  }, [filteredQueue, currentPage, pageSize]);

  // Open Detail Invoice Modal
  const handleOpenDetail = async (item: BillingPatientQueueItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
    setLoadingDetail(true);
    try {
      const inv = await getInvoice(item.encounter_no);
      setInvoiceDetail(inv);
    } catch (err) {
      console.error("Failed to load invoice detail", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className={kasirTheme.layout.container}>
      {/* Header */}
      <KasirPageHeader
        title="Antrean Tagihan Pasien"
        description="Daftar seluruh pasien yang memiliki tagihan pelayanan dan siap diproses pembayarannya."
        badge="Kasir Rawat Jalan"
        icon={Receipt}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              onClick={fetchData}
              disabled={loading}
              variant="outline"
              className="h-10 px-4 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs gap-2 transition-all"
            >
              <RefreshCw className={cn("h-4 w-4 text-amber-600", loading && "animate-spin")} />
              <span>Muat Ulang</span>
            </Button>
            <Button
              onClick={() => navigate("/kasir/riwayat-pembayaran")}
              className="h-10 px-4 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md gap-2 transition-all"
            >
              <FileText className="h-4 w-4 text-amber-400" />
              <span>Riwayat Lunas</span>
            </Button>
          </div>
        }
        quickStats={[
          { label: "Menunggu Pembayaran", value: `${countUnpaid} Pasien`, icon: Clock },
          { label: "Lunas Hari Ini", value: `${countPaid} Pasien`, icon: CheckCircle2 },
          { label: "Total Antrean Hari Ini", value: `${queue.length} Pasien`, icon: Wallet },
          { label: "Hasil Filter", value: `${filteredQueue.length} Pasien`, icon: ListFilter },
        ]}
      />

      {/* Main Card with Filter Bar & Table */}
      <Card className="card-premium overflow-hidden flex flex-col">
        {/* Filter Controls Bar */}
        <CardHeader className="bg-slate-50/60 border-b border-slate-100/80 p-5 shrink-0">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nama pasien, No. RM, No. Registrasi, atau Poli..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-11 h-11 bg-white border-slate-200/80 rounded-xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-amber-500 text-xs shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 h-11 shadow-2xs">
                <ListFilter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">Semua ({queue.length})</option>
                  <option value="UNPAID">Menunggu Pembayaran ({countUnpaid})</option>
                  <option value="PAID">Lunas ({countPaid})</option>
                </select>
              </div>

              {/* Poli Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 h-11 shadow-2xs">
                <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Poli:</span>
                <select
                  value={poliFilter}
                  onChange={(e) => {
                    setPoliFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">Semua Poli</option>
                  <option value="01">Poli Umum</option>
                  <option value="02">Poli Gigi</option>
                  <option value="03">Poli Anak</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Standardized SIMRS Table */}
        <div className="p-0 overflow-x-auto custom-scrollbar flex-1 flex flex-col min-h-[420px]">
          <Table className="w-full min-w-[960px]">
            <TableHeader className="bg-slate-50/70 border-b border-slate-100 shrink-0">
              <TableRow>
                <TableHead className="w-[140px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  No. RM
                </TableHead>
                <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Nama Pasien & Info
                </TableHead>
                <TableHead className="w-[160px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  No. Registrasi / Jam
                </TableHead>
                <TableHead className="w-[160px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Poli / Penjamin
                </TableHead>
                <TableHead className="w-[140px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Estimasi Biaya
                </TableHead>
                <TableHead className="w-[160px] text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4">
                  Status
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 w-[160px]">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                      <span className="text-xs font-semibold text-slate-600">Memuat antrean tagihan kasir...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => {
                  const statusInfo = getKasirStatusBadge(item.status);
                  const isUnpaid = item.status === "WAITING_FOR_PAYMENT" || item.status === "REGISTERED";
                  const age = calculateAge(item.date_of_birth);
                  const gender = formatGender(item.gender);
                  const regTime = formatRegistrationTime(item.registered_time);
                  const dept = getDepartmentName(item.department_code);

                  return (
                    <TableRow key={idx} className="hover:bg-amber-50/30 transition-colors border-b border-slate-100/80">
                      {/* No. RM High Contrast Monospace Badge */}
                      <TableCell className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/90 px-2.5 py-1 rounded-md text-xs tracking-wider inline-block shadow-2xs">
                          {item.mrn}
                        </span>
                      </TableCell>

                      {/* Nama Pasien, Umur, Kelamin */}
                      <TableCell className="py-3 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs">{item.patient_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {gender} {age ? `• ${age}` : ""} {item.date_of_birth ? `• ${item.date_of_birth}` : ""}
                          </p>
                        </div>
                      </TableCell>

                      {/* No. Registrasi & Jam */}
                      <TableCell className="py-3 px-4">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs font-semibold text-slate-700">#{item.encounter_no}</p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {regTime}
                          </p>
                        </div>
                      </TableCell>

                      {/* Poli & Penjamin */}
                      <TableCell className="py-3 px-4">
                        <div className="space-y-1">
                          <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                            {dept}
                          </span>
                          <div>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                              item.status_pasien === "Baru RS"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            )}>
                              {item.status_pasien || "Umum"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Total Biaya */}
                      <TableCell className="py-3 px-4 font-bold text-xs text-slate-900">
                        {formatRupiah(50000)}
                      </TableCell>

                      {/* Status Pembayaran */}
                      <TableCell className="py-3 px-4">
                        <span className={cn(kasirTheme.typography.pill, statusInfo.className)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusInfo.dotClass)} />
                          {statusInfo.label}
                        </span>
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => handleOpenDetail(item)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Lihat Rincian Tagihan"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {isUnpaid ? (
                            <Button
                              onClick={() => navigate(`/kasir/bayar/${item.encounter_no}`)}
                              size="sm"
                              className="h-8 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-lg shadow-sm shadow-amber-500/20 gap-1.5 transition-all"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>Bayar</span>
                            </Button>
                          ) : (
                            <Button
                              onClick={() => navigate(`/kasir/riwayat-pembayaran`)}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-xs font-semibold rounded-lg gap-1.5"
                              title="Transaksi Selesai (Lunas)"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Struk</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-20 text-center text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="h-8 w-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">Tidak ada antrean tagihan ditemukan</p>
                      <p className="text-slate-400 text-[11px]">
                        {searchQuery ? "Ubah kata kunci pencarian Anda" : "Semua tagihan pasien saat ini sudah selesai"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Unified SIMRS Pagination Footer */}
        <div className="mt-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/40 rounded-b-2xl shrink-0">
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

      {/* Rincian Tagihan Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className={kasirTheme.layout.modalContent}>
          <DialogHeader className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-white tracking-tight">
                    Rincian Tagihan Pasien
                  </DialogTitle>
                  <p className="text-xs text-slate-300 mt-0.5 font-mono">
                    Encounter: #{selectedItem?.encounter_no}
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Patient Header Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Nama Pasien</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedItem?.patient_name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">No. RM</p>
                <p className="font-mono font-bold text-slate-800 text-xs mt-0.5">{selectedItem?.mrn}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Poliklinik</p>
                <p className="font-semibold text-slate-700 text-xs mt-0.5">
                  {getDepartmentName(selectedItem?.department_code)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Penjamin</p>
                <p className="font-semibold text-slate-700 text-xs mt-0.5">
                  {selectedItem?.status_pasien || "Umum"}
                </p>
              </div>
            </div>

            {/* Invoice Breakdown List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Daftar Biaya Pelayanan
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-bold py-2.5">Uraian / Layanan</TableHead>
                      <TableHead className="text-xs font-bold py-2.5 w-[100px] text-center">Kategori</TableHead>
                      <TableHead className="text-xs font-bold py-2.5 w-[140px] text-right">Tarif (Rp)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingDetail ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-xs text-slate-400">
                          Memuat rincian tarif...
                        </TableCell>
                      </TableRow>
                    ) : invoiceDetail?.items && invoiceDetail.items.length > 0 ? (
                      invoiceDetail.items.map((it, i) => (
                        <TableRow key={i} className="border-b border-slate-100 text-xs">
                          <TableCell className="font-medium text-slate-800 py-3">{it.description}</TableCell>
                          <TableCell className="text-center py-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {it.item_type || "Tindakan"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900 py-3">
                            {formatRupiah(it.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="font-medium text-slate-800 py-3">Pemeriksaan Dokter & Pelayanan Poli</TableCell>
                        <TableCell className="text-center py-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            Tindakan
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900 py-3">
                          {formatRupiah(50000)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Total Clean Strip */}
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-900">Total Tagihan Bersih</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">Biaya yang harus dilunasi pasien di loket kasir</p>
                </div>
                <p className="text-xl font-extrabold text-amber-900 tracking-tight">
                  {formatRupiah(invoiceDetail?.total_amount || 50000)}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDetailOpen(false)}
              className="text-xs font-semibold"
            >
              Tutup
            </Button>
            {selectedItem && (selectedItem.status === "WAITING_FOR_PAYMENT" || selectedItem.status === "REGISTERED") && (
              <Button
                onClick={() => {
                  setIsDetailOpen(false);
                  navigate(`/kasir/bayar/${selectedItem.encounter_no}`);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-sm gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Lanjutkan ke Pembayaran
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
