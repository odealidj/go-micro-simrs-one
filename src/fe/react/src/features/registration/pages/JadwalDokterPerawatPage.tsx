import { useState } from "react";
import { AssignDokterPoliPage } from "@/features/admin/pages/master/AssignDokterPoliPage";
import { AssignPerawatPoliPage } from "@/features/admin/pages/master/AssignPerawatPoliPage";
import { useAuth } from "@/lib/AuthContext";

export function JadwalDokterPerawatPage() {
  const [activeTab, setActiveTab] = useState<"dokter" | "perawat">("dokter");
  const { role } = useAuth();
  
  const isReadOnly = role?.trim().toLowerCase() === "admisi";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Jadwal Praktek</h1>
        <p className="text-slate-500">
          Atur pemetaan dokter dan perawat berdasarkan poliklinik untuk jadwal rawat jalan.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("dokter")}
            className={`${
              activeTab === "dokter"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Jadwal Dokter
          </button>
          <button
            onClick={() => setActiveTab("perawat")}
            className={`${
              activeTab === "perawat"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
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

