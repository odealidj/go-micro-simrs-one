import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getTodayEncounters } from "../api/rawatJalanApi";
import type { EncounterDetail } from "../types";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { ModernConfirmModal } from "@/components/ui/ModernConfirmModal";
import {
  Stethoscope,
  ChevronRight,
  RefreshCw,
  Clock,
  Search,
  Activity,
  X,
  Users,
  User,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function getInitials(name?: string) {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatGender(gender?: string) {
  if (!gender || gender === "-") return "-";
  const g = gender.toLowerCase();
  if (g.startsWith("l") || g === "male") return "Laki-laki";
  if (g.startsWith("p") || g === "female" || g.startsWith("w")) return "Perempuan";
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
  if (!birthDateStr || birthDateStr === "-") return "";
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

interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

function getPelayananStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "WAITING_FOR_PAYMENT":
      return {
        label: "Belum Bayar",
        badgeClass: "bg-amber-50 text-amber-800 border border-amber-200/80",
        dotClass: "bg-amber-500 animate-pulse",
      };
    case "REGISTERED":
    case "QUEUED":
    case "QUEUED_FOR_POLI":
    case "WAITING_FOR_TRIAGE":
    case "WAITING_FOR_EXAM":
      return {
        label: "Siap Diperiksa",
        badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
        dotClass: "bg-emerald-500",
      };
    case "IN_PROGRESS":
      return {
        label: "Sedang Diperiksa",
        badgeClass: "bg-blue-50 text-blue-800 border border-blue-200/80",
        dotClass: "bg-blue-500 animate-pulse",
      };
    case "COMPLETED":
      return {
        label: "Selesai Pelayanan",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
        dotClass: "bg-slate-400",
      };
    case "CANCELLED":
      return {
        label: "Batal",
        badgeClass: "bg-rose-50 text-rose-800 border border-rose-200/80",
        dotClass: "bg-rose-500",
      };
    default:
      return {
        label: status,
        badgeClass: "bg-slate-50 text-slate-700 border border-slate-200",
        dotClass: "bg-slate-400",
      };
  }
}

export function PoliQueuePage() {
  const navigate = useNavigate();
  const { poliName, poliCode, role } = useAuth();
  const [encounters, setEncounters] = useState<EncounterDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentAlertPatient, setPaymentAlertPatient] = useState<EncounterDetail | null>(null);

  const poliLabel = poliName || (poliCode ? `Poli (${poliCode})` : "Poliklinik");

  const fetchEncounters = async () => {
    setLoading(true);
    try {
      const data = await getTodayEncounters(poliCode || "");
      setEncounters(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to load encounters", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [poliCode]);

  const countBelumBayar = useMemo(() => {
    return encounters.filter((e) => e.status === "WAITING_FOR_PAYMENT").length;
  }, [encounters]);

  const countSiapDiperiksa = useMemo(() => {
    return encounters.filter((e) =>
      ["REGISTERED", "QUEUED", "QUEUED_FOR_POLI", "WAITING_FOR_TRIAGE", "WAITING_FOR_EXAM"].includes(e.status)
    ).length;
  }, [encounters]);

  const countInProgress = useMemo(() => {
    return encounters.filter((e) => e.status === "IN_PROGRESS").length;
  }, [encounters]);

  const countCompleted = useMemo(() => {
    return encounters.filter((e) => e.status === "COMPLETED").length;
  }, [encounters]);

  const countBatal = useMemo(() => {
    return encounters.filter((e) => e.status === "CANCELLED" || e.status === "BATAL").length;
  }, [encounters]);

  const filteredEncounters = useMemo(() => {
    return encounters.filter((enc) => {
      const matchesSearch =
        !searchQuery ||
        (enc.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        enc.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        enc.encounter_no.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "SIAP" &&
          ["REGISTERED", "QUEUED", "QUEUED_FOR_POLI", "WAITING_FOR_TRIAGE", "WAITING_FOR_EXAM"].includes(enc.status)) ||
        (statusFilter === "BELUM_BAYAR" && enc.status === "WAITING_FOR_PAYMENT") ||
        (statusFilter === "IN_PROGRESS" && enc.status === "IN_PROGRESS") ||
        (statusFilter === "COMPLETED" && enc.status === "COMPLETED") ||
        (statusFilter === "BATAL" && (enc.status === "CANCELLED" || enc.status === "BATAL"));

      return matchesSearch && matchesStatus;
    });
  }, [encounters, searchQuery, statusFilter]);

  const getEncounterUrl = (encounterNo: string) => {
    if (role === "perawat") {
      return `/rawat-jalan/perawat/encounter/${encounterNo}`;
    }
    return `/rawat-jalan/dokter/encounter/${encounterNo}`;
  };

  const handleOpenEncounter = (enc: EncounterDetail) => {
    if (enc.status === "WAITING_FOR_PAYMENT") {
      setPaymentAlertPatient(enc);
      toast.warning(
        `Pasien ${enc.patient_name || enc.mrn} belum melunasi pembayaran di kasir!`,
        { duration: 4000 }
      );
      return;
    }
    navigate(getEncounterUrl(enc.encounter_no), { state: { encounter: enc } });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Antrean Pasien</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {poliLabel} —{" "}
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <button
          onClick={fetchEncounters}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-emerald-600", loading && "animate-spin")} />
          Refresh Antrean
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Modern Segmented Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap",
              statusFilter === "ALL"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Semua ({encounters.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("SIAP")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
              statusFilter === "SIAP"
                ? "bg-white text-emerald-800 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Siap Diperiksa ({countSiapDiperiksa})
          </button>

          {countBelumBayar > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("BELUM_BAYAR")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                statusFilter === "BELUM_BAYAR"
                  ? "bg-white text-amber-800 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Belum Bayar ({countBelumBayar})
            </button>
          )}

          <button
            type="button"
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
              statusFilter === "IN_PROGRESS"
                ? "bg-white text-blue-800 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Sedang Diperiksa ({countInProgress})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("COMPLETED")}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
              statusFilter === "COMPLETED"
                ? "bg-white text-slate-800 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Selesai ({countCompleted})
          </button>

          {countBatal > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("BATAL")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                statusFilter === "BATAL"
                  ? "bg-white text-rose-800 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Batal ({countBatal})
            </button>
          )}
        </div>

        {/* Quick Search Input */}
        <div className="relative md:w-80 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari pasien / RM / No. Reg..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9.5 bg-white border-slate-200 rounded-xl text-xs font-medium placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-emerald-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Antrean Pasien Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <h2 className="font-bold text-slate-800 text-sm">Daftar Antrean Pasien</h2>
            {statusFilter !== "ALL" && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                Filter Aktif
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200/80 shadow-2xs">
            {filteredEncounters.length} Pasien
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2.5 text-slate-400">
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
              <span className="text-xs font-medium">Memuat daftar antrean...</span>
            </div>
          </div>
        ) : filteredEncounters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2.5">
            <Activity className="h-8 w-8 opacity-25 text-emerald-600" />
            <p className="text-sm font-semibold text-slate-600">Tidak ada antrean pasien</p>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? "Tidak ada pasien yang cocok dengan pencarian."
                : "Belum ada pasien terdaftar pada kategori antrean ini."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEncounters.map((enc) => {
              const genderLabel = formatGender(enc.patient_gender);
              const ageStr = calculateAge(enc.patient_birthdate);
              const dobStr = formatBirthDate(enc.patient_birthdate);
              const regTimeFormatted = formatRegistrationTime(enc.registered_time);
              const statusConfig = getPelayananStatusConfig(enc.status);
              const isFemale = (enc.patient_gender || "").toLowerCase().startsWith("p") || (enc.patient_gender || "").toLowerCase() === "female";
              const isMale = (enc.patient_gender || "").toLowerCase().startsWith("l") || (enc.patient_gender || "").toLowerCase() === "male";

              return (
                <div
                  key={enc.encounter_no}
                  className="flex flex-col lg:flex-row lg:items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors group gap-3.5"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Patient Initials Avatar with soft gender-based pastel accent */}
                    <div
                      className={cn(
                        "h-11 w-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all border shadow-2xs mt-0.5 sm:mt-0",
                        isFemale
                          ? "bg-rose-50 text-rose-700 border-rose-200/90 group-hover:bg-rose-100/70"
                          : isMale
                          ? "bg-blue-50 text-blue-700 border-blue-200/90 group-hover:bg-blue-100/70"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200/90 group-hover:bg-emerald-100/70"
                      )}
                    >
                      {getInitials(enc.patient_name || enc.mrn)}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      {/* Row 1: Patient Name, Clear Gender Badge, Tanggal Lahir & Guarantor */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tight">
                          {enc.patient_name || enc.mrn}
                        </span>

                        {/* Jenis Kelamin Badge - Clear & Distinct */}
                        {isFemale ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80">
                            <User className="h-3 w-3 text-rose-500" />
                            Perempuan (P)
                          </span>
                        ) : isMale ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
                            <User className="h-3 w-3 text-blue-500" />
                            Laki-laki (L)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            <User className="h-3 w-3 text-slate-500" />
                            {genderLabel}
                          </span>
                        )}

                        {/* Tanggal Lahir & Usia - Clear & Distinct */}
                        {dobStr && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                            <Calendar className="h-3 w-3 text-emerald-600" />
                            <span>
                              Tgl Lahir: <strong className="font-semibold text-emerald-950">{dobStr}</strong>
                              {ageStr ? ` (${ageStr})` : ""}
                            </span>
                          </span>
                        )}

                        {enc.guarantor && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                            {enc.guarantor}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Identifiers & Timestamps with neat soft tags */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">No. RM:</span>
                          <span className="font-mono font-bold text-slate-900 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200">
                            {enc.mrn}
                          </span>
                        </span>

                        <span className="text-slate-300">•</span>

                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">No. Reg:</span>
                          <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                            {enc.encounter_no}
                          </span>
                        </span>

                        {regTimeFormatted && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 font-medium">
                              <Clock className="h-3 w-3 text-slate-400" />
                              Jam: {regTimeFormatted} WIB
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end lg:self-center shrink-0 mt-2 lg:mt-0">
                    {/* Status Pelayanan Badge */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs",
                        statusConfig.badgeClass
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dotClass)} />
                      {statusConfig.label}
                    </span>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEncounter(enc)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95",
                        enc.status === "WAITING_FOR_PAYMENT"
                          ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
                          : enc.status === "IN_PROGRESS"
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                          : enc.status === "CANCELLED" || enc.status === "BATAL"
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                      )}
                    >
                      Buka <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 text-xs font-medium text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Terakhir diperbarui: <strong className="text-slate-700 font-semibold">{lastRefresh.toLocaleTimeString("id-ID")}</strong>
          </div>
          <div>
            Total terdaftar: <strong className="text-slate-800 font-semibold">{encounters.length}</strong> Pasien
          </div>
        </div>
      </div>

      {/* Modal Peringatan Pembayaran Kasir */}
      <ModernConfirmModal
        isOpen={!!paymentAlertPatient}
        onClose={() => setPaymentAlertPatient(null)}
        onConfirm={() => setPaymentAlertPatient(null)}
        title="Pasien Belum Melunasi Pembayaran Kasir"
        description={
          <span>
            Pasien{" "}
            <strong className="text-slate-900 font-bold">
              {paymentAlertPatient?.patient_name || paymentAlertPatient?.mrn}
            </strong>{" "}
            masih berstatus <strong>Belum Bayar</strong>. Silakan arahkan pasien atau keluarga untuk melunasi tagihan pendaftaran di loket kasir terlebih dahulu sebelum pemeriksaan dibuka.
          </span>
        }
        confirmText="Tutup / Mengerti"
        cancelText="Batal"
        variant="warning"
        itemDetails={[
          {
            label: "Nama Pasien",
            value: paymentAlertPatient?.patient_name || "-",
          },
          {
            label: "No. Rekam Medis",
            value: (
              <span className="font-mono font-bold text-slate-900">
                {paymentAlertPatient?.mrn || "-"}
              </span>
            ),
          },
          {
            label: "No. Registrasi",
            value: (
              <span className="font-mono font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                {paymentAlertPatient?.encounter_no || "-"}
              </span>
            ),
          },
          {
            label: "Status Pasien",
            value: (
              <span className="font-bold text-amber-950 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs">
                Belum Bayar
              </span>
            ),
          },
        ]}
        note="Pemeriksaan dokter dan entri rekam medis baru dapat dimulai setelah tagihan pendaftaran pasien diselesaikan oleh kasir."
      />
    </div>
  );
}
