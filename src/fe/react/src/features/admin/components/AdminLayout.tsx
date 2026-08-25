import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { 
  Users, LogOut, LayoutDashboard, ShieldCheck, 
  Stethoscope, UserRound, Building2, Map,
  BookOpen, Pill, Activity, ClipboardList, GitFork,
  ChevronLeft, ChevronRight, ChevronDown, Bell, Bot,
  Settings, FolderTree
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  items: NavItem[];
}

export function AdminLayout() {
  const { logout, userId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navGroups: NavGroup[] = [
    {
      id: "system",
      title: "Sistem & Pengaturan",
      icon: Settings,
      items: [
        { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
        { name: "Users & Staff", path: "/admin/users", icon: Users },
        { name: "Role & Akses", path: "/admin/master/role", icon: ShieldCheck },
        { name: "Pengaturan AI", path: "/admin/ai-settings", icon: Bot },
      ],
    },
    {
      id: "hrd",
      title: "Ketenagaan & Unit",
      icon: Users,
      items: [
        { name: "Data Dokter", path: "/admin/master/dokter", icon: Stethoscope },
        { name: "Data Perawat", path: "/admin/master/perawat", icon: UserRound },
        { name: "Data Poliklinik", path: "/admin/master/poliklinik", icon: Building2 },
        { name: "Assign Dokter", path: "/admin/master/assign-dokter", icon: Stethoscope },
        { name: "Assign Perawat", path: "/admin/master/assign-perawat", icon: UserRound },
      ],
    },
    {
      id: "emr",
      title: "Medis & Terminologi",
      icon: Activity,
      items: [
        { name: "KBM", path: "/admin/master/kbm", icon: BookOpen },
        { name: "KBM - Poliklinik", path: "/admin/master/assign-kbm", icon: Map },
        { name: "Katalog ICD-10", path: "/admin/master/icd10", icon: ClipboardList },
        { name: "ICD10 - Poliklinik", path: "/admin/master/assign-icd10", icon: Map },
        { name: "Katalog ICD-9", path: "/admin/master/icd9", icon: ClipboardList },
        { name: "Katalog SNOMED-CT", path: "/admin/master/snomed", icon: GitFork },
        { name: "Tindakan & Tarif", path: "/admin/master/tindakan", icon: Activity },
        { name: "Tindakan - Poliklinik", path: "/admin/master/assign-tindakan", icon: Map },
      ],
    },
    {
      id: "pharmacy",
      title: "Farmasi & Standarisasi",
      icon: Pill,
      items: [
        { name: "Inventaris Obat", path: "/admin/master/obat", icon: Pill },
        { name: "Katalog KFA (Kemenkes)", path: "/admin/master/kfa", icon: BookOpen },
        { name: "Katalog DPHO / FORNAS", path: "/admin/master/dpho", icon: ShieldCheck },
        { name: "Obat - Poliklinik", path: "/admin/master/assign-obat", icon: Map },
      ],
    },
  ];

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    system: true,
    hrd: false,
    emr: true,
    pharmacy: true,
  });

  // Auto-expand group that contains active route
  useEffect(() => {
    navGroups.forEach((group) => {
      const hasActiveItem = group.items.some((item) =>
        item.path === "/admin"
          ? location.pathname === "/admin"
          : location.pathname.startsWith(item.path)
      );
      if (hasActiveItem) {
        setExpandedGroups((prev) => ({
          ...prev,
          [group.id]: true,
        }));
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    if (!isSidebarOpen) setIsSidebarOpen(true);
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleAll = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      nextState[g.id] = expand;
    });
    setExpandedGroups(nextState);
  };

  const allExpanded = Object.values(expandedGroups).filter(Boolean).length === navGroups.length;

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

        {/* Global Expand/Collapse Action Toolbar (Only when expanded) */}
        {isSidebarOpen && (
          <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-slate-100/80 text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-slate-400" />
              Menu Navigasi
            </span>
            <button
              onClick={() => toggleAll(!allExpanded)}
              className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer font-semibold"
            >
              {allExpanded ? "Tutup Semua" : "Buka Semua"}
            </button>
          </div>
        )}

        {/* Sidebar Navigation */}
        <div className="flex-1 py-3 overflow-y-auto px-2 space-y-2.5 custom-scrollbar">
          {navGroups.map((group) => {
            const isExpanded = !!expandedGroups[group.id];
            const hasActiveChild = group.items.some((item) =>
              item.path === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.path)
            );

            return (
              <div key={group.id} className="space-y-1">
                {/* Group Accordion Header */}
                {isSidebarOpen ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      hasActiveChild && !isExpanded
                        ? "bg-blue-50/80 text-blue-700 border border-blue-200/60"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <group.icon
                        className={`h-4 w-4 shrink-0 ${
                          hasActiveChild ? "text-blue-600" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{group.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                          hasActiveChild
                            ? "bg-blue-200/60 text-blue-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {group.items.length}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-slate-600" : ""
                        }`}
                      />
                    </div>
                  </button>
                ) : (
                  /* Collapsed Mini Sidebar Group Trigger with Floating Submenu */
                  <div className="relative group flex justify-center py-1">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
                        hasActiveChild
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                      title={group.title}
                    >
                      <group.icon className="h-5 w-5" />
                    </button>

                    {/* Flyout Submenu Popover on Mini Sidebar */}
                    <div className="absolute left-14 top-0 bg-white border border-slate-200 shadow-xl rounded-xl p-2 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                      <div className="px-2 py-1 mb-1 border-b border-slate-100 font-bold text-xs text-slate-800 flex items-center justify-between">
                        <span>{group.title}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {group.items.length}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const isActive =
                            item.path === "/admin"
                              ? location.pathname === "/admin"
                              : location.pathname.startsWith(item.path);

                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                isActive
                                  ? "bg-blue-50 text-blue-700 font-semibold"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              }`}
                            >
                              <item.icon
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isActive ? "text-blue-600" : "text-slate-400"
                                }`}
                              />
                              <span className="truncate">{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-items tree list (when expanded) */}
                {isSidebarOpen && isExpanded && (
                  <nav className="ml-3 pl-3 border-l-2 border-slate-100 space-y-0.5 my-1 transition-all duration-200">
                    {group.items.map((item) => {
                      const isActive =
                        (item.path === "/admin" && location.pathname === "/admin") ||
                        (item.path !== "/admin" && location.pathname.startsWith(item.path));

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors group relative cursor-pointer ${
                            isActive
                              ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 -ml-[14px] pl-[22px]"
                              : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                          }`}
                        >
                          <item.icon
                            className={`h-4 w-4 shrink-0 mr-2.5 ${
                              isActive
                                ? "text-blue-600"
                                : "text-slate-400 group-hover:text-slate-600"
                            }`}
                          />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      );
                    })}
                  </nav>
                )}
              </div>
            );
          })}
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
