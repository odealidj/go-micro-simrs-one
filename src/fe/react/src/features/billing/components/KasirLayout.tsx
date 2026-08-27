import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  Wallet,
  LayoutDashboard,
  FileText,
  Receipt,
  LogOut,
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Sparkles,
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
      { name: "Dashboard", path: "/kasir", exact: true, icon: LayoutDashboard },
    ],
  },
  {
    title: "Tagihan & Transaksi",
    items: [
      { name: "Antrean Tagihan", path: "/kasir/antrean", icon: Receipt },
      { name: "Terminal Bayar", path: "/kasir/bayar", icon: CreditCard },
      { name: "Riwayat Pembayaran", path: "/kasir/riwayat-pembayaran", icon: FileText },
    ],
  },
  {
    title: "Laporan & Rekap",
    items: [
      { name: "Rekap Penerimaan", path: "/kasir/laporan", icon: FileText },
    ],
  },
];

export function KasirLayout() {
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
    <div className="min-h-screen bg-[#f8fafc] flex antialiased text-slate-800">
      {/* Dynamic Modern Sidebar */}
      <aside
        className={cn(
          "bg-white/95 backdrop-blur-xl border-r border-slate-200/80 transition-all duration-300 ease-in-out flex flex-col z-20 shrink-0 shadow-sm",
          !isSidebarOpen ? "w-[76px]" : "w-64"
        )}
      >
        {/* Brand System Title */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-slate-100/80 relative px-4",
            !isSidebarOpen ? "justify-center px-0" : "justify-between"
          )}
        >
          <div className={cn("flex items-center gap-3 overflow-hidden", !isSidebarOpen && "justify-center")}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/25 shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            {isSidebarOpen && (
              <div className="leading-tight">
                <h1 className="font-extrabold text-sm tracking-tight text-slate-900">Codina SIMRS</h1>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                  Kasir & Pembayaran
                </span>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all",
              !isSidebarOpen ? "absolute -right-3.5 top-5 bg-white border border-slate-200 shadow-sm z-30" : ""
            )}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Kecilkan Sidebar" : "Buka Sidebar"}
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation Group Items */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6 custom-scrollbar">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
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
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-xs font-semibold",
                        active
                          ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/20 font-bold"
                          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          active ? "text-white" : "text-slate-400 group-hover:text-slate-700"
                        )}
                      />
                      {isSidebarOpen && <span className="truncate">{item.name}</span>}
                      {!isSidebarOpen && (
                        <div className="absolute left-16 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-800">
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

        {/* Mini Service Badge at Bottom */}
        {isSidebarOpen && (
          <div className="p-3 m-3 rounded-xl bg-gradient-to-br from-amber-50/90 to-orange-50/50 border border-amber-200/60 text-xs">
            <div className="flex items-center gap-1.5 text-amber-900 font-semibold mb-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Kasir Terpadu</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Transaksi pembayaran terintegrasi poli, tindakan medis, dan farmasi.
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
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-slate-400 text-xs font-medium">Kasir</span>
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
              title="Notifikasi"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-amber-500 rounded-full ring-2 ring-white" />
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-0.5" />

            <div className="flex items-center gap-3 pl-2 pr-1.5 py-1 rounded-full border border-slate-200/80 bg-white/90 shadow-2xs hover:border-slate-300 transition-all">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                  {role ? role.substring(0, 1).toUpperCase() : "K"}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="text-left hidden md:block leading-tight">
                <p className="text-xs font-bold text-slate-800">Staf Kasir</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  ID: {userId ? userId.substring(0, 8) : "KASIR"}
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
        <div className="flex-1 overflow-auto p-6 sm:p-8 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
