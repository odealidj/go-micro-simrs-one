import { useState } from "react";
import { AssignDokterPoliPage } from "@/features/admin/pages/master/AssignDokterPoliPage";
import { AssignPerawatPoliPage } from "@/features/admin/pages/master/AssignPerawatPoliPage";
import { useAuth } from "@/lib/AuthContext";
import { AdmisiPageHeader } from "../components/AdmisiPageHeader";
import { admisiTheme } from "../theme";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export function JadwalDokterPerawatPage() {
  const [activeTab, setActiveTab] = useState<"dokter" | "perawat">("dokter");
  const { role } = useAuth();
  
  const isReadOnly = role?.trim().toLowerCase() === "admisi";

  return (
    <div className={admisiTheme.layout.container}>
      <AdmisiPageHeader
        title="Jadwal Praktek Poliklinik"
        description="Pemetaan dokter dan perawat aktif per poliklinik untuk operasional rawat jalan."
        badge="Jadwal & Penugasan"
        icon={CalendarDays}
      />

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("dokter")}
            className={cn(
              "whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-all",
              activeTab === "dokter"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            Jadwal Dokter
          </button>
          <button
            onClick={() => setActiveTab("perawat")}
            className={cn(
              "whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-all",
              activeTab === "perawat"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            Jadwal Perawat
          </button>
        </nav>
      </div>

      <div className="mt-4">
        {activeTab === "dokter" && <AssignDokterPoliPage readOnly={isReadOnly} />}
        {activeTab === "perawat" && <AssignPerawatPoliPage readOnly={isReadOnly} />}
      </div>
    </div>
  );
}


