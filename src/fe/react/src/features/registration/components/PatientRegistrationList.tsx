import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Search, RefreshCw, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Encounter {
  encounter_no: string;
  mrn: string;
  patient_name: string;
  department_code: string;
  doctor_id: string;
  status: string;
  status_pasien: string; // "Baru RS" / "Lama RS"
  registered_time: string;
}

// Format current date to YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

export function PatientRegistrationList() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState(getTodayString());

  const fetchEncounters = async () => {
    setLoading(true);
    try {
      const response = await api.get('/registrations/today', {
        params: {
          date: filterDate
        }
      });
      if (response.data?.success) {
        setEncounters(response.data.data.encounters || []);
      } else {
        toast.error("Gagal mengambil data registrasi hari ini");
      }
    } catch (error) {
      console.error("Error fetching encounters:", error);
      toast.error("Terjadi kesalahan sistem saat mengambil data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [filterDate]);

  const handleCancelEncounter = async (encounterNo: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan registrasi ${encounterNo}?`)) {
      return;
    }

    try {
      const response = await api.post('/registrations/cancel', {
        encounter_no: encounterNo,
        reason: "Dibatalkan oleh petugas pendaftaran"
      });
      if (response.data?.success) {
        toast.success("Registrasi berhasil dibatalkan");
        fetchEncounters(); // refresh table
      } else {
        toast.error("Gagal membatalkan registrasi");
      }
    } catch (error) {
      console.error("Error cancelling encounter:", error);
      toast.error("Terjadi kesalahan sistem saat membatalkan");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REGISTERED':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Registered</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>;
      case 'DISCHARGED':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Selesai</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{status}</Badge>;
    }
  };

  const getStatusPasienBadge = (statusPasien: string) => {
    if (statusPasien === "Baru RS") {
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Baru RS</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200">Lama RS</Badge>;
  };

  const filteredEncounters = encounters.filter(e => 
    e.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.mrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.encounter_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden mt-6">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-800">Daftar Kunjungan Pasien</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Input
            type="date"
            className="w-40 h-9 text-sm"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="text" 
              placeholder="Cari MRN / Nama..." 
              className="pl-9 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 px-3" onClick={fetchEncounters} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[120px]">No. Registrasi</TableHead>
              <TableHead className="w-[100px]">MRN</TableHead>
              <TableHead>Nama Pasien</TableHead>
              <TableHead>Poli Tujuan</TableHead>
              <TableHead>Status Pasien</TableHead>
              <TableHead>Status Kunjungan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEncounters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                  Belum ada pasien yang didaftarkan hari ini.
                </TableCell>
              </TableRow>
            ) : (
              filteredEncounters.map((encounter) => (
                <TableRow key={encounter.encounter_no}>
                  <TableCell className="font-medium text-slate-700">{encounter.encounter_no}</TableCell>
                  <TableCell className="text-slate-600">{encounter.mrn}</TableCell>
                  <TableCell className="font-medium">{encounter.patient_name}</TableCell>
                  <TableCell>{encounter.department_code}</TableCell>
                  <TableCell>{getStatusPasienBadge(encounter.status_pasien)}</TableCell>
                  <TableCell>{getStatusBadge(encounter.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Buka menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuItem>
                          Edit Biodata
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-700"
                          onClick={() => handleCancelEncounter(encounter.encounter_no)}
                          disabled={encounter.status === 'CANCELLED'}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Registrasi
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
