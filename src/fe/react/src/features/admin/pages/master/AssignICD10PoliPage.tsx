import { MasterDataTable } from "../../components/MasterDataTable";

export function AssignICD10PoliPage() {
  return (
    <MasterDataTable<any>
      title="Mapping ICD-10"
      description="Pemetaan ICD-10 ke poliklinik"
      endpoint="/master/icd10"
      requiresPoliFilter={true}
      columns={["Kode ICD-10","Deskripsi","Status", "Poliklinik"]}
      renderRow={(item, i, filterState) => {
        const displayedPoli = filterState?.poliCode 
          ? item.polyclinics?.filter((p: string) => p === filterState.poliCode) 
          : item.polyclinics;
          
        return (
          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-4 font-medium text-slate-900">{item.code || item.kbm_code || item.icd10_code || item.username || item.id || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.name || item.kbm_name || item.description || item.spesialisasi || item.str_perawat || item.tindakan_name || item.obat_name || item.role || "-"}</td>
            <td className="px-6 py-4 text-slate-600">{item.body_system || item.sip || item.base_price || item.price || item.harga_dasar || <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktif</span>}</td>
            <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={displayedPoli?.join(", ")}>
              {displayedPoli?.length > 0 ? displayedPoli.join(", ") : "-"}
            </td>
          </tr>
        );
      }}
    />
  );
}
