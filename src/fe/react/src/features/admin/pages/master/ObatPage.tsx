import { MasterDataTable } from "../../components/MasterDataTable";

export function ObatPage() {
  return (
    <MasterDataTable<any>
      title="Inventaris Obat"
      description="Data master"
      endpoint="/master/obat"
      requiresPoliFilter={false}
      columns={["ID Obat","Nama Obat","Harga"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.item_code || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.name || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.price || 0}</td>
        </tr>
      )}
    />
  );
}
