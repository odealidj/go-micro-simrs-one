import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getBillingQueue, type BillingPatientQueueItem } from "../api/billingApi";
import {
  Wallet,
  Receipt,
  ChevronRight,
  RefreshCw,
  Clock,
  Search,
  ListFilter,
  User,
  Calendar,
  FileText,
  Hash,
  Building,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatGender(gender?: string) {
  if (!gender || gender === "-") return "-";
  const g = gender.toLowerCase();
  if (g.startsWith("l") || g === "male") return "Laki-laki (L)";
  if (g.startsWith("p") || g === "female" || g.startsWith("w")) return "Perempuan (P)";
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

function formatBirthDate(birthDateStr?: string) {
  if (!birthDateStr || birthDateStr === "-") return "-";
  try {
    const d = new Date(birthDateStr);
    if (isNaN(d.getTime())) return birthDateStr;
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return birthDateStr;
  }
}

function formatRegistrationTime(timeStr?: string) {
  if (!timeStr) return "";
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
  if (code === "08" || code.toLowerCase().includes("obgyn") || code.toLowerCase().includes("kandungan")) return "Poli Kandungan (Obgyn)";
  return `Poli ${code}`;
}

export function BillingQueuePage() {
  const [queue, setQueue] = useState<BillingPatientQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getBillingQueue();
      setQueue(data);
      setLastRefresh(new Date());
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
    return queue.filter((item) => item.status !== "WAITING_FOR_PAYMENT" && item.status !== "REGISTERED" && item.status !== "CANCELLED").length;
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

      return matchesSearch && matchesStatus;
    });
  }, [queue, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-bold text-slate-800">Antrean Tagihan Pasien</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Daftar seluruh pasien yang memiliki tagihan dan menunggu proses pembayaran kasir.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={cn("h-4 w-4 text-amber-600", loading && "animate-spin")} />
          Refresh Data
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari nama pasien, No. RM, No. Registrasi, atau Poli..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="UNPAID">Menunggu Pembayaran ({countUnpaid})</option>
              <option value="PAID">Lunas Hari Ini ({countPaid})</option>
              <option value="ALL">Semua Pasien ({queue.length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Queue Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-base">Daftar Tagihan Kasir</h2>
            {statusFilter === "UNPAID" && (
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Prioritas Bayar
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {filteredQueue.length} Pasien
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
              <span className="text-sm">Memuat daftar tagihan kasir...</span>
            </div>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Receipt className="h-10 w-10 opacity-30 text-amber-600" />
            <p className="text-base font-semibold text-slate-600">Tidak ada antrean tagihan</p>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? "Tidak ada pasien yang sesuai dengan kata kunci pencarian"
                : "Semua tagihan pasien saat ini telah diselesaikan."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQueue.map((item) => {
              const genderLabel = formatGender(item.gender);
              const ageStr = calculateAge(item.date_of_birth);
              const dobStr = formatBirthDate(item.date_of_birth);
              const regTimeFormatted = formatRegistrationTime(item.registered_time);
              const isMale = (item.gender || "").toLowerCase().startsWith("l");
              const isFemale = (item.gender || "").toLowerCase().startsWith("p");
              const isUnpaid = item.status === "WAITING_FOR_PAYMENT";

              return (
                <div
                  key={item.encounter_no}
                  className="flex flex-col lg:flex-row lg:items-center justify-between px-6 py-4 hover:bg-slate-50/80 transition-colors group gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center border shrink-0 mt-1 shadow-2xs",
                        isUnpaid
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      )}
                    >
                      <Receipt className="h-6 w-6" />
                    </div>

                    <div className="space-y-1.5">
                      {/* Line 1: Name, RM, No. Reg, Guarantor */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black text-slate-900 group-hover:text-amber-700 transition-colors tracking-tight">
                          {item.patient_name}
                        </span>

                        {/* RM Badge */}
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono shadow-2xs">
                          <FileText className="h-3.5 w-3.5 text-amber-400" />
                          RM: {item.mrn}
                        </span>

                        {/* No. Reg Badge */}
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 font-mono shadow-2xs">
                          <Hash className="h-3.5 w-3.5 text-amber-700" />
                          No. Reg: {item.encounter_no}
                        </span>

                        {/* Status Pasien / Guarantor */}
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-900 border border-teal-300">
                          {item.status_pasien}
                        </span>

                        {/* Target Poli */}
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <Building className="h-3 w-3 text-indigo-600" />
                          {getDepartmentName(item.department_code)}
                        </span>
                      </div>

                      {/* Line 2: Demographics & Time */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Gender */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border shadow-2xs",
                            isMale
                              ? "bg-blue-100 text-blue-950 border-blue-300"
                              : isFemale
                              ? "bg-pink-100 text-pink-950 border-pink-300"
                              : "bg-slate-100 text-slate-900 border-slate-300"
                          )}
                        >
                          <User className={cn("h-3.5 w-3.5", isMale ? "text-blue-700" : isFemale ? "text-pink-700" : "text-slate-700")} />
                          {genderLabel}
                        </span>

                        {/* Date of Birth & Age */}
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-100/90 text-emerald-950 border border-emerald-300 shadow-2xs">
                          <Calendar className="h-3.5 w-3.5 text-emerald-800" />
                          Tgl Lahir: {dobStr} {ageStr ? `(${ageStr})` : ""}
                        </span>

                        {/* Registration Time */}
                        {regTimeFormatted && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 border border-slate-300 shadow-2xs">
                            <Clock className="h-3.5 w-3.5 text-slate-700" />
                            Jam: {regTimeFormatted}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end lg:self-center shrink-0 mt-2 lg:mt-0">
                    {/* Status Badge */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-2xs",
                        isUnpaid
                          ? "bg-amber-100 text-amber-950 border border-amber-300"
                          : "bg-emerald-100 text-emerald-950 border border-emerald-300"
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", isUnpaid ? "bg-amber-500 animate-pulse" : "bg-emerald-600")} />
                      {isUnpaid ? "Menunggu Pembayaran" : "Lunas / Selesai"}
                    </span>

                    {/* Action Button */}
                    <Link
                      to={`/kasir/bayar/${item.encounter_no}`}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl transition-all shadow-xs shadow-amber-300"
                    >
                      {isUnpaid ? "Proses Bayar" : "Lihat Tagihan"} <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-xs font-medium text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            Terakhir diperbarui: <strong className="text-slate-800">{lastRefresh.toLocaleTimeString("id-ID")}</strong>
          </div>
          <div>
            Total terdaftar: <strong className="text-slate-900 font-bold">{queue.length}</strong> Pasien
          </div>
        </div>
      </div>
    </div>
  );
}
