import { useState } from "react";
import { AssignDokterPoliPage } from "@/features/admin/pages/master/AssignDokterPoliPage";
import { AssignPerawatPoliPage } from "@/features/admin/pages/master/AssignPerawatPoliPage";
import { JadwalPiketTab } from "../components/JadwalPiketTab";
import { useAuth } from "@/lib/AuthContext";
import { AdmisiPageHeader } from "../components/AdmisiPageHeader";
import { admisiTheme } from "../theme";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export function JadwalDokterPerawatPage() {
  const [activeTab, setActiveTab] = useState<"dokter" | "perawat" | "piket">("dokter");
  const { role } = useAuth();
  
  const isReadOnly = role?.trim().toLowerCase() === "admisi";

  return (
    <div className={admisiTheme.layout.container}>
      <AdmisiPageHeader
        title="Jadwal Praktek Poliklinik"
        description="Pemetaan dokter, perawat rutin, dan jadwal piket akhir pekan (Sabtu & Minggu) untuk operasional rawat jalan."
        badge="Jadwal & Penugasan"
        icon={CalendarDays}
      />

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("dokter")}
            className={cn(
              "whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-all cursor-pointer",
              activeTab === "dokter"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            Jadwal Dokter (Rutin)
          </button>
          <button
            onClick={() => setActiveTab("perawat")}
            className={cn(
              "whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-all cursor-pointer",
              activeTab === "perawat"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            Jadwal Perawat (Rutin)
          </button>
          <button
            onClick={() => setActiveTab("piket")}
            className={cn(
              "whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "piket"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <span>Jadwal Piket (Temporer / Weekend)</span>
            <span className="text-[10px] uppercase font-extrabold tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Sabtu - Minggu
            </span>
          </button>
        </nav>
      </div>

      <div className="mt-4 flex-1 flex flex-col min-h-0">
        {activeTab === "dokter" && <AssignDokterPoliPage readOnly={isReadOnly} />}
        {activeTab === "perawat" && <AssignPerawatPoliPage readOnly={isReadOnly} />}
        {activeTab === "piket" && <JadwalPiketTab readOnly={isReadOnly} />}
      </div>
    </div>
  );
}


