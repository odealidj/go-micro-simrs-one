import { MasterDataTable } from "../../components/MasterDataTable";

export function AssignKBMPoliPage() {
  return (
    <MasterDataTable<any>
      title="KBM - Poliklinik"
      description="Pemetaan KBM ke poliklinik"
      endpoint="/master/kbm"
      requiresPoliFilter={true}
      columns={["Kode KBM", "Nama KBM", "Body System", "Poliklinik"]}
      renderRow={(item, i, filterState) => {
        const displayedPoli = filterState?.poliCode 
          ? item.polyclinics?.filter((p: string) => p === filterState.poliCode) 
          : item.polyclinics;
          
        return (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-medium text-slate-900">{item.kbm_code || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.kbm_name || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.body_system || "-"}</td>
            <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={displayedPoli?.join(", ")}>
              {displayedPoli?.length > 0 ? displayedPoli.join(", ") : "-"}
            </td>
          </tr>
        );
      }}
    />
  );
}
