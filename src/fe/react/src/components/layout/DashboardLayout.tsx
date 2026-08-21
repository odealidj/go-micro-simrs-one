import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  Activity, 
  LayoutDashboard, 
  UserPlus, 
  Settings, 
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
  ListChecks,
  MonitorPlay,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({ Admisi: true });
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, role, userId } = useAuth();

  const sidebarMenus = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", isRoot: true },
    {
      moduleLabel: "Admisi",
      moduleIcon: ClipboardList,
      children: [
        { icon: ListChecks, label: "Daftar Kunjungan", path: "/admisi/daftar" },
        { icon: UserPlus, label: "Pendaftaran Pasien", path: "/admisi/baru" },
        { icon: MonitorPlay, label: "Monitor Antrean", path: "/admisi/antrean" },
      ]
    },
    {
      moduleLabel: "Master Data",
      moduleIcon: Settings,
      children: [
        { icon: Settings, label: "Jadwal Praktek", path: "/admisi/jadwal" },
      ]
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleModule = (moduleLabel: string) => {
    if (!isSidebarOpen) setIsSidebarOpen(true);
    setExpandedModules(prev => ({
      ...prev,
      [moduleLabel]: !prev[moduleLabel]
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Clean & Minimal */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20",
          !isSidebarOpen ? "w-20" : "w-64"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn("flex items-center h-16 border-b border-slate-200 relative", !isSidebarOpen ? "justify-center" : "px-4 justify-between")}>
          {!isSidebarOpen ? (
            <Activity className="h-8 w-8 text-blue-600" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="leading-none">
                <h1 className="font-bold text-lg text-slate-800 tracking-tight">Codina</h1>
                <span className="text-[10px] font-semibold text-blue-600 tracking-wider uppercase">Mini SIMRS</span>
              </div>
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            className={cn("h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full", !isSidebarOpen ? "absolute -right-3.5 top-4 bg-white border border-slate-200 shadow-sm" : "")}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-2 overflow-y-auto">
          {sidebarMenus.map((menu, idx) => {
            if (menu.isRoot) {
              const isActive = location.pathname.startsWith(menu.path as string);
              return (
                <Link
                  key={menu.path || idx}
                  to={menu.path as string}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative cursor-pointer",
                    isActive 
                      ? "bg-blue-50 text-blue-700 font-medium" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <menu.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
                  {isSidebarOpen && <span className="font-medium whitespace-nowrap">{menu.label}</span>}
                  {!isSidebarOpen && (
                    <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm">
                      {menu.label}
                    </div>
                  )}
                </Link>
              );
            }

            // Render group menu
            const isExpanded = expandedModules[menu.moduleLabel as string];
            const isChildActive = menu.children?.some(child => location.pathname.startsWith(child.path));

            return (
              <div key={menu.moduleLabel} className="space-y-1 mt-2">
                <button
                  onClick={() => toggleModule(menu.moduleLabel as string)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group relative cursor-pointer",
                    isChildActive && !isExpanded ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {menu.moduleIcon && <menu.moduleIcon className={cn("h-5 w-5 shrink-0", isChildActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />}
                    {isSidebarOpen && <span className="font-semibold text-sm whitespace-nowrap">{menu.moduleLabel}</span>}
                  </div>
                  {isSidebarOpen && (
                    <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isExpanded ? "rotate-180" : "")} />
                  )}
                  {!isSidebarOpen && (
                    <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-sm">
                      {menu.moduleLabel}
                    </div>
                  )}
                </button>

                {isSidebarOpen && isExpanded && (
                  <div className="ml-4 pl-3 border-l border-slate-200 space-y-1">
                    {menu.children?.map(child => {
                      const isActive = location.pathname.startsWith(child.path);
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm group",
                            isActive 
                              ? "bg-blue-50 text-blue-700 font-medium" 
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          <child.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
                          <span className="whitespace-nowrap">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>


      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <div className="flex items-center w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Cari pasien, antrean, atau rekam medis..." 
                className="w-full pl-10 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500 rounded-lg h-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 hover:text-slate-700 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            
            <div className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-sm uppercase shadow-inner">
                {role ? role.substring(0, 1) : "A"}
              </div>
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-800 leading-tight">
                  Staf {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Admisi"}
                </p>
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
