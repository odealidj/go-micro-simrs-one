import { PatientRegistrationList } from "../components/PatientRegistrationList";

export function DaftarKunjunganPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Daftar Kunjungan</h2>
        <p className="text-slate-500 mt-1">Data operasional pendaftaran dan kunjungan pasien.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <PatientRegistrationList />
      </div>
    </div>
  );
}
