import { MasterDataTable } from "../../components/MasterDataTable";

export function TindakanPage() {
  return (
    <MasterDataTable<any>
      title="Tindakan & Tarif"
      description="Data master"
      endpoint="/master/tindakan"
      requiresPoliFilter={false}
      columns={["ID Tindakan","Nama Tindakan","Harga Dasar"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.kode_tindakan || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.nama_tindakan || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.base_price || 0}</td>
        </tr>
      )}
    />
  );
}
