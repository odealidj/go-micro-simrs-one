import { MasterDataTable } from "../../components/MasterDataTable";

export function AssignTindakanPoliPage() {
  return (
    <MasterDataTable<any>
      title="Tindakan - Poliklinik"
      description="Pemetaan tindakan medis ke poliklinik"
      endpoint="/master/tindakan"
      requiresPoliFilter={true}
      columns={["ID Tindakan","Nama Tindakan","Harga Dasar", "Poliklinik"]}
      renderRow={(item, i, filterState) => {
        const displayedPoli = filterState?.poliCode 
          ? item.polyclinics?.filter((p: string) => p === filterState.poliCode) 
          : item.polyclinics;
          
        return (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-medium text-slate-900">{item.kode_tindakan || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.nama_tindakan || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.base_price || 0}</td>
            <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={displayedPoli?.join(", ")}>
              {displayedPoli?.length > 0 ? displayedPoli.join(", ") : "-"}
            </td>
          </tr>
        );
      }}
    />
  );
}
