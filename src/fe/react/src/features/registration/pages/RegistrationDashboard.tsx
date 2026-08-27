import { useState, useEffect } from "react";
import { Users, UserPlus, Clock, Stethoscope, Server, Activity, UserCog, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { AdmisiPageHeader } from "../components/AdmisiPageHeader";
import { admisiTheme, getAdmisiStatusBadge } from "../theme";

const ServiceStatusBadge = ({ status }: { status: string }) => {
  const badge = getAdmisiStatusBadge(status);
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", badge.className)}>
      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", badge.dotClass)}></div>
      {badge.label}
    </div>
  );
};

interface DashboardMetrics {
  new_patients: number;
  old_patients: number;
  active_polis: number;
  active_doctors: number;
  active_nurses: number;
  wait_times: Record<string, number>;
  weekly_visits: Record<string, number>;
}

export function RegistrationDashboard() {
  const [systemHealth, setSystemHealth] = useState<Record<string, any>>({});
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await api.get("/system/health/basic");
        if (response.data?.success) {
          setSystemHealth(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch system health", err);
      }
    };

    const fetchMetrics = async () => {
      try {
        const response = await api.get("/registrations/dashboard/metrics");
        if (response.data?.success) {
          setMetrics(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard metrics", err);
      }
    };

    fetchHealth();
    fetchMetrics();
    const interval = setInterval(() => {
      fetchHealth();
      fetchMetrics();
    }, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const totalPatients = (metrics?.new_patients || 0) + (metrics?.old_patients || 0);

  const stats = [
    {
      title: "Total Pasien Hari Ini",
      value: totalPatients.toString(),
      icon: Users,
      bgColor: "bg-sky-50 text-sky-600 border border-sky-100",
    },
    {
      title: "Pasien Baru",
      value: metrics?.new_patients?.toString() || "0",
      icon: UserPlus,
      bgColor: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    },
    {
      title: "Pasien Lama",
      value: metrics?.old_patients?.toString() || "0",
      icon: Activity,
      bgColor: "bg-indigo-50 text-indigo-600 border border-indigo-100",
    },
    {
      title: "Poli Aktif",
      value: metrics?.active_polis?.toString() || "0",
      icon: Stethoscope,
      bgColor: "bg-purple-50 text-purple-600 border border-purple-100",
    },
    {
      title: "Dokter Bertugas",
      value: metrics?.active_doctors?.toString() || "0",
      icon: UserCog,
      bgColor: "bg-amber-50 text-amber-600 border border-amber-100",
    },
    {
      title: "Perawat Bertugas",
      value: metrics?.active_nurses?.toString() || "0",
      icon: Activity,
      bgColor: "bg-teal-50 text-teal-600 border border-teal-100",
    }
  ];

  const weeklyVisitsData = Array.isArray(metrics?.weekly_visits)
    ? metrics.weekly_visits
        .map((item: any) => ({
          date: item.date,
          kunjungan: item.total_visits || 0
        }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
    : [];

  const waitTimesData = metrics?.wait_times
    ? Object.keys(metrics.wait_times).map(poli => ({
        poli,
        waktuTunggu: metrics.wait_times[poli]
      })).sort((a,b) => b.waktuTunggu - a.waktuTunggu)
    : [];

  return (
    <div className={admisiTheme.layout.container}>
      {/* Header */}
      <AdmisiPageHeader
        title="Dashboard Pendaftaran"
        description="Ringkasan aktivitas kunjungan pasien, utilitas poliklinik, dan integritas sistem."
        badge="Monitoring Real-Time"
        actions={
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 px-3.5 py-2 rounded-xl shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Sinkronisasi Otomatis</span>
          </div>
        }
      />

      {/* SERVICE HEALTH STATUS */}
      <div className="space-y-3">
        <h3 className={admisiTheme.typography.sectionTitle}>Status Layanan SIMRS</h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { key: "api_gateway", label: "API Gateway" },
            { key: "patient_service", label: "Patient Service" },
            { key: "registration_service", label: "Registration Service" },
            { key: "billing_service", label: "Billing Service" },
          ].map((srv) => (
            <div key={srv.key} className="card-premium p-4 flex flex-col items-center text-center justify-center space-y-2">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <Server className={`h-5 w-5 ${systemHealth[srv.key] === "SERVING" ? "text-emerald-600" : "text-rose-500"}`} />
              </div>
              <div className="text-xs font-bold text-slate-800">{srv.label}</div>
              <ServiceStatusBadge status={systemHealth[srv.key] || "DOWN"} />
            </div>
          ))}
        </div>
      </div>

      {/* METRIC STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card-premium p-5 col-span-1 lg:col-span-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stat.title}</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{stat.value}</p>
              </div>
              <div className={cn("p-3 rounded-xl shadow-2xs shrink-0", stat.bgColor)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-premium p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
              <CalendarDays className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Grafik Kunjungan 5 Hari Terakhir
            </h3>
          </div>
          <div className="h-[280px] w-full pt-2">
            {weeklyVisitsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyVisitsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                  />
                  <Line type="monotone" dataKey="kunjungan" stroke="#0284c7" strokeWidth={3} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data kunjungan</div>
            )}
          </div>
        </div>

        <div className="card-premium p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Rata-rata Waktu Tunggu per Poli (Menit)
            </h3>
          </div>
          <div className="h-[280px] w-full pt-2">
            {waitTimesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waitTimesData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <YAxis dataKey="poli" type="category" tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} width={80} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                    cursor={{fill: '#f8fafc'}}
                  />
                  <Bar dataKey="waktuTunggu" fill="#0284c7" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data waktu tunggu</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

