import { MasterDataTable } from "../../components/MasterDataTable";

export function ICD10Page() {
  return (
    <MasterDataTable<any>
      title="Katalog ICD-10"
      description="Katalog kode ICD-10"
      endpoint="/master/icd10"
      requiresPoliFilter={false}
      columns={["Kode ICD-10", "Deskripsi"]}
      renderRow={(item, i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
          <td className="px-6 py-4 font-medium text-slate-900">{item.icd10_code || "-"}</td>
          <td className="px-6 py-4 text-slate-600">{item.name || item.description || "-"}</td>
        </tr>
      )}
    />
  );
}
