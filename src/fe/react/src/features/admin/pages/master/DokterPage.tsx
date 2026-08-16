import { MasterDataTable } from "../../components/MasterDataTable";

export function DokterPage() {
  return (
    <MasterDataTable<any>
      title="Data Dokter"
      description="Master data profil dokter"
      endpoint="/master/doctors"
      requiresPoliFilter={false}
      columns={["User ID / Username", "Spesialisasi", "SIP"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.username || item.id || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.spesialisasi || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.sip || "-"}</td>
        </tr>
      )}
    />
  );
}
