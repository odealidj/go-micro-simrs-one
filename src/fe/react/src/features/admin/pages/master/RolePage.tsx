import { MasterDataTable } from "../../components/MasterDataTable";

export function RolePage() {
  return (
    <MasterDataTable<any>
      title="Master Role"
      description="Management role dan akses sistem"
      endpoint="/master/roles"
      requiresPoliFilter={false}
      columns={["Role ID", "Deskripsi Role"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.id || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.deskripsi || "-"}</td>
        </tr>
      )}
    />
  );
}
