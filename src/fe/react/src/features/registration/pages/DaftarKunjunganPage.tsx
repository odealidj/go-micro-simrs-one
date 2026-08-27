import { PatientRegistrationList } from "../components/PatientRegistrationList";
import { AdmisiPageHeader } from "../components/AdmisiPageHeader";
import { admisiTheme } from "../theme";
import { ListChecks } from "lucide-react";

export function DaftarKunjunganPage() {
  return (
    <div className={admisiTheme.layout.container}>
      <AdmisiPageHeader
        title="Daftar Kunjungan Pasien"
        description="Monitoring data operasional pendaftaran dan status kunjungan pasien hari ini."
        badge="Data Kunjungan"
        icon={ListChecks}
      />

      <div className="grid grid-cols-1 gap-6">
        <PatientRegistrationList />
      </div>
    </div>
  );
}

