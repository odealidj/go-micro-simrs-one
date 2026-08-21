import { useState, useEffect } from "react";
import { Users, UserPlus, Clock, Stethoscope, Server, Activity, ArrowRight, UserCog, CalendarClock, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const ServiceStatusBadge = ({ status }: { status: string }) => {
  if (status === "SERVING" || status === "UP") {
    return (
      <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></div>
        Online
      </div>
    );
  }
  return (
    <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800">
      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></div>
      Offline
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
      title: "Total Pasien",
      value: totalPatients.toString(),
      icon: Users,
      bgColor: "bg-blue-100",
      color: "text-blue-600",
    },
    {
      title: "Pasien Baru",
      value: metrics?.new_patients?.toString() || "0",
      icon: UserPlus,
      bgColor: "bg-emerald-100",
      color: "text-emerald-600",
    },
    {
      title: "Pasien Lama",
      value: metrics?.old_patients?.toString() || "0",
      icon: Activity,
      bgColor: "bg-indigo-100",
      color: "text-indigo-600",
    },
    {
      title: "Poli Aktif",
      value: metrics?.active_polis?.toString() || "0",
      icon: Stethoscope,
      bgColor: "bg-purple-100",
      color: "text-purple-600",
    },
    {
      title: "Dokter Aktif",
      value: metrics?.active_doctors?.toString() || "0",
      icon: UserCog,
      bgColor: "bg-amber-100",
      color: "text-amber-600",
    },
    {
      title: "Perawat Aktif",
      value: metrics?.active_nurses?.toString() || "0",
      icon: Activity,
      bgColor: "bg-rose-100",
      color: "text-rose-600",
    }
  ];

  const weeklyVisitsData = Array.isArray(metrics?.weekly_visits)
    ? metrics.weekly_visits.map((item: any) => ({
        date: item.date,
        kunjungan: item.total_visits || 0
      }))
    : [];

  const waitTimesData = metrics?.wait_times
    ? Object.keys(metrics.wait_times).map(poli => ({
        poli,
        waktuTunggu: metrics.wait_times[poli]
      })).sort((a,b) => b.waktuTunggu - a.waktuTunggu)
    : [];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Pendaftaran</h2>
        <p className="text-slate-500 mt-1">Ringkasan aktivitas rawat jalan dan status sistem.</p>
      </div>

      {/* SERVICE HEALTH STATUS */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Service Health Status</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
          {[
            { key: "api_gateway", label: "API Gateway" },
            { key: "patient_service", label: "Patient" },
            { key: "registration_service", label: "Registration" },
            { key: "billing_service", label: "Billing" },
          ].map((srv) => (
            <Card key={srv.key} className="shadow-sm border-slate-200">
              <CardContent className="p-4 flex flex-col items-center text-center justify-center space-y-2">
                <Server className={`h-6 w-6 ${systemHealth[srv.key] === "SERVING" ? "text-emerald-500" : "text-rose-500"}`} />
                <div className="text-xs font-semibold text-slate-700">{srv.label}</div>
                <ServiceStatusBadge status={systemHealth[srv.key] || "DOWN"} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden col-span-1 lg:col-span-2">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                </div>
                <div className={cn("p-2.5 rounded-lg", stat.bgColor, stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center">
              <CalendarDays className="h-4 w-4 mr-2 text-blue-500" />
              Grafik Kunjungan 5 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {weeklyVisitsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyVisitsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="kunjungan" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data kunjungan</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center">
              <Clock className="h-4 w-4 mr-2 text-amber-500" />
              Rata-rata Waktu Tunggu per Poli (Menit)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {waitTimesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waitTimesData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis dataKey="poli" type="category" tick={{fontSize: 12}} tickLine={false} axisLine={false} width={80} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{fill: '#f1f5f9'}}
                    />
                    <Bar dataKey="waktuTunggu" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Belum ada data waktu tunggu</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
