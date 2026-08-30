import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ModernConfirmModal } from "@/components/ui/ModernConfirmModal";
import { 
  Clock, AlertCircle, Plus, Trash2, ShieldCheck, 
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getHospitalTodayDate, formatHospitalDate, getHospitalDateStatus } from "@/lib/dateUtils";
import { DatePicker } from "@/components/ui/DatePicker";

interface JadwalPiketTabProps {
  readOnly?: boolean;
}

interface PiketSchedule {
  id: string;
  poli_code: string;
  poli_name: string;
  dokter_id: string;
  dokter_name: string;
  dokter_spesialisasi: string;
  perawat_id?: string;
  perawat_name?: string;
  piket_date: string;
  shift_start: string;
  shift_end: string;
  keterangan?: string;
  created_at: string;
}

export function JadwalPiketTab({ readOnly = false }: JadwalPiketTabProps) {
  const [schedules, setSchedules] = useState<PiketSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPoli, setSearchPoli] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Master options for modal
  const [polyclinics, setPolyclinics] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [formPoli, setFormPoli] = useState("");
  const [formDokter, setFormDokter] = useState("");
  const [formPerawat, setFormPerawat] = useState("");
  const [formDate, setFormDate] = useState(getHospitalTodayDate());
  const [formShiftStart, setFormShiftStart] = useState("08:00");
  const [formShiftEnd, setFormShiftEnd] = useState("14:00");
  const [formKeterangan, setFormKeterangan] = useState("Piket Weekend");

  // Delete State
  const [itemToDelete, setItemToDelete] = useState<PiketSchedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      let url = "/master/jadwal-piket";
      const params = new URLSearchParams();
      if (filterDate) params.append("date", filterDate);
      if (searchPoli) params.append("poli_code", searchPoli);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await api.get(url);
      setSchedules(res.data?.data || []);
    } catch (err: any) {
      toast.error("Gagal memuat daftar jadwal piket");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [filterDate, searchPoli]);

  // Load masters for dialog
  useEffect(() => {
    if (isModalOpen && polyclinics.length === 0) {
      api.get("/master/polyclinics").then((res) => setPolyclinics(res.data?.data || [])).catch(() => {});
      api.get("/master/doctors?page_size=100").then((res) => setDoctors(res.data?.data || [])).catch(() => {});
      api.get("/master/nurses?page_size=100").then((res) => setNurses(res.data?.data || [])).catch(() => {});
    }
  }, [isModalOpen]);

  const handleOpenCreateModal = () => {
    setFormError("");
    setFormPoli("");
    setFormDokter("");
    setFormPerawat("");
    setFormDate(getHospitalTodayDate());
    setFormShiftStart("08:00");
    setFormShiftEnd("14:00");
    setFormKeterangan("Piket Weekend");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPoli) {
      setFormError("Poliklinik tujuan wajib dipilih.");
      return;
    }
    if (!formDokter) {
      setFormError("Dokter piket wajib dipilih.");
      return;
    }
    if (!formDate) {
      setFormError("Tanggal piket wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      await api.post("/master/jadwal-piket", {
        poli_code: formPoli,
        dokter_id: formDokter,
        perawat_id: formPerawat || null,
        piket_date: formDate,
        shift_start: formShiftStart,
        shift_end: formShiftEnd,
        keterangan: formKeterangan,
      });

      toast.success("Jadwal piket berhasil disimpan");
      setIsModalOpen(false);
      fetchSchedules();
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Gagal menyimpan jadwal piket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/master/jadwal-piket/${itemToDelete.id}`);
      toast.success("Jadwal piket berhasil dibatalkan");
      setItemToDelete(null);
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal membatalkan jadwal piket");
    } finally {
      setIsDeleting(false);
    }
  };

  // Tanggal hari ini dan helper formatting diambil langsung dari dateUtils

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Filter Tanggal:</span>
            <div className="w-52">
              <DatePicker
                value={filterDate}
                onChange={(d) => setFilterDate(d)}
                placeholder="Semua tanggal..."
                showPresets={true}
              />
            </div>
            {filterDate && (
              <Button size="sm" variant="ghost" onClick={() => setFilterDate("")} className="text-xs text-slate-500 h-7 px-2">
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Poliklinik:</span>
            <input
              type="text"
              placeholder="Kode poli..."
              value={searchPoli}
              onChange={(e) => setSearchPoli(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50/50 w-28"
            />
            {searchPoli && (
              <Button size="sm" variant="ghost" onClick={() => setSearchPoli("")} className="text-xs text-slate-500 h-7 px-2">
                Reset
              </Button>
            )}
          </div>
        </div>

        {!readOnly && (
          <Button
            onClick={handleOpenCreateModal}
            className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-2xs font-semibold text-xs gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tambah Jadwal Piket
          </Button>
        )}
      </div>

      {/* Table Card */}
      <div className="card-premium overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-0 overflow-x-auto overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="px-5 py-3 font-semibold">Tanggal & Hari</th>
                <th className="px-5 py-3 font-semibold">Poliklinik</th>
                <th className="px-5 py-3 font-semibold">Dokter Piket</th>
                <th className="px-5 py-3 font-semibold">Perawat Pendamping</th>
                <th className="px-5 py-3 font-semibold">Jam Shift</th>
                <th className="px-5 py-3 font-semibold">Keterangan</th>
                <th className="px-5 py-3 font-semibold text-center">Status</th>
                {!readOnly && <th className="px-5 py-3 font-semibold text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                    Memuat data jadwal piket...
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                    Belum ada jadwal piket yang terdaftar.
                  </td>
                </tr>
              ) : (
                schedules.map((item) => {
                  const status = getHospitalDateStatus(item.piket_date);
                  const isToday = status === "TODAY";
                  const isPast = status === "PAST";

                  return (
                    <tr key={item.id} className={cn("hover:bg-slate-50/60 transition-colors", isToday && "bg-emerald-50/25")}>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-xs">
                          {formatHospitalDate(item.piket_date)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {item.piket_date}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-bold text-xs text-sky-800 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
                          {item.poli_name}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                            Dr
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{item.dokter_name}</div>
                            <div className="text-[11px] text-slate-500">{item.dokter_spesialisasi}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {item.perawat_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                              Pr
                            </div>
                            <span className="text-xs font-medium text-slate-700">{item.perawat_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">-</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-700 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {item.shift_start} - {item.shift_end}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-[200px] truncate">
                        {item.keterangan || "-"}
                      </td>

                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {isToday ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                            <ShieldCheck className="w-3 h-3" />
                            Hari Ini (Aktif)
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                            Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-100 text-sky-800 border border-sky-200">
                            Mendatang
                          </span>
                        )}
                      </td>

                      {!readOnly && (
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setItemToDelete(item)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8 px-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Batal
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Tambah Jadwal Piket */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-600" />
                  Tambah Jadwal Piket / Khusus
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tugaskan dokter dan perawat untuk akhir pekan (Sabtu/Minggu) atau hari libur.
                </p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{formError}</div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Tanggal Piket */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Tanggal Piket *
                </label>
                <DatePicker
                  value={formDate}
                  onChange={(dateStr) => setFormDate(dateStr)}
                  placeholder="Pilih tanggal piket..."
                  highlightWeekends={true}
                  showPresets={true}
                  presetMode="weekend"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Hari: <span className="font-semibold text-slate-700">{formatHospitalDate(formDate)}</span>
                </p>
              </div>

              {/* Poliklinik Tujuan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Poliklinik Tujuan *
                </label>
                <select
                  value={formPoli}
                  onChange={(e) => setFormPoli(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  <option value="">-- Pilih Poliklinik --</option>
                  {polyclinics.map((p: any) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dokter Jaga */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Dokter Jaga Piket *
                </label>
                <select
                  value={formDokter}
                  onChange={(e) => setFormDokter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  <option value="">-- Pilih Dokter Jaga --</option>
                  {doctors.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.username} {d.spesialisasi ? `(${d.spesialisasi})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Perawat Pendamping */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Perawat Pendamping (Opsional)
                </label>
                <select
                  value={formPerawat}
                  onChange={(e) => setFormPerawat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  <option value="">-- Tanpa Perawat / Pilih Perawat --</option>
                  {nurses.map((n: any) => (
                    <option key={n.id} value={n.id}>
                      {n.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jam Shift */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wide">
                    Mulai Shift
                  </label>
                  <input
                    type="time"
                    value={formShiftStart}
                    onChange={(e) => setFormShiftStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wide">
                    Selesai Shift
                  </label>
                  <input
                    type="time"
                    value={formShiftEnd}
                    onChange={(e) => setFormShiftEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
                  />
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Keterangan
                </label>
                <input
                  type="text"
                  placeholder="Misal: Piket Weekend, Pelayanan Hari Libur"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Jadwal Piket"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ModernConfirmModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDelete}
        title="Batalkan Jadwal Piket"
        description={`Apakah Anda yakin ingin membatalkan jadwal piket dokter ${itemToDelete?.dokter_name} di ${itemToDelete?.poli_name} pada tanggal ${itemToDelete?.piket_date}?`}
        confirmText="Ya, Batalkan"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}
