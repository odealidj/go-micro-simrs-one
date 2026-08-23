import { useState, useEffect, useMemo } from "react";
import {
  getBillingQueue,
  getInvoice,
  type BillingPatientQueueItem,
  type Invoice,
} from "../api/billingApi";
import {
  Receipt,
  Search,
  Calendar,
  RefreshCw,
  Clock,
  Building,
  Hash,
  Printer,
  X,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
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
    return "Poli Kandungan (Obgyn)";
  return `Poli ${code}`;
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

export function InvoicePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [invoices, setInvoices] = useState<BillingPatientQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Modal Detail State
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [activePatient, setActivePatient] = useState<BillingPatientQueueItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchInvoiceList = async (date: string) => {
    setLoading(true);
    try {
      const data = await getBillingQueue(date);
      setInvoices(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load invoice list", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceList(selectedDate);
  }, [selectedDate]);

  // Hanya menampilkan transaksi yang sudah lunas/dibayar
  const paidInvoices = useMemo(() => {
    return invoices.filter(
      (item) => item.status !== "WAITING_FOR_PAYMENT" && item.status !== "REGISTERED" && item.status !== "CANCELLED"
    );
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return paidInvoices.filter((item) => {
      const deptName = getDepartmentName(item.department_code);
      const query = searchQuery.toLowerCase();
      return (
        !query ||
        item.patient_name.toLowerCase().includes(query) ||
        item.mrn.toLowerCase().includes(query) ||
        item.encounter_no.toLowerCase().includes(query) ||
        deptName.toLowerCase().includes(query) ||
        `kw-${item.encounter_no}`.toLowerCase().includes(query) ||
        `inv-${item.encounter_no}`.toLowerCase().includes(query)
      );
    });
  }, [paidInvoices, searchQuery]);

  const totalNominal = useMemo(() => {
    return filteredInvoices.reduce((acc, it) => {
      const isGeneral = it.department_code === "01" || it.department_code === "UMU" || it.department_code.toLowerCase().includes("umum");
      return acc + (isGeneral ? 50000 : 150000);
    }, 0);
  }, [filteredInvoices]);

  const handleOpenDetail = async (patient: BillingPatientQueueItem) => {
    setActivePatient(patient);
    setIsModalOpen(true);
    setLoadingDetail(true);
    try {
      const data = await getInvoice(patient.encounter_no);
      if (data) {
        setActiveInvoice(data);
      } else {
        const deptCode = patient.department_code;
        const isGeneral = deptCode === "01" || deptCode === "UMU" || deptCode.toLowerCase().includes("umum");
        const fee = isGeneral ? 50000 : 150000;
        const deptLabel = getDepartmentName(deptCode);

        setActiveInvoice({
          invoice_id: `KW-${patient.encounter_no}`,
          encounter_no: patient.encounter_no,
          patient_name: patient.patient_name,
          mrn: patient.mrn,
          poli_name: deptLabel,
          total_amount: fee,
          status: "PAID",
          items: [
            {
              description: isGeneral
                ? "Pemeriksaan Dokter Umum (Poli Umum)"
                : `Pemeriksaan Dokter Spesialis (${deptLabel})`,
              amount: fee,
              item_type: "ACTION",
              quantity: 1,
              total: fee,
            },
          ],
        });
      }
    } catch (err) {
      console.error("Failed to get invoice detail", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const isToday = selectedDate === getTodayString();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Receipt className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-black text-slate-900">Riwayat Pembayaran & Kwitansi</h1>
          </div>
          <p className="text-slate-500 text-xs">
            Daftar transaksi tagihan yang telah lunas dan pencetakan bukti kuitansi / struk pembayaran.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs">
            Total Lunas: <strong>{formatRupiah(totalNominal)}</strong>
          </span>
        </div>
      </div>

      {/* Unified Compact Filter Bar (1 Single Row - No Wasted Space) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari No. Struk / Kwitansi, Nama Pasien, No. RM, No. Registrasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-medium"
          />
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl">
            <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              title="Pilih tanggal transaksi"
            />
          </div>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayString())}
              className="px-2.5 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl border border-amber-300 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
            >
              Hari Ini
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchInvoiceList(selectedDate)}
            disabled={loading}
            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={cn("h-4 w-4 text-amber-600", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Main Paid Invoice List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-slate-800 text-sm">
              Transaksi Lunas ({formatDisplayDate(selectedDate)})
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
            {filteredInvoices.length} Pasien
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-2.5 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
              <span className="text-xs font-medium">Memuat riwayat pembayaran...</span>
            </div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2.5">
            <Receipt className="h-9 w-9 opacity-30 text-amber-600" />
            <p className="text-sm font-bold text-slate-700">Belum ada transaksi lunas</p>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? "Tidak ada data yang cocok dengan kata kunci pencarian"
                : `Tidak ada transaksi pembayaran lunas pada tanggal ${formatDisplayDate(selectedDate)}`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredInvoices.map((item) => {
              const deptName = getDepartmentName(item.department_code);
              const ageStr = calculateAge(item.date_of_birth);
              const isGeneral =
                item.department_code === "01" ||
                item.department_code === "UMU" ||
                item.department_code.toLowerCase().includes("umum");
              const estimatedAmount = isGeneral ? 50000 : 150000;

              return (
                <div
                  key={item.encounter_no}
                  className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 hover:bg-slate-50/80 transition-colors group gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Icon Badge */}
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs">
                      <Receipt className="h-5 w-5" />
                    </div>

                    <div className="space-y-1">
                      {/* Line 1: Patient Name, RM, No. Reg, Poli */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {item.patient_name}
                        </span>

                        {/* RM Badge */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded bg-slate-900 text-white font-mono shadow-2xs">
                          <FileText className="h-3 w-3 text-amber-400" />
                          RM: {item.mrn}
                        </span>

                        {/* No. Reg Badge */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 font-mono shadow-2xs">
                          <Hash className="h-3 w-3 text-amber-700" />
                          No. Reg: {item.encounter_no}
                        </span>

                        {/* Poli */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <Building className="h-3 w-3 text-indigo-600" />
                          {deptName}
                        </span>
                      </div>

                      {/* Line 2: No. Kwitansi, Tarif, Age */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          No. Kwitansi: #KW-{item.encounter_no}
                        </span>

                        {ageStr && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {ageStr}
                          </span>
                        )}

                        <span className="font-bold text-slate-800">
                          Jumlah Bayar: <strong className="text-emerald-700 font-mono font-black">{formatRupiah(estimatedAmount)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Status & Print Button */}
                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Lunas
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenDetail(item)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-xl transition-all shadow-2xs cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5 text-slate-600" />
                      <span>Cetak Kwitansi</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs font-medium text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Terakhir diperbarui: <strong className="text-slate-700">{lastRefresh.toLocaleTimeString("id-ID")}</strong>
          </div>
          <div>
            Total: <strong className="text-slate-900 font-bold">{filteredInvoices.length}</strong> Kwitansi Lunas
          </div>
        </div>
      </div>

      {/* Modal Kwitansi Resmi Siap Cetak */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-400" />
                <h3 className="font-extrabold text-sm">Bukti Pembayaran & Kwitansi Pasien</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Receipt */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingDetail ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                  <span className="text-xs font-medium">Memuat detail kwitansi...</span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/60 space-y-4">
                  {/* Hospital Header */}
                  <div className="text-center pb-3 border-b border-dashed border-slate-300">
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">MINI SIMRS HOSPITALS</h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Kuitansi Resmi Pelunasan Rawat Jalan / Poliklinik
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded font-mono text-[11px] font-bold mt-1.5">
                      #{activeInvoice?.invoice_id || `KW-${activePatient?.encounter_no}`}
                    </div>
                  </div>

                  {/* Patient & Encounter Details */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-slate-400 uppercase font-bold text-[10px]">Nama Pasien</p>
                      <p className="font-bold text-slate-900">
                        {activeInvoice?.patient_name || activePatient?.patient_name}
                      </p>
                      <p className="font-mono font-bold text-slate-700 text-[11px]">
                        No. RM: {activeInvoice?.mrn || activePatient?.mrn}
                      </p>
                    </div>

                    <div className="space-y-0.5 text-right">
                      <p className="text-slate-400 uppercase font-bold text-[10px]">Layanan / Poli</p>
                      <p className="font-bold text-slate-900">
                        {activeInvoice?.poli_name || getDepartmentName(activePatient?.department_code)}
                      </p>
                      <p className="font-mono text-slate-600 text-[11px]">
                        Encounter: {activeInvoice?.encounter_no || activePatient?.encounter_no}
                      </p>
                      <p className="text-slate-500 text-[10px]">{formatDisplayDate(selectedDate)}</p>
                    </div>
                  </div>

                  {/* Itemized Table */}
                  <div className="pt-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 text-left font-bold text-slate-600 uppercase text-[10px]">
                          <th className="py-1.5">No</th>
                          <th className="py-1.5">Uraian / Tindakan</th>
                          <th className="py-1.5 text-right">Jumlah (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activeInvoice?.items && activeInvoice.items.length > 0 ? (
                          activeInvoice.items.map((it, idx) => (
                            <tr key={idx} className="py-1.5">
                              <td className="py-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2 font-bold text-slate-800">{it.description}</td>
                              <td className="py-2 text-right font-mono font-bold text-slate-900">
                                {formatRupiah(it.amount)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="py-3 text-center text-slate-400">
                              Tidak ada rincian item.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 font-black text-slate-900">
                          <td colSpan={2} className="py-2.5 text-right text-xs">
                            Total Pembayaran Lunas:
                          </td>
                          <td className="py-2.5 text-right font-mono text-sm text-emerald-800">
                            {formatRupiah(activeInvoice?.total_amount || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Stamp */}
                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-300">
                    <div className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-950 border border-emerald-400 text-xs font-black uppercase tracking-wider">
                      ✓ LUNAS / PAID
                    </div>
                    <div className="text-right text-[10px] text-slate-400 font-mono">
                      Kasir: Operator SIMRS
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="border-slate-300 text-slate-700 rounded-xl"
              >
                Tutup
              </Button>

              <Button
                onClick={handlePrintReceipt}
                size="sm"
                className="bg-slate-900 hover:bg-black text-white rounded-xl gap-1.5 font-bold shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Cetak Kwitansi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
