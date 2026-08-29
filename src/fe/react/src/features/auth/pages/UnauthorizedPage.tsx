import { ShieldX, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role, logout } = useAuth();

  const handleBack = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    // Redirect ke halaman yang sesuai role
    switch (role) {
      case "admin":
      case "super_admin":
        navigate("/admin");
        break;
      case "admisi":
        navigate("/admisi");
        break;
      case "dokter":
        navigate("/rawat-jalan/dokter");
        break;
      case "perawat":
        navigate("/rawat-jalan/perawat");
        break;
      case "kasir":
        navigate("/kasir");
        break;
      case "asisten_apoteker":
        navigate("/apoteker");
        break;
      case "pasien":
        navigate("/pasien");
        break;
      default:
        logout();
        navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-red-50 rounded-full">
            <ShieldX className="h-12 w-12 text-red-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-800">Akses Ditolak</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Anda tidak memiliki izin untuk mengakses halaman ini.
            <br />
            Silakan hubungi administrator jika Anda merasa ini adalah kesalahan.
          </p>
        </div>

        {role && (
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            Role aktif: <span className="ml-1 font-semibold text-slate-800">{role}</span>
          </div>
        )}

        <Button
          onClick={handleBack}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isAuthenticated ? "Kembali ke Dashboard" : "Ke Halaman Login"}
        </Button>
      </div>
    </div>
  );
}
