import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMasterData } from "@/hooks/useMasterData";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ModernConfirmModal } from "@/components/ui/ModernConfirmModal";
import {
  CalendarDays,
  Clock,
  Stethoscope,
  UserRound,
  Save,
  RotateCcw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  Building2,
  ArrowLeft,
} from "lucide-react";

interface ScheduleSlotState {
  day_of_week: number;
  dokter_id: string;
  perawat_id: string;
}

const WORK_DAYS = [
  { id: 1, label: "Senin", short: "Sen" },
  { id: 2, label: "Selasa", short: "Sel" },
  { id: 3, label: "Rabu", short: "Rab" },
  { id: 4, label: "Kamis", short: "Kam" },
  { id: 5, label: "Jumat", short: "Jum" },
];

export function JadwalPoliklinikPage() {
  const [selectedPoli, setSelectedPoli] = useState<string>("");
  const [slots, setSlots] = useState<Record<number, ScheduleSlotState>>({
    1: { day_of_week: 1, dokter_id: "", perawat_id: "" },
    2: { day_of_week: 2, dokter_id: "", perawat_id: "" },
    3: { day_of_week: 3, dokter_id: "", perawat_id: "" },
    4: { day_of_week: 4, dokter_id: "", perawat_id: "" },
    5: { day_of_week: 5, dokter_id: "", perawat_id: "" },
  });

  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const { data: polyclinics } = useMasterData<any>("/master/polyclinics");
  const { data: allDoctors } = useMasterData<any>("/master/doctors?page_size=100");
  const { data: allNurses } = useMasterData<any>("/master/nurses?page_size=100");

  const currentPoli = polyclinics?.find((p: any) => p.code === selectedPoli);

  // Default to first polyclinic if available and none selected
  useEffect(() => {
    if (!selectedPoli && polyclinics && polyclinics.length > 0) {
      setSelectedPoli(polyclinics[0].code);
    }
  }, [polyclinics, selectedPoli]);

  // Load polyclinic schedule when selectedPoli changes
  const loadPoliSchedule = (poliCode: string) => {
    if (!poliCode) return;
    setIsLoadingSchedule(true);
    setErrorMsg("");
    setSuccessMsg("");

    api
      .get(`/master/polyclinics/${poliCode}/schedule`)
      .then((res) => {
        const doctors = res.data?.data?.doctors || [];
        const nurses = res.data?.data?.nurses || [];

        const newSlots: Record<number, ScheduleSlotState> = {
          1: { day_of_week: 1, dokter_id: "", perawat_id: "" },
          2: { day_of_week: 2, dokter_id: "", perawat_id: "" },
          3: { day_of_week: 3, dokter_id: "", perawat_id: "" },
          4: { day_of_week: 4, dokter_id: "", perawat_id: "" },
          5: { day_of_week: 5, dokter_id: "", perawat_id: "" },
        };

        // Map doctors to days
        doctors.forEach((d: any) => {
          if (Array.isArray(d.days_of_week)) {
            d.days_of_week.forEach((day: number) => {
              if (newSlots[day]) {
                newSlots[day].dokter_id = d.id;
              }
            });
          }
        });

        // Map nurses to days
        nurses.forEach((n: any) => {
          if (Array.isArray(n.days_of_week)) {
            n.days_of_week.forEach((day: number) => {
              if (newSlots[day]) {
                newSlots[day].perawat_id = n.id;
              }
            });
          }
        });

        setSlots(newSlots);
      })
      .catch((e: any) => {
        setErrorMsg(e.response?.data?.message || "Gagal memuat jadwal poliklinik");
      })
      .finally(() => {
        setIsLoadingSchedule(false);
      });
  };

  useEffect(() => {
    if (selectedPoli) {
      loadPoliSchedule(selectedPoli);
    }
  }, [selectedPoli]);

  const handleDoctorChange = (day: number, dokterId: string) => {
    setSlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], dokter_id: dokterId },
    }));
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleNurseChange = (day: number, perawatId: string) => {
    setSlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], perawat_id: perawatId },
    }));
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleClearDay = (day: number) => {
    setSlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], dokter_id: "", perawat_id: "" },
    }));
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleClearAll = () => {
    setShowClearAllConfirm(true);
  };

  const handleConfirmClearAll = () => {
    const emptySlots: Record<number, ScheduleSlotState> = {
      1: { day_of_week: 1, dokter_id: "", perawat_id: "" },
      2: { day_of_week: 2, dokter_id: "", perawat_id: "" },
      3: { day_of_week: 3, dokter_id: "", perawat_id: "" },
      4: { day_of_week: 4, dokter_id: "", perawat_id: "" },
      5: { day_of_week: 5, dokter_id: "", perawat_id: "" },
    };
    setSlots(emptySlots);
    setErrorMsg("");
    setSuccessMsg("");
    setShowClearAllConfirm(false);
  };

  const handleSaveSchedule = async () => {
    if (!selectedPoli) {
      setErrorMsg("Pilih poliklinik terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const payloadSlots = Object.values(slots).map((s) => ({
      day_of_week: s.day_of_week,
      dokter_id: s.dokter_id || "",
      perawat_id: s.perawat_id || "",
    }));

    try {
      await api.put(`/master/polyclinics/${selectedPoli}/schedule`, {
        slots: payloadSlots,
      });
      setSuccessMsg("Jadwal mingguan poliklinik berhasil disimpan secara terpadu!");
      loadPoliSchedule(selectedPoli);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.message || "Terjadi kesalahan saat menyimpan jadwal.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/admin/master/assign-dokter" className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Assign Dokter
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-blue-600" />
            Matriks Jadwal Mingguan Poliklinik
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Atur dan tukar penugasan dokter dan perawat jaga per hari kerja (Senin s.d. Jumat, 1 Shift 08:00 – 16:00 WIB) bebas bentrok.
          </p>
        </div>

        {/* Global Save & Reset Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPoliSchedule(selectedPoli)}
            disabled={isLoadingSchedule || isSaving}
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={isLoadingSchedule || isSaving}
            className="text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Kosongkan Semua
          </Button>
          <Button
            size="sm"
            onClick={handleSaveSchedule}
            disabled={isLoadingSchedule || isSaving || !selectedPoli}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Menyimpan..." : "Simpan Perubahan Jadwal"}
          </Button>
        </div>
      </div>

      {/* Selector Poliklinik */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 sm:flex-initial">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Pilih Poliklinik
            </label>
            <select
              value={selectedPoli}
              onChange={(e) => setSelectedPoli(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all min-w-[260px]"
            >
              {polyclinics?.map((p: any) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operational Status Info */}
        <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-slate-600">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>Jam Pelayanan: <strong>08:00 – 16:00 WIB</strong> (1 Shift Penuh, Senin – Jumat)</span>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-800 rounded-xl text-sm border border-red-200 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-red-900">Perhatian / Gagal Menyimpan:</h5>
            <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-200 flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Schedule Grid Matrix (5 Days: Senin - Jumat) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {WORK_DAYS.map((day) => {
          const slot = slots[day.id] || { day_of_week: day.id, dokter_id: "", perawat_id: "" };
          const doc = allDoctors?.find((d: any) => d.id === slot.dokter_id);
          const nurse = allNurses?.find((n: any) => n.id === slot.perawat_id);

          return (
            <div
              key={day.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden hover:border-blue-300 transition-colors"
            >
              {/* Card Header */}
              <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {day.id}
                  </span>
                  <span className="font-bold text-slate-800 text-sm">{day.label}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                  08:00 - 16:00
                </span>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 space-y-4 text-xs">
                {/* Dokter Jaga */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> Dokter Jaga
                  </label>
                  <select
                    value={slot.dokter_id}
                    onChange={(e) => handleDoctorChange(day.id, e.target.value)}
                    className={`w-full border rounded-lg px-2.5 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 transition-all ${
                      slot.dokter_id
                        ? "bg-blue-50/40 border-blue-300 text-blue-900 font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    <option value="">-- Kosong (Tidak Ada) --</option>
                    {allDoctors?.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.username} {d.spesialisasi ? `(${d.spesialisasi})` : ""}
                      </option>
                    ))}
                  </select>
                  {doc && (
                    <div className="text-[10px] text-slate-500 flex items-center justify-between px-1">
                      <span>SIP: {doc.sip || "-"}</span>
                      {doc.spesialisasi && <span className="font-medium text-blue-700">{doc.spesialisasi}</span>}
                    </div>
                  )}
                </div>

                {/* Perawat Jaga */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    <UserRound className="w-3.5 h-3.5 text-emerald-600" /> Perawat Jaga
                  </label>
                  <select
                    value={slot.perawat_id}
                    onChange={(e) => handleNurseChange(day.id, e.target.value)}
                    className={`w-full border rounded-lg px-2.5 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                      slot.perawat_id
                        ? "bg-emerald-50/40 border-emerald-300 text-emerald-900 font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    <option value="">-- Kosong (Tidak Ada) --</option>
                    {allNurses?.map((n: any) => (
                      <option key={n.id} value={n.id}>
                        {n.username} {n.nip ? `(NIP: ${n.nip})` : ""}
                      </option>
                    ))}
                  </select>
                  {nurse && (
                    <div className="text-[10px] text-slate-500 flex items-center justify-between px-1">
                      <span>NIP: {nurse.nip || "-"}</span>
                      {nurse.str_perawat && <span>STR: {nurse.str_perawat}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Quick Action */}
              <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {slot.dokter_id || slot.perawat_id ? "Terisi" : "Libur"}
                </span>
                {(slot.dokter_id || slot.perawat_id) && (
                  <button
                    type="button"
                    onClick={() => handleClearDay(day.id)}
                    className="text-[10px] font-semibold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Kosongkan Hari
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Information Callout */}
      <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-0.5">Petunjuk Penyusunan & Pertukaran Jadwal:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li>
              <strong>Tukar Jadwal (Swap) Bebas Deadlock:</strong> Anda dapat langsung menukar hari tugas antara dokter maupun perawat di hari apa pun. Seluruh perubahan pada matriks ini akan disimpan secara atomic.
            </li>
            <li>
              <strong>Anti-Bentrok Antar Poliklinik:</strong> Sistem tetap memverifikasi bahwa dokter atau perawat yang Anda pilih tidak sedang bertugas di poliklinik lain pada hari yang sama.
            </li>
            <li>
              Pastikan menekan tombol <strong>"Simpan Perubahan Jadwal"</strong> di kanan atas setelah selesai mengubah susunan dinas mingguan.
            </li>
          </ul>
        </div>
      </div>

      {/* Modal Konfirmasi Kosongkan Semua */}
      <ModernConfirmModal
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={handleConfirmClearAll}
        title="Kosongkan Semua Jadwal Poliklinik"
        description={
          <span>
            Apakah Anda yakin ingin mengosongkan seluruh jadwal dokter dan perawat dari hari Senin s.d. Jumat pada{" "}
            <strong className="text-slate-800 font-semibold">{currentPoli?.name || "poliklinik ini"}</strong>?
          </span>
        }
        confirmText="Ya, Kosongkan Semua"
        cancelText="Batal"
        variant="warning"
        note="Perubahan ini belum tersimpan ke server sebelum Anda menekan tombol 'Simpan Perubahan Jadwal'."
      />
    </div>
  );
}
