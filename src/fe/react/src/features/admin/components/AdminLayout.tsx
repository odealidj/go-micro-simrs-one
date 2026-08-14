import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { 
  Users, LogOut, LayoutDashboard, ShieldCheck, 
  Stethoscope, UserRound, Building2, Map,
  BookOpen, Pill, Activity, Stethoscope as MapPin, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminLayout() {
  const { logout, userId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navGroups = [
    {
      title: "System",
      items: [
        { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
        { name: "Users & Staff", path: "/admin/users", icon: Users },
        { name: "Role & Akses", path: "/admin/master/role", icon: ShieldCheck },
      ]
    },
    {
      title: "Ketenagaan (HRD)",
      items: [
        { name: "Data Dokter", path: "/admin/master/dokter", icon: Stethoscope },
        { name: "Data Perawat", path: "/admin/master/perawat", icon: UserRound },
        { name: "Data Poliklinik", path: "/admin/master/poliklinik", icon: Building2 },
        { name: "Assign Dokter", path: "/admin/master/assign-dokter", icon: MapPin },
        { name: "Assign Perawat", path: "/admin/master/assign-perawat", icon: MapPin },
      ]
    },
    {
      title: "Medis (EMR)",
      items: [
        { name: "Diagnosa / KBM", path: "/admin/master/kbm", icon: BookOpen },
        { name: "Mapping KBM", path: "/admin/master/assign-kbm", icon: Map },
        { name: "Katalog ICD-10", path: "/admin/master/icd10", icon: ClipboardList },
        { name: "Mapping ICD-10", path: "/admin/master/assign-icd10", icon: Map },
        { name: "Tindakan & Tarif", path: "/admin/master/tindakan", icon: Activity },
        { name: "Mapping Tindakan", path: "/admin/master/assign-tindakan", icon: Map },
      ]
    },
    {
      title: "Farmasi",
      items: [
        { name: "Inventaris Obat", path: "/admin/master/obat", icon: Pill },
        { name: "Mapping Obat", path: "/admin/master/assign-obat", icon: Map },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <span className="font-bold text-xl text-blue-700">SIMRS Admin</span>
        </div>
        <div className="flex-1 py-4 overflow-y-auto">
          
          {navGroups.map((group, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <nav className="space-y-1 px-3">
                {group.items.map((item) => {
                  // Strict active check for dashboard, startsWith for others
                  const isActive = 
                    (item.path === "/admin" && location.pathname === "/admin") ||
                    (item.path !== "/admin" && location.pathname.startsWith(item.path));
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <item.icon
                        className={`mr-3 h-4 w-4 flex-shrink-0 ${
                          isActive ? "text-blue-700" : "text-slate-400"
                        }`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

        </div>
        <div className="p-4 border-t border-slate-200">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-slate-800">
              {navGroups.flatMap(g => g.items).find((item) => 
                (item.path === "/admin" && location.pathname === "/admin") ||
                (item.path !== "/admin" && location.pathname.startsWith(item.path))
              )?.name || "Admin Portal"}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                A
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:block">Admin ({userId?.substring(0, 8)})</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
