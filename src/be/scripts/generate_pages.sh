#!/bin/bash
DIR="src/fe/react/src/features/admin/pages/master"
mkdir -p "$DIR"

create_page() {
  local page_name=$1
  local title=$2
  local description=$3

  cat << EOF > "$DIR/$page_name.tsx"
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function $page_name() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">$title</h2>
        <p className="text-slate-500 text-sm mt-1">$description</p>
        
        <div className="mt-6 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari data..."
              className="pl-10 bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Nama / Deskripsi</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-slate-500" colSpan={3}>
                  <div className="flex items-center justify-center p-8 text-slate-400">
                    <p>Data ditampilkan *Read-Only* dari Seed Data Master.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
EOF
}

create_page "RolePage" "Master Role" "Management role dan akses sistem"
create_page "DokterPage" "Data Dokter" "Master data profil dokter"
create_page "PerawatPage" "Data Perawat" "Master data profil perawat"
create_page "PoliklinikPage" "Poliklinik" "Data poliklinik rumah sakit"
create_page "AssignDokterPoliPage" "Assign Dokter" "Pemetaan dokter ke poliklinik"
create_page "AssignPerawatPoliPage" "Assign Perawat" "Pemetaan perawat ke poliklinik"
create_page "KBMPage" "Kamus Besar Medis" "Data Kamus Besar Medis (KBM)"
create_page "AssignKBMPoliPage" "Mapping KBM" "Pemetaan KBM ke poliklinik"
create_page "TindakanPage" "Tindakan Medis" "Tarif dan tindakan medis"
create_page "AssignTindakanPoliPage" "Mapping Tindakan" "Pemetaan tindakan medis ke poliklinik"
create_page "ICD10Page" "Katalog ICD-10" "Katalog kode ICD-10"
create_page "AssignICD10PoliPage" "Mapping ICD-10" "Pemetaan ICD-10 ke poliklinik"
create_page "ObatPage" "Inventaris Obat" "Katalog dan inventaris obat farmasi"
create_page "AssignObatPoliPage" "Mapping Obat" "Pemetaan obat ke poliklinik"

echo "Pages generated."
