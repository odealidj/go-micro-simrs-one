import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface User {
  id: string;
  username: string;
  role: string | null;
  status: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{total_count: number, total_pages: number} | null>(null);
  const pageSize = 10;

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/admin/users?page=${page}&page_size=${pageSize}`);
      if (response.data.success) {
        setUsers(response.data.data?.users || []);
        if (response.data.data?.total_count !== undefined) {
          setMeta({
            total_count: response.data.data.total_count,
            total_pages: Math.ceil(response.data.data.total_count / pageSize)
          });
        }
      }
    } catch (error) {
      toast.error("Gagal mengambil data user");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const payload: any = { status: newStatus };
      
      // If approving, make sure a role is selected
      if (newStatus === "ACTIVE") {
        const role = selectedRoles[userId];
        if (!role) {
          toast.error("Pilih role terlebih dahulu sebelum menerima staf.");
          return;
        }
        payload.role = role;
      }

      await api.put(`/admin/users/${userId}/status`, payload);
      toast.success(`Status user berhasil diubah menjadi ${newStatus}`);
      fetchUsers();
    } catch (error: any) {
      toast.error("Gagal mengubah status", {
        description: error.response?.data?.message || error.message,
      });
    }
  };

  // const getStatusBadge = (status: string) => {
  //   switch (status) {
  //     case "ACTIVE":
  //       return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Active</span>;
  //     case "PENDING":
  //       return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
  //     case "REJECTED":
  //       return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
  //     default:
  //       return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{status}</span>;
  //   }
  // };

  const roleOptions = [
    { value: "admisi", label: "Admisi / Pendaftaran" },
    { value: "dokter", label: "Dokter" },
    { value: "perawat", label: "Perawat" },
    { value: "asisten_apoteker", label: "Asisten Apoteker" },
    { value: "kasir", label: "Kasir" },
    { value: "admin", label: "Admin IT" },
    { value: "pasien", label: "Pasien" },
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Manajemen Pengguna</CardTitle>
          <CardDescription>
            Daftar semua pengguna terdaftar, termasuk staf yang menunggu persetujuan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">Username / NIP</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Memuat data...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      Belum ada data pengguna.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{user.username}</td>
                      <td className="px-6 py-4 capitalize text-slate-600">{user.role || "-"}</td>
                      <td className="px-6 py-4 text-right">
                        {user.status === "PENDING" && (
                          <div className="flex justify-end items-center space-x-2">
                            <select 
                              className="border border-slate-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={selectedRoles[user.id] || ""}
                              onChange={(e) => setSelectedRoles(prev => ({...prev, [user.id]: e.target.value}))}
                            >
                              <option value="" disabled>Pilih Role...</option>
                              {roleOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                              onClick={() => handleUpdateStatus(user.id, "ACTIVE")}
                            >
                              Terima
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              onClick={() => handleUpdateStatus(user.id, "REJECTED")}
                            >
                              Tolak
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {meta && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Total data: {meta.total_count}
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={page <= 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-sm">Halaman {page} dari {meta.total_pages}</span>
                <button 
                  disabled={page >= meta.total_pages} 
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
