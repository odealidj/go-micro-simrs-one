import { MasterDataTable } from "../../components/MasterDataTable";

export function KBMPage() {
  return (
    <MasterDataTable<any>
      title="Kamus Besar Medis"
      description="Data Kamus Besar Medis (KBM)"
      endpoint="/master/kbm"
      requiresPoliFilter={false}
      columns={["Kode KBM", "Nama KBM", "Body System"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.kbm_code || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.kbm_name || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.body_system || "-"}</td>
        </tr>
      )}
    />
  );
}
