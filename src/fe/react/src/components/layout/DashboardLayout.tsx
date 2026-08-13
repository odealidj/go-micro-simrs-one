import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  Activity, 
  LayoutDashboard, 
  UserPlus, 
  ListOrdered, 
  Settings, 
  Menu,
  Bell,
  Search,
  ChevronLeft,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: UserPlus, label: "Pendaftaran Pasien", path: "/registration/new" },
  { icon: ListOrdered, label: "Manajemen Antrean", path: "/registration/queue" },
  { icon: Settings, label: "Pengaturan", path: "/settings" },
];

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div 
      className="min-h-screen w-full flex bg-slate-900 overflow-hidden"
      style={{
        backgroundImage: 'url("/bg-medical-tech.png")', // Using the same futuristic background
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Sidebar */}
      <aside 
        className={cn(
          "relative z-20 flex flex-col h-full bg-black/40 backdrop-blur-xl border-r border-white/10 transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-72" : "w-20"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-white/10">
          <div className={cn("flex items-center gap-3 overflow-hidden transition-opacity duration-300", !isSidebarOpen && "opacity-0 w-0 hidden")}>
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Activity className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white whitespace-nowrap">Codina Mini SIMRS</h1>
              <p className="text-[10px] text-blue-300 font-semibold tracking-wider uppercase">Outpatient V2.0</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white/70 hover:text-white hover:bg-white/10 mx-auto"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group cursor-pointer",
                    isActive 
                      ? "bg-blue-600/30 text-blue-400 border border-blue-500/30" 
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                  )}
                  title={!isSidebarOpen ? item.label : undefined}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200")} />
                  <span className={cn(
                    "font-medium whitespace-nowrap transition-all duration-300", 
                    !isSidebarOpen && "hidden opacity-0"
                  )}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (User Info) */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border border-white/20 shrink-0">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className={cn("overflow-hidden transition-all duration-300", !isSidebarOpen && "hidden opacity-0")}>
              <p className="text-sm font-semibold text-white truncate">Dr. Ali Ube</p>
              <p className="text-xs text-slate-400 truncate">Poli Umum</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-20 bg-black/20 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-8">
          <div className="flex items-center w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Cari pasien, antrean, atau rekam medis..." 
                className="w-full pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 rounded-full h-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
            </Button>
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
