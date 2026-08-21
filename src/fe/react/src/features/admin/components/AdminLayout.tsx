import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { 
  Users, LogOut, LayoutDashboard, ShieldCheck, 
  Stethoscope, UserRound, Building2, Map,
  BookOpen, Pill, Activity, Stethoscope as MapPin, ClipboardList,
  ChevronLeft, ChevronRight, Bell, Bot
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
        { name: "Pengaturan AI", path: "/admin/ai-settings", icon: Bot },
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20 ${
          !isSidebarOpen ? "w-20" : "w-64"
        }`}
      >
        {/* Sidebar Header */}
        <div className={`flex items-center h-16 border-b border-slate-200 relative ${
          !isSidebarOpen ? "justify-center" : "px-4 justify-between"
        }`}>
          {!isSidebarOpen ? (
            <Activity className="h-8 w-8 text-blue-600" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="leading-none">
                <h1 className="font-bold text-lg text-slate-800 tracking-tight">Codina</h1>
                <span className="text-[10px] font-semibold text-blue-600 tracking-wider uppercase">SIMRS Admin</span>
              </div>
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            className={`h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full ${
              !isSidebarOpen ? "absolute -right-3.5 top-4 bg-white border border-slate-200 shadow-sm" : ""
            }`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 py-4 overflow-y-auto">
          {navGroups.map((group, idx) => (
            <div key={idx} className="mb-6">
              {isSidebarOpen && (
                <h3 className="px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
              )}
              <nav className="space-y-1 px-3">
                {group.items.map((item) => {
                  const isActive = 
                    (item.path === "/admin" && location.pathname === "/admin") ||
                    (item.path !== "/admin" && location.pathname.startsWith(item.path));
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative cursor-pointer ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <item.icon
                        className={`h-5 w-5 shrink-0 ${
                          isActive ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"
                        } ${isSidebarOpen ? "mr-3" : "mx-auto"}`}
                      />
                      {isSidebarOpen && <span>{item.name}</span>}
                      {!isSidebarOpen && (
                        <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm">
                          {item.name}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-slate-800">
              {navGroups.flatMap(g => g.items).find((item) => 
                (item.path === "/admin" && location.pathname === "/admin") ||
                (item.path !== "/admin" && location.pathname.startsWith(item.path))
              )?.name || "Admin Portal"}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 hover:text-slate-700 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            
            <div className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-sm uppercase shadow-inner">
                A
              </div>
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-800 leading-tight">Admin Master</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
                  ID: {userId ? userId.substring(0, 8) : "Admin"}
                </p>
              </div>
              
              <div className="h-8 w-px bg-slate-100 hidden md:block mx-1"></div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Keluar (Logout)"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
