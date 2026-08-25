import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
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
  Sparkles,
  User,
  Building,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  { value: "TUNAI", label: "Tunai (Cash)", icon: Banknote, desc: "Pembayaran langsung uang tunai" },
  { value: "QRIS", label: "QRIS / Transfer", icon: QrCode, desc: "Scan QRIS / Virtual Account" },
  { value: "DEBIT", label: "Kartu Debit", icon: CreditCard, desc: "Mesin EDC Debit Bank" },
  { value: "KREDIT", label: "Kartu Kredit", icon: CreditCard, desc: "Visa / Mastercard / JCB" },
  { value: "BPJS", label: "BPJS / JKN", icon: Building2, desc: "Klaim penjaminan BPJS" },
];

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
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

export function PaymentPage() {
  const { encounterNo: paramEncounterNo } = useParams<{ encounterNo?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const encounterNo = paramEncounterNo || searchParams.get("no") || searchParams.get("encounter_no") || "";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [patientInfo, setPatientInfo] = useState<BillingPatientQueueItem | null>(null);
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

  useEffect(() => {
    if (!encounterNo) return;
    const fetchInvoiceData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch patient info from registrations queue to get name, MRN, guarantor
        const queueList = await getBillingQueue();
        const found = queueList.find((p) => p.encounter_no === encounterNo);
        if (found) {
          setPatientInfo(found);
        }

        const data = await getInvoice(encounterNo);
        if (data) {
          // If items description is raw like "Biaya Pendaftaran - 03", format it nicely
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
          // Fallback default invoice for registration & examination fee
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

  // Tagihan dianggap sudah lunas jika:
  // 1. Baru saja dibayar di session ini (paidReceipt != null)
  // 2. Status invoice dari backend == "PAID"
  // 3. Status encounter pasien di registrasi != "WAITING_FOR_PAYMENT" && != "REGISTERED"
  const isPaid =
    Boolean(paidReceipt) ||
    invoice?.status === "PAID" ||
    (Boolean(patientInfo) &&
      patientInfo?.status !== "WAITING_FOR_PAYMENT" &&
      patientInfo?.status !== "REGISTERED" &&
      patientInfo?.status !== "CANCELLED");

  const totalAmount = invoice?.total_amount || 0;
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

      setPaidReceipt({
        invoiceId: invoice.invoice_id,
        totalAmount: totalAmount,
        amountPaid: paymentMethod === "TUNAI" ? numAmountPaid : totalAmount,
        change: Math.max(0, change),
        paymentMethod: paymentMethod,
        paidAt: new Date(),
      });

      // Update state invoice status to PAID
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

  if (!encounterNo) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="p-4 bg-amber-50 text-amber-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <Receipt className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Pilih Pasien dari Antrean Tagihan</h2>
        <p className="text-slate-500 text-sm">
          Silakan buka menu <strong>Antrean Tagihan Pasien</strong> untuk memilih pasien yang akan diproses pembayarannya.
        </p>
        <Link
          to="/kasir/antrean"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Buka Antrean Tagihan Pasien
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header with Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/kasir/antrean")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-sm font-bold shadow-2xs transition-all group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-amber-600 group-hover:-translate-x-1 transition-transform" />
          <span>Kembali ke Antrean Tagihan</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
            <Wallet className="h-3.5 w-3.5 text-amber-600" />
            Kasir & Pembayaran SIMRS
          </span>
        </div>
      </div>

      {/* Main Grid: Left (Invoice Breakdown), Right (POS Payment Terminal / Receipt) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Itemized Invoice Breakdown */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header Strip */}
            <div className="p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-amber-600" />
                    <h2 className="text-lg font-black text-slate-900">Rincian Tagihan & Tarif Pasien</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                    <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                      #{invoice?.invoice_id || `INV-${encounterNo}`}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-slate-700">Encounter: {encounterNo}</span>
                  </div>
                </div>

                <span
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs",
                    isPaid
                      ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                      : "bg-amber-100 text-amber-950 border-amber-300"
                  )}
                >
                  {isPaid ? "✓ LUNAS (PAID)" : "BELUM LUNAS"}
                </span>
              </div>
            </div>

            {/* Quick Demographics info */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                  <User className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Pasien & No. RM</p>
                  <p className="font-bold text-slate-900 text-sm">
                    {patientInfo?.patient_name || invoice?.patient_name || "Pasien SIMRS"}
                  </p>
                  <p className="font-mono text-slate-700 font-bold">
                    RM: {patientInfo?.mrn || invoice?.mrn || "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Asal Layanan & Penjamin</p>
                  <p className="font-bold text-slate-900">
                    {getDepartmentName(patientInfo?.department_code) || invoice?.poli_name || "Poliklinik Rawat Jalan"}
                  </p>
                  <p className="text-slate-600 font-medium">
                    Penjamin: <strong className="text-teal-800">{patientInfo?.status_pasien || "Umum"}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Daftar Biaya & Tindakan Pelayanan
              </h3>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
                  <span className="text-sm">Memuat rincian tarif...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-500 uppercase">
                        <th className="py-2.5">No</th>
                        <th className="py-2.5">Uraian / Tindakan / Obat</th>
                        <th className="py-2.5 text-center">Kategori</th>
                        <th className="py-2.5 text-right">Tarif (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoice?.items && invoice.items.length > 0 ? (
                        invoice.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                            <td className="py-3 font-semibold text-slate-800">{item.description}</td>
                            <td className="py-3 text-center">
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase",
                                  item.item_type === "ACTION" || item.category === "ACTION"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : item.item_type === "MEDICINE" || item.category === "MEDICINE"
                                    ? "bg-violet-50 text-violet-700 border-violet-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                )}
                              >
                                {item.item_type === "ACTION"
                                  ? "Tindakan"
                                  : item.item_type === "MEDICINE"
                                  ? "Farmasi"
                                  : "Pemeriksaan"}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-slate-900">
                              {formatRupiah(item.amount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                            Belum ada rincian item tagihan tercatat.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300">
                        <td colSpan={3} className="py-4 text-right font-black text-slate-900 text-base">
                          Total Tagihan Bersih:
                        </td>
                        <td className="py-4 text-right font-mono font-black text-amber-700 text-xl">
                          {formatRupiah(totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Payment POS Terminal OR Paid Receipt Card */}
        <div className="lg:col-span-5 space-y-5">
          {isPaid ? (
            /* PAID RECEIPT CARD - When already paid, form is replaced with Official Receipt & Print */
            <div className="bg-white rounded-2xl border-2 border-emerald-400 shadow-md p-6 space-y-6 animate-in fade-in zoom-in-95">
              <div className="text-center space-y-2 pb-4 border-b border-slate-100">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Tagihan Sudah Lunas</h3>
                <p className="text-xs text-slate-500 font-mono">
                  No. Kwitansi: #{invoice?.invoice_id || `KW-${encounterNo}`}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold mt-1">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Status: Lunas & Terverifikasi Kasir
                </div>
              </div>

              {/* Printable Receipt Summary Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Bayar:</span>
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
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-bold text-emerald-800">Kembalian:</span>
                  <strong className="font-bold text-emerald-800">
                    {formatRupiah(paidReceipt?.change || 0)}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <Button
                  onClick={handlePrint}
                  className="w-full h-11 bg-slate-900 hover:bg-black text-white font-bold rounded-xl gap-2 shadow-sm cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Cetak Kwitansi / Struk Resmi
                </Button>

                <Button
                  onClick={() => navigate("/kasir/riwayat-pembayaran")}
                  variant="outline"
                  className="w-full h-11 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl cursor-pointer"
                >
                  Lihat di Riwayat Pembayaran
                </Button>

                <Button
                  onClick={() => navigate("/kasir/antrean")}
                  variant="ghost"
                  className="w-full h-9 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Kembali ke Antrean Kasir
                </Button>
              </div>
            </div>
          ) : (
            /* PAYMENT EXECUTION FORM - Only shown when status is UNPAID */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-amber-400" />
                  <h3 className="font-extrabold text-base">Terminal Pembayaran Kasir</h3>
                </div>
                <span className="text-xs font-mono font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
                  POS SIMRS
                </span>
              </div>

              <div className="p-6 space-y-5">
                {/* Method selector */}
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">
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
                              ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs font-bold"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-medium"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-amber-600" : "text-slate-400")} />
                          <span className="text-xs">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount Paid Input */}
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">
                    2. Nominal Uang Diterima (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      Rp
                    </span>
                    <Input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="0"
                      className="pl-11 h-12 text-lg font-black text-slate-900 border-slate-200 rounded-xl"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  {paymentMethod === "TUNAI" && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {[totalAmount, 25000, 50000, 100000, 200000].map((val, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setQuickCash(val)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          {i === 0 ? "Uang Pas" : formatRupiah(val)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Real-time Change Indicator */}
                {paymentMethod === "TUNAI" && (
                  <div
                    className={cn(
                      "p-4 rounded-xl border flex items-center justify-between transition-all",
                      change >= 0
                        ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                        : "bg-red-50 border-red-200 text-red-950"
                    )}
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">
                        {change >= 0 ? "Uang Kembalian" : "Kurang Bayar"}
                      </p>
                      <p className="text-lg font-black font-mono">
                        {formatRupiah(Math.abs(change))}
                      </p>
                    </div>
                    {change >= 0 && (
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
                        Pas / Lebih
                      </span>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {/* Submit Payment Button */}
                <Button
                  onClick={handlePay}
                  disabled={paying || (paymentMethod === "TUNAI" && numAmountPaid < totalAmount)}
                  className="w-full h-12 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-xs shadow-amber-300 disabled:opacity-50 cursor-pointer"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
