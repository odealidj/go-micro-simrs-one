import { MasterDataTable } from "../../components/MasterDataTable";

export function AssignPerawatPoliPage() {
  return (
    <MasterDataTable<any>
      title="Assign Perawat"
      description="Pemetaan perawat ke poliklinik"
      endpoint="/master/nurses"
      requiresPoliFilter={true}
      columns={["User ID / Username","STR Perawat","Status"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.code || item.kbm_code || item.icd10_code || item.username || item.id || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.name || item.kbm_name || item.description || item.spesialisasi || item.str_perawat || item.tindakan_name || item.obat_name || item.role || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.body_system || item.sip || item.base_price || item.price || item.harga_dasar || <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Aktif</span>}</td>
        </tr>
      )}
    />
  );
}
