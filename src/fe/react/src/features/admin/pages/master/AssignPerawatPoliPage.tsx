import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MasterDataTable } from "../../components/MasterDataTable";
import { useMasterData } from "@/hooks/useMasterData";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ModernConfirmModal } from "@/components/ui/ModernConfirmModal";
import { Calendar, Clock, AlertCircle, CheckCircle2, Info, CalendarDays, ArrowRight, Trash2 } from "lucide-react";

interface AssignPerawatPoliPageProps {
  readOnly?: boolean;
}

const WORK_DAYS = [
  { id: 1, label: "Senin", short: "Sen" },
  { id: 2, label: "Selasa", short: "Sel" },
  { id: 3, label: "Rabu", short: "Rab" },
  { id: 4, label: "Kamis", short: "Kam" },
  { id: 5, label: "Jumat", short: "Jum" },
];

function formatSchedule(days?: number[], shiftStart?: string, shiftEnd?: string) {
  if (!days || days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a - b);
  let dayText = "";
  if (sorted.length === 5 && sorted.every((d, idx) => d === idx + 1)) {
    dayText = "Senin - Jumat";
  } else {
    dayText = sorted.map((d) => WORK_DAYS.find((w) => w.id === d)?.short || `H-${d}`).join(", ");
  }
  const timeText = shiftStart && shiftEnd ? `${shiftStart.slice(0, 5)} - ${shiftEnd.slice(0, 5)}` : "08:00 - 16:00";
  return { dayText, timeText };
}

export function AssignPerawatPoliPage({ readOnly = false }: AssignPerawatPoliPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState<any>(null);
  const [selectedPoli, setSelectedPoli] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [occupiedDays, setOccupiedDays] = useState<Record<number, string>>({});
  const [loadingPoliSchedule, setLoadingPoliSchedule] = useState(false);
  const [nurseToUnassign, setNurseToUnassign] = useState<any | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: polyclinics } = useMasterData<any>("/master/polyclinics");

  useEffect(() => {
    if (!selectedPoli || !isModalOpen) {
      setOccupiedDays({});
      return;
    }

    let isMounted = true;
    setLoadingPoliSchedule(true);
    api
      .get(`/master/nurses/poli/${selectedPoli}`)
      .then((res) => {
        if (!isMounted) return;
        const nurses = res.data?.data || [];
        const occ: Record<number, string> = {};
        nurses.forEach((n: any) => {
          if (n.id !== selectedNurse?.id && n.days_of_week && Array.isArray(n.days_of_week)) {
            n.days_of_week.forEach((day: number) => {
              occ[day] = n.username;
            });
          }
        });
        setOccupiedDays(occ);
        // Otomatis buang hari yang sudah terisi perawat lain dari selectedDays
        setSelectedDays((prev) => {
          // Jika perawat baru di poliklinik ini atau belum ada hari, otomatis pilih semua hari yang tersedia (kosong)
          if (!selectedNurse?.poli_code || selectedNurse.poli_code !== selectedPoli) {
            const available = WORK_DAYS.filter((w) => !occ[w.id]).map((w) => w.id);
            return available;
          }
          // Jika perawat sedang mengedit jadwalnya di poli yang sama, pertahankan harinya dan buang yang bentrok dengan perawat lain
          return prev.filter((d) => !occ[d]);
        });
      })
      .catch(() => {
        if (isMounted) setOccupiedDays({});
      })
      .finally(() => {
        if (isMounted) setLoadingPoliSchedule(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPoli, isModalOpen, selectedNurse]);

  const handleAssignClick = (nurse: any) => {
    setSelectedNurse(nurse);
    setSelectedPoli(nurse.poli_code || "");
    setStartDate(nurse.start_date ? nurse.start_date.split("T")[0] : new Date().toISOString().split("T")[0]);
    if (nurse.poli_code && nurse.days_of_week && nurse.days_of_week.length > 0) {
      setSelectedDays(nurse.days_of_week);
    } else {
      setSelectedDays([]); // Kosongkan, akan diisi otomatis dengan hari yang tersedia saat poli dimuat
    }
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const toggleDay = (dayId: number) => {
    if (occupiedDays[dayId]) return;
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId].sort((a, b) => a - b));
    }
  };

  const handleSelectAllAvailable = () => {
    const available = WORK_DAYS.filter((w) => !occupiedDays[w.id]).map((w) => w.id);
    setSelectedDays(available);
  };

  const handleConfirmUnassign = async () => {
    if (!nurseToUnassign) return;
    setIsUnassigning(true);
    try {
      await api.post("/master/nurses/unassign", {
        perawat_id: nurseToUnassign.id,
        poli_code: nurseToUnassign.poli_code,
      });
      toast.success(
        `Penugasan perawat ${nurseToUnassign.nama_lengkap || nurseToUnassign.username} berhasil dilepas.`
      );
      setNurseToUnassign(null);
      setIsModalOpen(false);
      setRefreshKey((prev) => prev + 1);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal melepas penugasan perawat.");
    } finally {
      setIsUnassigning(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPoli || !selectedNurse || !startDate) return;
    if (selectedDays.length === 0) {
      setErrorMsg("Pilih minimal 1 hari kerja (Senin - Jumat) untuk perawat ini.");
      return;
    }

    const conflicting = selectedDays.filter((d) => occupiedDays[d]);
    if (conflicting.length > 0) {
      const conflictNames = conflicting
        .map((d) => `${WORK_DAYS.find((w) => w.id === d)?.label} (diisi ${occupiedDays[d]})`)
        .join(", ");
      setErrorMsg(`Jadwal bentrok: ${conflictNames}. Harap hapus centang hari tersebut.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.post("/master/nurses/assign", {
        perawat_id: selectedNurse.id,
        poli_code: selectedPoli,
        start_date: startDate,
        end_date: "2099-12-31",
        days_of_week: selectedDays,
        shift_start: "08:00:00",
        shift_end: "16:00:00",
      });
      setIsModalOpen(false);
      toast.success("Penugasan perawat berhasil disimpan.");
      setRefreshKey((prev) => prev + 1);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Terjadi kesalahan saat menyimpan data.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Butuh Mengatur atau Menukar Jadwal Lengkap?</h4>
            <p className="text-xs text-slate-500">Kelola jadwal seluruh dokter dan perawat per hari (Senin – Jumat) tanpa bentrok di Matriks Jadwal Poliklinik.</p>
          </div>
        </div>
        <Link to="/admin/master/jadwal-poliklinik">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            Buka Matriks Jadwal Poli <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      <MasterDataTable<any>
        key={refreshKey}
        title="Assign Perawat"
        description="Pemetaan perawat ke poliklinik berbasis hari kerja (Senin – Jumat, 1 Shift 08:00 – 16:00)"
        endpoint="/master/nurses"
        requiresPoliFilter={true}
        columns={
          readOnly
            ? ["User ID / Username", "NIP", "STR Perawat", "Poli & Jadwal Dinas"]
            : ["User ID / Username", "NIP", "STR Perawat", "Poli & Jadwal Dinas", "Aksi"]
        }
        renderRow={(item, i) => {
          const poliName = item.poli_code
            ? polyclinics?.find((p: any) => p.code === item.poli_code)?.name || item.poli_code
            : null;
          const sched = formatSchedule(item.days_of_week, item.shift_start, item.shift_end);

          return (
            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900">{item.username || item.id || "-"}</td>
              <td className="px-6 py-4 text-slate-600">{item.nip || "-"}</td>
              <td className="px-6 py-4 text-slate-600">{item.str_perawat || "-"}</td>
              <td className="px-6 py-4">
                {poliName ? (
                  <div className="flex flex-col gap-1 items-start">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {poliName}
                    </span>
                    {sched ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          {sched.dayText}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                          <Clock className="w-2.5 h-2.5" />
                          {sched.timeText}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Belum ada hari tugas</span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                    Belum ada poli
                  </span>
                )}
              </td>
              {!readOnly && (
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAssignClick(item)}
                      className="font-semibold text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                    >
                      Assign Poli
                    </Button>
                    {item.poli_code && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setNurseToUnassign(item)}
                        className="font-semibold text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1 cursor-pointer"
                        title="Lepas Penugasan Perawat dari Poliklinik"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Lepas
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          );
        }}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                Assign Poliklinik & Jadwal Dinas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Perawat: <span className="font-semibold text-blue-700">{selectedNurse?.username}</span>{" "}
                {selectedNurse?.str_perawat && `(STR: ${selectedNurse.str_perawat})`}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMsg}</div>
              </div>
            )}

            <div className="space-y-4 text-sm">
              {/* Pilihan Poliklinik */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Pilih Poliklinik Tujuan
                </label>
                <select
                  value={selectedPoli}
                  onChange={(e) => setSelectedPoli(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="">-- Pilih Poliklinik --</option>
                  {polyclinics?.map((p: any) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Info Shift Operasional */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">1 Shift Pelayanan: 08:00 – 16:00 WIB (Senin – Jumat)</p>
                  <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                    Poliklinik hanya memiliki 1 perawat jaga per hari. Multi-perawat di poliklinik yang sama dibagi berdasarkan hari tugas yang berbeda.
                  </p>
                </div>
              </div>

              {/* Pilihan Hari Kerja */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Hari Tugas Dinas (Senin – Jumat)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllAvailable}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Pilih Semua Hari Kosong
                  </button>
                </div>

                {loadingPoliSchedule ? (
                  <div className="py-4 text-center text-xs text-slate-400">Memeriksa ketersediaan jadwal...</div>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {WORK_DAYS.map((day) => {
                      const isOccupied = !!occupiedDays[day.id];
                      const occupant = occupiedDays[day.id];
                      const isSelected = selectedDays.includes(day.id);

                      if (isOccupied) {
                        return (
                          <div
                            key={day.id}
                            title={`Hari ${day.label} sudah ditugaskan kepada perawat ${occupant}`}
                            className="p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-center opacity-60 cursor-not-allowed select-none flex flex-col justify-center items-center gap-1"
                          >
                            <span className="text-xs font-bold text-slate-500">{day.label}</span>
                            <span className="text-[9px] font-semibold text-amber-700 bg-amber-100/80 px-1 py-0.5 rounded leading-tight">
                              {occupant}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={`p-2.5 rounded-lg border text-center transition-all flex flex-col justify-center items-center gap-1 cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20 font-bold"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 font-medium"
                          }`}
                        >
                          <span className="text-xs">{day.label}</span>
                          {isSelected ? (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          ) : (
                            <span className="text-[10px] text-slate-400 font-normal">Tersedia</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-2">
                  Dipilih:{" "}
                  <span className="font-semibold text-slate-800">
                    {selectedDays.length > 0
                      ? selectedDays
                          .map((d) => WORK_DAYS.find((w) => w.id === d)?.label)
                          .join(", ")
                      : "Belum ada hari yang dipilih"}
                  </span>
                </p>

                {selectedPoli && WORK_DAYS.every((w) => occupiedDays[w.id]) && (
                  <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Semua hari kerja (Senin–Jumat) di poliklinik ini sudah terisi penuh oleh perawat lain. Silakan gunakan menu <Link to="/admin/master/jadwal-poliklinik" className="font-bold underline text-amber-900">Jadwal Poliklinik</Link> untuk menukar jadwal, atau lepas penugasan perawat yang ada.
                    </span>
                  </div>
                )}
              </div>

              {/* Tanggal Mulai Tugas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Tanggal Mulai Penugasan
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Masa tugas berlaku sejak tanggal ini hingga penugasan diperbarui kembali.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-6 pt-3 border-t border-slate-100">
              {selectedNurse?.poli_code ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNurseToUnassign(selectedNurse)}
                  className="text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 flex items-center gap-1.5"
                  disabled={isSubmitting}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Lepas Penugasan
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="text-xs font-semibold">
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSubmitting || !selectedPoli || selectedDays.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Penugasan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Lepas Penugasan Modern */}
      <ModernConfirmModal
        isOpen={!!nurseToUnassign}
        onClose={() => !isUnassigning && setNurseToUnassign(null)}
        onConfirm={handleConfirmUnassign}
        isLoading={isUnassigning}
        title="Lepas Penugasan Perawat"
        description={
          <span>
            Apakah Anda yakin ingin melepas penugasan{" "}
            <strong className="text-slate-800 font-semibold">
              {nurseToUnassign?.nama_lengkap || nurseToUnassign?.username}
            </strong>{" "}
            dari poliklinik?
          </span>
        }
        confirmText="Ya, Lepas Penugasan"
        cancelText="Batal"
        variant="danger"
        itemDetails={[
          {
            label: "Perawat",
            value: nurseToUnassign?.nama_lengkap || nurseToUnassign?.username,
          },
          {
            label: "Poliklinik",
            value: (
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
                {nurseToUnassign?.poli_nama || `Poli ${nurseToUnassign?.poli_code}`}
              </span>
            ),
          },
          {
            label: "Hari Dinas Aktif",
            value: (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                {formatSchedule(nurseToUnassign?.days_of_week)?.dayText || "-"}
              </span>
            ),
          },
        ]}
        note="Jadwal hari dinas perawat ini akan segera dikosongkan sehingga hari tersebut dapat ditugaskan ke perawat lain."
      />
    </>
  );
}
