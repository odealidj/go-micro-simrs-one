import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getTodayEncounters } from "../api/rawatJalanApi";
import type { EncounterDetail } from "../types";
import { useAuth } from "@/lib/AuthContext";
import {
  Stethoscope,
  ChevronRight,
  RefreshCw,
  Clock,
  Search,
  Activity,
  ListFilter,
  User,
  Calendar,
  FileText,
  Hash,
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

interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

function getPelayananStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "WAITING_FOR_PAYMENT":
      return {
        label: "Belum Bayar Kasir",
        badgeClass: "bg-amber-100 text-amber-950 border border-amber-300",
        dotClass: "bg-amber-500 animate-pulse",
      };
    case "REGISTERED":
    case "QUEUED":
    case "QUEUED_FOR_POLI":
    case "WAITING_FOR_TRIAGE":
    case "WAITING_FOR_EXAM":
      return {
        label: "Siap Diperiksa Dokter",
        badgeClass: "bg-teal-100 text-teal-950 border border-teal-300",
        dotClass: "bg-teal-600",
      };
    case "IN_PROGRESS":
      return {
        label: "Sedang Diperiksa",
        badgeClass: "bg-blue-100 text-blue-950 border border-blue-300",
        dotClass: "bg-blue-600 animate-pulse",
      };
    case "COMPLETED":
      return {
        label: "Selesai Pelayanan",
        badgeClass: "bg-emerald-100 text-emerald-950 border border-emerald-300",
        dotClass: "bg-emerald-600",
      };
    case "CANCELLED":
      return {
        label: "Batal / Cancel",
        badgeClass: "bg-rose-100 text-rose-950 border border-rose-300",
        dotClass: "bg-rose-600",
      };
    default:
      return {
        label: status,
        badgeClass: "bg-slate-100 text-slate-800 border border-slate-300",
        dotClass: "bg-slate-500",
      };
  }
}

export function PoliQueuePage() {
  const { poliName, poliCode, role } = useAuth();
  const [encounters, setEncounters] = useState<EncounterDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

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

  const countWaiting = useMemo(() => {
    return encounters.filter((e) =>
      ["REGISTERED", "QUEUED", "QUEUED_FOR_POLI", "WAITING_FOR_TRIAGE", "WAITING_FOR_PAYMENT"].includes(e.status)
    ).length;
  }, [encounters]);

  const countInProgress = useMemo(() => {
    return encounters.filter((e) => e.status === "IN_PROGRESS").length;
  }, [encounters]);

  const countCompleted = useMemo(() => {
    return encounters.filter((e) => e.status === "COMPLETED").length;
  }, [encounters]);

  const countCancelled = useMemo(() => {
    return encounters.filter((e) => e.status === "CANCELLED").length;
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
        (statusFilter === "WAITING" &&
          ["REGISTERED", "QUEUED", "QUEUED_FOR_POLI", "WAITING_FOR_TRIAGE", "WAITING_FOR_PAYMENT"].includes(enc.status)) ||
        (statusFilter === "IN_PROGRESS" && enc.status === "IN_PROGRESS") ||
        (statusFilter === "COMPLETED" && enc.status === "COMPLETED") ||
        (statusFilter === "CANCELLED" && enc.status === "CANCELLED");

      return matchesSearch && matchesStatus;
    });
  }, [encounters, searchQuery, statusFilter]);

  const getEncounterUrl = (encounterNo: string) => {
    if (role === "perawat") {
      return `/perawat/encounter/${encounterNo}`;
    }
    return `/dokter/encounter/${encounterNo}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="h-5 w-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-800">Antrean Pasien</h1>
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4 text-emerald-600", loading && "animate-spin")} />
          Refresh Antrean
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari nama pasien, No. RM, atau No. Registrasi..."
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
              className="h-11 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">Semua Status ({encounters.length})</option>
              <option value="WAITING">Siap Diperiksa ({countWaiting})</option>
              <option value="IN_PROGRESS">Sedang Diperiksa ({countInProgress})</option>
              <option value="COMPLETED">Selesai ({countCompleted})</option>
              {countCancelled > 0 && <option value="CANCELLED">Batal ({countCancelled})</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Main Antrean Pasien Hari Ini Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-base">Antrean Pasien Hari Ini</h2>
            {statusFilter !== "ALL" && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                Filter Aktif
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {filteredEncounters.length} Pasien
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
              <span className="text-sm">Memuat daftar antrean...</span>
            </div>
          </div>
        ) : filteredEncounters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Activity className="h-10 w-10 opacity-30 text-emerald-600" />
            <p className="text-base font-semibold text-slate-600">Tidak ada antrean pasien</p>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? "Tidak ada pasien yang sesuai dengan kata kunci pencarian"
                : "Belum ada antrean pasien dengan status ini di poli hari ini"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEncounters.map((enc) => {
              const genderLabel = formatGender(enc.patient_gender);
              const ageStr = calculateAge(enc.patient_birthdate);
              const dobStr = formatBirthDate(enc.patient_birthdate);
              const regTimeFormatted = formatRegistrationTime(enc.registered_time);
              const isMale = (enc.patient_gender || "").toLowerCase().startsWith("l");
              const isFemale = (enc.patient_gender || "").toLowerCase().startsWith("p");
              const statusConfig = getPelayananStatusConfig(enc.status);

              return (
                <div
                  key={enc.encounter_no}
                  className="flex flex-col lg:flex-row lg:items-center justify-between px-6 py-4 hover:bg-slate-50/80 transition-colors group gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center border shrink-0 mt-1 shadow-2xs",
                        isMale
                          ? "bg-blue-100 text-blue-800 border-blue-300"
                          : isFemale
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      )}
                    >
                      <Stethoscope className="h-6 w-6" />
                    </div>

                    <div className="space-y-1.5">
                      {/* Line 1: Patient Name, MRN badge, and Status Pasien */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tight">
                          {enc.patient_name || enc.mrn}
                        </span>

                        {/* High-contrast RM Badge */}
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono shadow-2xs">
                          <FileText className="h-3.5 w-3.5 text-emerald-400" />
                          RM: {enc.mrn}
                        </span>

                        {/* High-contrast No. Registrasi Badge */}
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 font-mono shadow-2xs">
                          <Hash className="h-3.5 w-3.5 text-amber-700" />
                          No. Reg: {enc.encounter_no}
                        </span>

                        {enc.guarantor && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-900 border border-teal-300">
                            {enc.guarantor}
                          </span>
                        )}
                      </div>

                      {/* Line 2: Prominent Demographics Badges (Gender, DOB, Age, Reg Time) */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Gender Pill - Bold & Clear */}
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

                        {/* Date of Birth & Age Pill - Bold & Clear */}
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
                    {/* Status Pelayanan Poliklinik Badge with dot indicator */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-2xs",
                        statusConfig.badgeClass
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", statusConfig.dotClass)} />
                      {statusConfig.label}
                    </span>

                    <Link
                      to={getEncounterUrl(enc.encounter_no)}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl transition-all shadow-xs shadow-emerald-300"
                    >
                      Buka <ChevronRight className="h-4 w-4" />
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
            Total terdaftar: <strong className="text-slate-900 font-bold">{encounters.length}</strong> Pasien
          </div>
        </div>
      </div>
    </div>
  );
}
