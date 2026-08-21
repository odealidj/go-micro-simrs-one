import { useState } from "react";
import { MasterDataTable } from "../../components/MasterDataTable";
import { useMasterData } from "@/hooks/useMasterData";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface AssignPerawatPoliPageProps {
  readOnly?: boolean;
}

export function AssignPerawatPoliPage({ readOnly = false }: AssignPerawatPoliPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState<any>(null);
  const [selectedPoli, setSelectedPoli] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: polyclinics } = useMasterData<any>("/master/polyclinics");

  const handleAssignClick = (nurse: any) => {
    setSelectedNurse(nurse);
    setSelectedPoli(nurse.poli_code || "");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPoli || !selectedNurse) return;
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.post("/master/nurses/assign", {
        perawat_id: selectedNurse.id,
        poli_code: selectedPoli,
      });
      setIsModalOpen(false);
      window.location.reload(); // Simple reload to reflect changes
    } catch (e: any) {
      const msg = e.response?.data?.message || "Terjadi kesalahan saat menyimpan data.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <MasterDataTable<any>
        title="Assign Perawat"
        description="Pemetaan perawat ke poliklinik"
        endpoint="/master/nurses"
        requiresPoliFilter={true}
        columns={readOnly ? ["User ID / Username", "STR Perawat", "Poli Saat Ini"] : ["User ID / Username", "STR Perawat", "Poli Saat Ini", "Aksi"]}
        renderRow={(item, i) => {
          const poliName = item.poli_code 
            ? polyclinics?.find((p: any) => p.code === item.poli_code)?.name || item.poli_code
            : "-";
          return (
            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900">{item.username || item.id || "-"}</td>
              <td className="px-6 py-4 text-slate-600">{item.str_perawat || "-"}</td>

              <td className="px-6 py-4 text-slate-600">
                {item.poli_code ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {poliName}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    Belum ada poli
                  </span>
                )}
              </td>
              {!readOnly && (
                <td className="px-6 py-4">
                  <Button size="sm" variant="outline" onClick={() => handleAssignClick(item)}>
                    Assign Poli
                  </Button>
                </td>
              )}
            </tr>
          );
        }}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">Assign Poli - {selectedNurse?.username}</h3>
            </div>
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">
                {errorMsg}
              </div>
            )}
            <div className="py-2 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Pilih Poliklinik</label>
              <select 
                value={selectedPoli} 
                onChange={(e) => setSelectedPoli(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
              >
                <option value="">Pilih poli...</option>
                {polyclinics?.map((p: any) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Note: Mengubah poliklinik akan otomatis menutup riwayat (end_date) tugas di poliklinik sebelumnya dan memulai tugas di poliklinik baru.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
              <Button onClick={handleSave} disabled={isSubmitting || !selectedPoli}>
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
