import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  FlaskConical,
  LayoutDashboard,
  ClipboardList,
  PackageCheck,
  LogOut,
  Bell,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      { name: "Dashboard", path: "/apoteker", exact: true, icon: LayoutDashboard },
    ],
  },
  {
    title: "Resep & Dispensing",
    items: [
      { name: "Resep Masuk", path: "/apoteker/resep", icon: ClipboardList },
      { name: "Proses Dispensing", path: "/apoteker/dispense", icon: PackageCheck },
    ],
  },
];

export function ApotekerLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, logout } = useAuth();

  const handleLogout = () => { logout(); navigate("/login"); };

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const currentPageName =
    navGroups.flatMap((g) => g.items).find((item) => isActive(item.path, item.exact))?.name || "Farmasi";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={cn("bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20", !isSidebarOpen ? "w-20" : "w-64")}>
        <div className={cn("flex items-center h-16 border-b border-slate-200 relative", !isSidebarOpen ? "justify-center" : "px-4 justify-between")}>
          {!isSidebarOpen ? (
            <FlaskConical className="h-8 w-8 text-violet-600" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-lg">
                <FlaskConical className="h-6 w-6 text-violet-600" />
              </div>
              <div className="leading-none">
                <h1 className="font-bold text-base text-slate-800 tracking-tight">Mini SIMRS</h1>
                <span className="text-[10px] font-semibold text-violet-600 tracking-wider uppercase">Instalasi Farmasi</span>
              </div>
            </div>
          )}
          <Button
            variant="ghost" size="icon"
            className={cn("h-7 w-7 text-slate-400 hover:bg-slate-100 rounded-full", !isSidebarOpen ? "absolute -right-3.5 top-4 bg-white border border-slate-200 shadow-sm" : "")}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map((group, idx) => (
            <div key={idx}>
              {isSidebarOpen && group.title && (
                <p className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.title}</p>
              )}
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.path, item.exact);
                  return (
                    <Link key={item.path} to={item.path}
                      className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative",
                        active ? "bg-violet-50 text-violet-700 font-medium" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", active ? "text-violet-600" : "text-slate-400 group-hover:text-slate-600")} />
                      {isSidebarOpen && <span className="text-sm whitespace-nowrap">{item.name}</span>}
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

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Activity className="h-4 w-4 text-violet-500" />
            <span className="font-medium text-slate-700">{currentPageName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
            </Button>
            <div className="h-8 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full border border-slate-200 bg-white shadow-sm">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-400 flex items-center justify-center text-white font-bold text-sm">A</div>
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-800 leading-tight">Asisten Apoteker</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">ID: {userId ? userId.substring(0, 8) : "—"}</p>
              </div>
              <div className="h-8 w-px bg-slate-100 hidden md:block mx-1" />
              <Button variant="ghost" size="icon" onClick={handleLogout}
                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6"><Outlet /></div>
      </main>
    </div>
  );
}
