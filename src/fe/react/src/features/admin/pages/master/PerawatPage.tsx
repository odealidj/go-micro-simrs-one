import { MasterDataTable } from "../../components/MasterDataTable";

export function PerawatPage() {
  return (
    <MasterDataTable<any>
      title="Data Perawat"
      description="Master data profil perawat"
      endpoint="/master/nurses"
      requiresPoliFilter={false}
      columns={["User ID / Username", "STR Perawat"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.username || item.id || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.str_perawat || "-"}</td>
        </tr>
      )}
    />
  );
}
