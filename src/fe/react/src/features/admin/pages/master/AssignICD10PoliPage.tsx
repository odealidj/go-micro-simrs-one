import { MasterDataTable } from "../../components/MasterDataTable";

export function AssignICD10PoliPage() {
  return (
    <MasterDataTable<any>
      title="Katalog ICD10 - Poliklinik"
      description="Pemetaan ICD-10 ke poliklinik"
      endpoint="/master/icd10"
      requiresPoliFilter={true}
      columns={["Kode ICD-10", "Deskripsi", "Poliklinik"]}
      renderRow={(item, i, filterState) => {
        const displayedPoli = filterState?.poliCode 
          ? item.polyclinics?.filter((p: string) => p === filterState.poliCode) 
          : item.polyclinics;
          
        return (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-medium text-slate-900">{item.icd10_code || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.name || item.description || "-"}</td>
            <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={displayedPoli?.join(", ")}>
              {displayedPoli?.length > 0 ? displayedPoli.join(", ") : "-"}
            </td>
          </tr>
        );
      }}
    />
  );
}
