import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  ClipboardList,
  LayoutDashboard,
  UserPlus,
  ListChecks,
  MonitorPlay,
  CalendarDays,
  LogOut,
  Bell,
  ChevronLeft,
  ChevronRight,
  Activity,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { admisiTheme } from "../theme";

interface NavItem {
  name: string;
  path: string;
  exact?: boolean;
  icon: React.ElementType;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: null,
    items: [
      { name: "Dashboard", path: "/admisi", exact: true, icon: LayoutDashboard },
    ],
  },
  {
    title: "Pendaftaran",
    items: [
      { name: "Daftar Kunjungan", path: "/admisi/kunjungan", icon: ListChecks },
      { name: "Pasien Baru", path: "/admisi/baru", icon: UserPlus },
    ],
  },
  {
    title: "Antrean & Jadwal",
    items: [
      { name: "Monitor Antrean", path: "/admisi/antrean", icon: MonitorPlay },
      { name: "Jadwal Praktek", path: "/admisi/jadwal", icon: CalendarDays },
    ],
  },
];

export function AdmisiLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, role, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const currentNav = navGroups
    .flatMap((g) => g.items)
    .find((item) => isActive(item.path, item.exact));

  return (
    <div className="min-h-screen bg-[#f8fafc] flex antialiased">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-slate-200/80 transition-all duration-300 ease-in-out flex flex-col z-20 shrink-0",
          !isSidebarOpen ? "w-20" : "w-64"
        )}
      >
        {/* Sidebar Header */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-slate-100 relative",
            !isSidebarOpen ? "justify-center" : "px-5 justify-between"
          )}
        >
          {!isSidebarOpen ? (
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-sm shadow-sky-600/20">
              <ClipboardList className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-sm shadow-sky-600/20">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base text-slate-900 tracking-tight">
                    {admisiTheme.brand.systemName}
                  </h1>
                </div>
                <span className="text-[10px] font-bold text-sky-600 tracking-wider uppercase">
                  {admisiTheme.brand.moduleName}
                </span>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-all",
              !isSidebarOpen
                ? "absolute -right-3.5 top-4.5 bg-white border border-slate-200 shadow-sm"
                : ""
            )}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Ciutkan Menu" : "Buka Menu"}
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6 custom-scrollbar">
          {navGroups.map((group, idx) => (
            <div key={idx}>
              {isSidebarOpen && group.title && (
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {group.title}
                </p>
              )}
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.path, item.exact);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group relative text-sm",
                        active
                          ? "bg-sky-50/90 text-sky-700 font-semibold shadow-2xs border border-sky-100/80"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          active
                            ? "text-sky-600"
                            : "text-slate-400 group-hover:text-slate-600"
                        )}
                      />
                      {isSidebarOpen && (
                        <span className="whitespace-nowrap truncate">{item.name}</span>
                      )}
                      {!isSidebarOpen && (
                        <div className="absolute left-14 bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-md font-medium">
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

        {/* Sidebar Footer Info */}
        {isSidebarOpen && (
          <div className="p-3 m-3 rounded-xl bg-gradient-to-br from-sky-50/80 to-indigo-50/40 border border-sky-100/60 text-xs">
            <div className="flex items-center gap-1.5 text-sky-800 font-semibold mb-1">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              <span>Layanan Terpadu</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Admisi rawat jalan terintegrasi poli, rekam medis, dan antrean.
            </p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Top Frosted Glass Header */}
        <header className="h-16 glass-panel border-b border-slate-200/70 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-10 shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm">
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Activity className="h-4 w-4" />
            </div>
            <span className="text-slate-400 text-xs font-medium">Admisi</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800 tracking-tight">
              {currentNav?.name || "Dashboard"}
            </span>
          </div>

          {/* Right Header User Strip */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:bg-slate-100 hover:text-slate-700 relative rounded-xl h-9 w-9"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-sky-600 rounded-full ring-2 ring-white" />
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-0.5" />

            <div className="flex items-center gap-3 pl-2 pr-1.5 py-1 rounded-full border border-slate-200/80 bg-white/90 shadow-2xs hover:border-slate-300 transition-all">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                  {role ? role.substring(0, 1).toUpperCase() : "A"}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="text-left hidden md:block leading-tight">
                <p className="text-xs font-bold text-slate-800">Staf Admisi</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  ID: {userId ? userId.substring(0, 8) : "ADMIN"}
                </p>
              </div>

              <div className="h-6 w-px bg-slate-100 hidden md:block mx-0.5" />

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                title="Keluar (Logout)"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <div className="flex-1 overflow-auto p-6 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

