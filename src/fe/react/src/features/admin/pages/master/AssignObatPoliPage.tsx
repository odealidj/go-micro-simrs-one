import { MasterDataTable } from "../../components/MasterDataTable";

export function AssignObatPoliPage() {
  return (
    <MasterDataTable<any>
      title="Obat - Poliklinik"
      description="Pemetaan ketersediaan obat ke poliklinik"
      endpoint="/master/obat"
      requiresPoliFilter={true}
      columns={["ID Obat","Nama Obat","Harga", "Stok", "Poliklinik"]}
      renderRow={(item, i, filterState) => {
        const displayedPoli = filterState?.poliCode 
          ? item.polyclinics?.filter((p: string) => p === filterState.poliCode) 
          : item.polyclinics;
          
        return (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-medium text-slate-900">{item.item_code || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.name || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.price || 0}</td>
            <td className="px-6 py-4 text-slate-600">{item.stock_quantity ?? "-"}</td>
            <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={displayedPoli?.join(", ")}>
              {displayedPoli?.length > 0 ? displayedPoli.join(", ") : "-"}
            </td>
          </tr>
        );
      }}
    />
  );
}
