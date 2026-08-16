import { MasterDataTable } from "../../components/MasterDataTable";

export function PoliklinikPage() {
  return (
    <MasterDataTable<any>
      title="Poliklinik"
      description="Data poliklinik rumah sakit"
      endpoint="/master/polyclinics"
      requiresPoliFilter={false}
      columns={["Kode", "Nama"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.code || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.name || "-"}</td>
        </tr>
      )}
    />
  );
}
