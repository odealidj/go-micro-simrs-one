import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  getInvoice,
  payInvoice,
  getBillingQueue,
  type Invoice,
  type BillingPatientQueueItem,
} from "../api/billingApi";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Building2,
  ArrowLeft,
  Printer,
  Receipt,
  QrCode,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Search,
  Ban,
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
} from "@/components/ui/table";
import { KasirPageHeader } from "../components/KasirPageHeader";
import { kasirTheme, formatRupiah } from "../theme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  { value: "TUNAI", label: "Tunai (Cash)", icon: Banknote, desc: "Uang tunai loket kasir" },
  { value: "QRIS", label: "QRIS / VA", icon: QrCode, desc: "Scan QRIS & Transfer Bank" },
  { value: "DEBIT", label: "Kartu Debit", icon: CreditCard, desc: "Mesin EDC Debit Bank" },
  { value: "KREDIT", label: "Kartu Kredit", icon: CreditCard, desc: "Visa / Mastercard / JCB" },
  { value: "BPJS", label: "BPJS / JKN", icon: Building2, desc: "Klaim penjaminan BPJS Kesehatan" },
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

export function PaymentPage() {
  const { encounterNo: paramEncounterNo } = useParams<{ encounterNo?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const encounterNo = paramEncounterNo || searchParams.get("no") || searchParams.get("encounter_no") || "";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [patientInfo, setPatientInfo] = useState<BillingPatientQueueItem | null>(null);
  const [allQueue, setAllQueue] = useState<BillingPatientQueueItem[]>([]);
  const [queueSearch, setQueueSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("TUNAI");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [paidReceipt, setPaidReceipt] = useState<{
    invoiceId: string;
    totalAmount: number;
    amountPaid: number;
    change: number;
    paymentMethod: string;
    paidAt: Date;
  } | null>(null);

  // Load full queue for quick picker
  useEffect(() => {
    getBillingQueue().then(setAllQueue).catch(console.error);
  }, []);

  useEffect(() => {
    if (!encounterNo) return;
    const fetchInvoiceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const queueList = await getBillingQueue();
        const found = queueList.find((p) => p.encounter_no === encounterNo);
        if (found) {
          setPatientInfo(found);
        }

        const data = await getInvoice(encounterNo);
        if (data) {
          const cleanedItems = (data.items || []).map((it) => {
            if (it.description.startsWith("Biaya Pendaftaran -")) {
              const deptCode = it.description.replace("Biaya Pendaftaran -", "").trim();
              const isGeneral = deptCode === "01" || deptCode === "UMU";
              const deptName = getDepartmentName(deptCode);
              return {
                ...it,
                description: isGeneral
                  ? "Pemeriksaan Dokter Umum (Poli Umum)"
                  : `Pemeriksaan Dokter Spesialis (${deptName})`,
              };
            }
            return it;
          });

          const deptCode = found?.department_code || (encounterNo.length >= 8 ? encounterNo.substring(6, 8) : "01");
          const deptLabel = getDepartmentName(deptCode);

          setInvoice({
            ...data,
            patient_name: found?.patient_name || data.patient_name || "Pasien SIMRS",
            mrn: found?.mrn || data.mrn || "-",
            poli_name: deptLabel,
            items: cleanedItems.length > 0 ? cleanedItems : data.items,
          });
          setAmountPaid(data.total_amount.toString());
        } else {
          const deptCode = found?.department_code || (encounterNo.length >= 8 ? encounterNo.substring(6, 8) : "01");
          const isGeneral = deptCode === "01" || deptCode === "UMU";
          const fee = isGeneral ? 50000 : 150000;
          const deptLabel = getDepartmentName(deptCode);

          const fallbackInvoice: Invoice = {
            invoice_id: `INV-${encounterNo}`,
            encounter_no: encounterNo,
            patient_name: found?.patient_name || "Pasien SIMRS",
            mrn: found?.mrn || "-",
            total_amount: fee,
            status: found?.status === "WAITING_FOR_PAYMENT" ? "UNPAID" : "PAID",
            poli_name: deptLabel,
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
          };
          setInvoice(fallbackInvoice);
          setAmountPaid(fee.toString());
        }
      } catch {
        setError("Gagal memuat rincian tagihan.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceData();
  }, [encounterNo]);

  const isCancelled =
    patientInfo?.status === "CANCELLED" ||
    patientInfo?.status === "BATAL" ||
    invoice?.status === "CANCELLED";

  const isPaid =
    !isCancelled &&
    (Boolean(paidReceipt) ||
      invoice?.status === "PAID" ||
      (invoice?.is_paid ?? false));

  const totalAmount = invoice?.total_amount || 50000;
  const numAmountPaid = Number(amountPaid) || 0;
  const change = numAmountPaid - totalAmount;

  const handlePay = async () => {
    if (!invoice) return;
    if (numAmountPaid < totalAmount && paymentMethod === "TUNAI") {
      setError("Nominal uang yang diterima kurang dari total tagihan.");
      return;
    }

    setPaying(true);
    setError(null);
    try {
      await payInvoice({
        invoice_id: invoice.invoice_id,
        amount_paid: paymentMethod === "TUNAI" ? numAmountPaid : totalAmount,
        payment_method: paymentMethod,
      });

      const receiptData = {
        invoiceId: invoice.invoice_id,
        totalAmount: totalAmount,
        amountPaid: paymentMethod === "TUNAI" ? numAmountPaid : totalAmount,
        change: Math.max(0, change),
        paymentMethod: paymentMethod,
        paidAt: new Date(),
      };

      setPaidReceipt(receiptData);
      setInvoice((prev) => (prev ? { ...prev, status: "PAID" } : null));

      toast.success("Pembayaran Berhasil Dilunasi!", {
        description: `Encounter #${encounterNo} telah lunas dan diteruskan ke antrean Poliklinik.`,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal memproses pembayaran ke billing service.");
    } finally {
      setPaying(false);
    }
  };

  const setQuickCash = (amount: number) => {
    setAmountPaid(amount.toString());
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered queue for picker when no encounter selected
  const pendingPickerList = useMemo(() => {
    return allQueue
      .filter((p) => p.status === "WAITING_FOR_PAYMENT" || p.status === "REGISTERED")
      .filter((p) => {
        const q = queueSearch.toLowerCase();
        return (
          !queueSearch ||
          p.patient_name.toLowerCase().includes(q) ||
          p.mrn.toLowerCase().includes(q) ||
          p.encounter_no.toLowerCase().includes(q)
        );
      });
  }, [allQueue, queueSearch]);

  if (!encounterNo) {
    return (
      <div className={kasirTheme.layout.container}>
        <KasirPageHeader
          title="Terminal Pembayaran Kasir"
          description="Pilih pasien dari antrean pembayaran rawat jalan untuk memproses transaksi."
          badge="Terminal POS"
          icon={CreditCard}
          actions={
            <Button
              onClick={() => navigate("/kasir/antrean")}
              className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md gap-2"
            >
              <Receipt className="h-4 w-4" />
              Buka Semua Antrean
            </Button>
          }
        />

        <Card className="card-premium max-w-4xl mx-auto overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Pilih Antrean Pasien untuk Diproses
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Klik pada nama pasien di bawah untuk langsung membuka terminal transaksi
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari pasien / No. RM..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="pl-10 h-10 text-xs bg-white border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pendingPickerList.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {pendingPickerList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate(`/kasir/bayar/${item.encounter_no}`)}
                    className="p-4 sm:p-5 flex items-center justify-between hover:bg-amber-50/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-200">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm group-hover:text-amber-800 transition-colors">
                            {item.patient_name}
                          </span>
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">
                            {item.mrn}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                            {getDepartmentName(item.department_code)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Encounter: #{item.encounter_no} • Estimasi: <strong className="text-slate-800">{formatRupiah(50000)}</strong>
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 group-hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 rounded-xl gap-1.5 shrink-0"
                    >
                      <span>Proses Bayar</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto opacity-40" />
                <p className="font-bold text-slate-700 text-sm">Tidak ada antrean menunggu pembayaran</p>
                <p className="text-xs text-slate-400">Seluruh transaksi pasien hari ini telah lunas diselesaikan.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={kasirTheme.layout.container}>
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/kasir/antrean")}
            className="h-10 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 rounded-xl text-xs font-bold shadow-2xs gap-2 transition-all group"
          >
            <ArrowLeft className="h-4 w-4 text-amber-600 group-hover:-translate-x-1 transition-transform" />
            <span>Kembali ke Antrean</span>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Terminal Transaksi Kasir</h1>
            <p className="text-xs text-slate-500">Encounter No: #{encounterNo}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn(
            "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-2xs inline-flex items-center gap-1.5",
            isCancelled
              ? "bg-rose-50 text-rose-800 border-rose-200"
              : isPaid
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-amber-50 text-amber-900 border-amber-200"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              isCancelled ? "bg-rose-500" : isPaid ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
            )} />
            {isCancelled
              ? "Status: DIBATALKAN (CANCELLED)"
              : isPaid
              ? "Status: LUNAS (PAID)"
              : "Status: MENUNGGU PEMBAYARAN"}
          </span>
        </div>
      </div>

      {/* Main Grid Equal Height: Left (Invoice Details), Right (POS Terminal / Receipt) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Rincian Tagihan & Pelayanan (7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <Card className="card-premium overflow-hidden flex flex-col h-full">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Rincian Tagihan & Tarif Pasien
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Faktur tagihan resmi: #{invoice?.invoice_id || `INV-${encounterNo}`}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Demographics Card Strip */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Nama Pasien</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5 truncate">
                  {patientInfo?.patient_name || invoice?.patient_name || "Pasien SIMRS"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">No. RM</p>
                <p className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                  {patientInfo?.mrn || invoice?.mrn || "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Poliklinik</p>
                <p className="font-semibold text-slate-700 text-xs mt-0.5 truncate">
                  {getDepartmentName(patientInfo?.department_code) || invoice?.poli_name || "Poli Rawat Jalan"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Penjamin</p>
                <p className="font-bold text-teal-800 text-xs mt-0.5">
                  {patientInfo?.status_pasien || "Umum (Pribadi)"}
                </p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="p-0 overflow-x-auto custom-scrollbar flex-1 flex flex-col min-h-[320px]">
              <Table className="w-full">
                <TableHeader className="bg-slate-50/60 border-b border-slate-100">
                  <TableRow>
                    <TableHead className="w-[50px] text-center text-[11px] font-bold text-slate-500 py-3">No</TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Uraian Pelayanan / Tindakan
                    </TableHead>
                    <TableHead className="w-[110px] text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Kategori
                    </TableHead>
                    <TableHead className="w-[140px] text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">
                      Tarif (Rp)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-16 text-center text-slate-400 text-xs">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
                          <span>Memuat tarif pelayanan...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : invoice?.items && invoice.items.length > 0 ? (
                    invoice.items.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/60 border-b border-slate-100 text-xs">
                        <TableCell className="text-center text-slate-400 font-mono py-3">{idx + 1}</TableCell>
                        <TableCell className="font-semibold text-slate-800 py-3">{item.description}</TableCell>
                        <TableCell className="text-center py-3">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded border uppercase",
                            item.item_type === "ACTION" || item.category === "ACTION"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : item.item_type === "MEDICINE" || item.category === "MEDICINE"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {item.item_type === "ACTION" ? "Tindakan" : item.item_type === "MEDICINE" ? "Farmasi" : "Pemeriksaan"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900 py-3 px-4">
                          {formatRupiah(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="text-center text-slate-400 font-mono py-3">1</TableCell>
                      <TableCell className="font-semibold text-slate-800 py-3">
                        Pemeriksaan Dokter Umum (Poli Umum)
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 uppercase">
                          Tindakan
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900 py-3 px-4">
                        {formatRupiah(50000)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Total Footer Banner */}
            {isCancelled ? (
              <div className="mt-auto p-5 border-t-2 border-rose-200 bg-rose-50/70 rounded-b-2xl shrink-0 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Status Tagihan: Dibatalkan</p>
                  <p className="text-[11px] text-rose-600 mt-0.5">Tagihan dibatalkan (Tidak ada kewajiban pembayaran kasir)</p>
                </div>
                <div className="text-right">
                  <span className="text-xs line-through text-slate-400 block font-medium font-mono">{formatRupiah(totalAmount)}</span>
                  <span className="text-2xl font-black text-rose-700 tracking-tight">Rp 0 (Batal)</span>
                </div>
              </div>
            ) : (
              <div className="mt-auto p-5 border-t-2 border-slate-200 bg-amber-50/50 rounded-b-2xl shrink-0 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Tagihan Bersih</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sudah termasuk biaya layanan poli & dokter</p>
                </div>
                <p className="text-2xl font-black text-amber-700 tracking-tight">
                  {formatRupiah(totalAmount)}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Terminal POS Kasir OR Paid State OR Cancelled State (5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          {isCancelled ? (
            /* CANCELLED CARD */
            <Card className="card-premium overflow-hidden flex flex-col h-full border-2 border-rose-300">
              <CardHeader className="bg-rose-50/80 border-b border-rose-100 p-6 text-center shrink-0">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner mb-2 border border-rose-200">
                  <Ban className="h-8 w-8" />
                </div>
                <CardTitle className="text-lg font-black text-rose-950">
                  Kunjungan Dibatalkan
                </CardTitle>
                <CardDescription className="text-xs text-rose-700 font-mono mt-0.5">
                  Encounter: #{encounterNo}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 text-rose-800 space-y-2 text-xs">
                  <p className="font-bold text-rose-900 text-sm">Pembayaran Tidak Tersedia</p>
                  <p className="text-rose-700 leading-relaxed">
                    Pendaftaran kunjungan pasien ini telah dibatalkan di loket pendaftaran. Seluruh tagihan pelayanan ini telah dibatalkan secara administratif dan tidak dapat diproses pembayarannya.
                  </p>
                </div>

                <div className="space-y-2.5 pt-4">
                  <Button
                    onClick={() => navigate("/kasir/antrean")}
                    className="w-full h-11 bg-slate-900 hover:bg-black text-white font-bold rounded-xl gap-2 shadow-sm text-xs cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4 text-amber-400" />
                    <span>Kembali ke Antrean Kasir</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isPaid ? (
            /* PAID RECEIPT CARD */
            <Card className="card-premium overflow-hidden flex flex-col h-full border-2 border-emerald-400">
              <CardHeader className="bg-emerald-50/80 border-b border-emerald-100 p-6 text-center shrink-0">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner mb-2 border border-emerald-200">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <CardTitle className="text-lg font-black text-emerald-950">
                  Transaksi Telah Lunas
                </CardTitle>
                <CardDescription className="text-xs text-emerald-700 font-mono mt-0.5">
                  No. Kwitansi: #{invoice?.invoice_id || `KW-${encounterNo}`}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Metode Pembayaran:</span>
                    <strong className="text-slate-900">{paidReceipt?.paymentMethod || "Tunai (Cash)"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Tagihan:</span>
                    <strong className="text-slate-900">{formatRupiah(totalAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Uang Diterima:</span>
                    <strong className="text-slate-900">{formatRupiah(paidReceipt?.amountPaid || totalAmount)}</strong>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-emerald-800">
                    <span>Uang Kembalian:</span>
                    <span>{formatRupiah(paidReceipt?.change || 0)}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-[11px] leading-tight">
                    Pasien otomatis diteruskan ke antrean dokter Poliklinik secara realtime.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <Button
                    onClick={handlePrint}
                    className="w-full h-11 bg-slate-900 hover:bg-black text-white font-bold rounded-xl gap-2 shadow-sm text-xs"
                  >
                    <Printer className="h-4 w-4 text-amber-400" />
                    <span>Cetak Kwitansi / Struk Kasir</span>
                  </Button>

                  <Button
                    onClick={() => navigate("/kasir/riwayat-pembayaran")}
                    variant="outline"
                    className="w-full h-10 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs"
                  >
                    Buka Riwayat Pembayaran
                  </Button>

                  <Button
                    onClick={() => navigate("/kasir/antrean")}
                    variant="ghost"
                    className="w-full h-9 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                  >
                    Kembali ke Antrean Tagihan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* POS PAYMENT EXECUTION FORM */
            <Card className="card-premium overflow-hidden flex flex-col h-full">
              <CardHeader className="bg-slate-900 text-white p-5 shrink-0 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-white">Terminal Pembayaran</CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">Loket Kasir POS SIMRS</CardDescription>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-400/30">
                  LOKET #1
                </span>
              </CardHeader>

              <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-5">
                {/* 1. Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    1. Pilih Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                      const Icon = method.icon;
                      const isSelected = paymentMethod === method.value;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setPaymentMethod(method.value)}
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer",
                            isSelected
                              ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs font-bold ring-1 ring-amber-400"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-medium"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-amber-600" : "text-slate-400")} />
                          <span className="text-xs truncate">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Amount Input & Quick Buttons */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    2. Nominal Uang Diterima (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      Rp
                    </span>
                    <Input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="0"
                      className="pl-12 h-12 text-lg font-black text-slate-900 border-slate-200 rounded-xl focus-visible:ring-amber-500 shadow-2xs"
                    />
                  </div>

                  {paymentMethod === "TUNAI" && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[totalAmount, 50000, 100000, 200000, 500000].map((val, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setQuickCash(val)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          {i === 0 ? "Uang Pas" : formatRupiah(val)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Realtime Change Indicator */}
                {paymentMethod === "TUNAI" && (
                  <div
                    className={cn(
                      "p-4 rounded-xl border flex items-center justify-between transition-all",
                      change >= 0
                        ? "bg-emerald-50/90 border-emerald-200 text-emerald-950"
                        : "bg-rose-50/90 border-rose-200 text-rose-950"
                    )}
                  >
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider">
                        {change >= 0 ? "Uang Kembalian" : "Kurang Bayar"}
                      </p>
                      <p className="text-xl font-black font-mono mt-0.5">
                        {formatRupiah(Math.abs(change))}
                      </p>
                    </div>
                    {change >= 0 && (
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
                        Kembalian Pas / Cukup
                      </span>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3.5 text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {/* Submit Payment Button */}
                <div className="pt-2">
                  <Button
                    onClick={handlePay}
                    disabled={paying || (paymentMethod === "TUNAI" && numAmountPaid < totalAmount)}
                    className="w-full h-12 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer gap-2"
                  >
                    {paying ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Memproses Transaksi Kasir...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        Selesaikan Pembayaran ({formatRupiah(totalAmount)})
                      </span>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
