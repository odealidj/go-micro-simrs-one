import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Server, 
  Database,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PackageX,
  MailWarning
} from "lucide-react";
import { Link } from "react-router-dom";
import { Folder, HeartPulse, ShieldAlert, ActivitySquare, Pill, Stethoscope, UserPlus, CalendarDays } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
  Area
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const InlineBreakdown = ({ items }: { items?: { label: string; count: number }[] }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500 font-medium">
      {items.map((item, idx) => (
        <span key={idx} className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
          {item.label}: {item.count}
        </span>
      ))}
    </div>
  );
};

export function AdminDashboard() {
  const [systemHealth, setSystemHealth] = useState<Record<string, any>>({});
  const [usersPending, setUsersPending] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  
  const [activeTab, setActiveTab] = useState<"infrastructure" | "data">("infrastructure");
  const [masterMetrics, setMasterMetrics] = useState<any>({});
  const [dbTrend, setDbTrend] = useState<{ time: string; activeConn: number; tps: number; redisConn: number; redisMem: number }[]>([]);

  // We now fetch real Outbox metrics from systemHealth, no longer needing mockOutbox

  const fetchHealth = async () => {
    try {
      const response = await api.get("/admin/system/health");
      if (response.data.success) {
        const data = response.data.data;
        setSystemHealth(data);
        setDbTrend(prev => {
          const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          const newEntry = {
            time: now,
            activeConn: Number(data.pg_active_connections) || 0,
            tps: Number(data.pg_xact_commit) || 0,
            redisConn: Number(data.redis_connected_clients) || 0,
            redisMem: Number(data.redis_memory_used_mb) || 0
          };
          const updated = [...prev, newEntry];
          // Keep last 15 data points
          if (updated.length > 15) return updated.slice(updated.length - 15);
          return updated;
        });
      }
    } catch (error) {
      toast.error("Gagal mengambil data system health");
    }
  };

  const fetchUsersStats = async () => {
    try {
      // Just a quick pull to count pending users. 
      const response = await api.get("/admin/users?page=1&page_size=500");
      if (response.data.success) {
        const allUsers: any[] = response.data.data?.users || [];
        setUsersTotal(response.data.data?.total_count || allUsers.length);
        setUsersPending(allUsers.filter((u) => u.status === "PENDING").length);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMasterMetrics = async () => {
    try {
      const response = await api.get("/admin/system/master-metrics");
      if (response.data.success) {
        setMasterMetrics(response.data.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchUsersStats();
    fetchMasterMetrics();
    
    // Auto refresh health every 30s
    const interval = setInterval(() => {
      fetchHealth();
      fetchMasterMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const ServiceStatusBadge = ({ status }: { status: string }) => {
    if (status === "SERVING") {
      return (
        <span className="inline-flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Online
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
        <XCircle className="w-3 h-3 mr-1" /> Offline
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Dashboard</h1>
        <p className="text-slate-500">Monitor kesehatan infrastruktur, antrean pesan, dan integritas data.</p>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex space-x-1 p-1 bg-slate-100/50 rounded-lg max-w-sm">
        <button
          onClick={() => setActiveTab("infrastructure")}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === "infrastructure"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          }`}
        >
          <Server className="w-4 h-4 inline-block mr-2 mb-0.5" />
          Infrastructure & Health
        </button>
        <button
          onClick={() => setActiveTab("data")}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
            activeTab === "data"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          }`}
        >
          <Folder className="w-4 h-4 inline-block mr-2 mb-0.5" />
          Data & Operations
        </button>
      </div>

      {activeTab === "infrastructure" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* TIER 1: CRITICAL SYSTEM HEALTH */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Service Health Status</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {[
            { key: "api_gateway", label: "API Gateway" },
            { key: "auth_service", label: "Auth (HRD)" },
            { key: "patient_service", label: "Patient" },
            { key: "registration_service", label: "Registration" },
            { key: "emr_service", label: "EMR" },
            { key: "pharmacy_service", label: "Pharmacy" },
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

      {/* TIER 2: PROMETHEUS METRICS (HEADLESS) */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 mt-6">Metrics & Telemetry (Prometheus)</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Activity className="w-4 h-4 mr-2 text-emerald-500" />
                Service SLA (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">
                {systemHealth["sla_percent"] === "N/A" || !systemHealth["sla_percent"] ? "N/A" : `${systemHealth["sla_percent"]}%`}
              </div>
              <p className="text-xs text-slate-500 mt-1">Rata-rata Uptime historis</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Server className="w-4 h-4 mr-2 text-blue-500" />
                Global CPU Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">
                {systemHealth["cpu_usage_percent"] === "N/A" || !systemHealth["cpu_usage_percent"] ? "N/A" : `${systemHealth["cpu_usage_percent"]}%`}
              </div>
              <p className="text-xs text-slate-500 mt-1">Total beban CPU 5 menit terakhir</p>
              {systemHealth["exporter_cpu_percent"] && systemHealth["exporter_cpu_percent"] !== "N/A" && (
                <p className="text-[10px] text-blue-400 mt-0.5">Termasuk {systemHealth["exporter_cpu_percent"]}% Exporter Overhead</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-indigo-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Database className="w-4 h-4 mr-2 text-indigo-500" />
                Global RAM Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">
                {systemHealth["ram_usage_mb"] === "N/A" || !systemHealth["ram_usage_mb"] ? "N/A" : `${systemHealth["ram_usage_mb"]} MB`}
              </div>
              <p className="text-xs text-slate-500 mt-1">Total memori aktif (Resident)</p>
              {systemHealth["exporter_ram_mb"] && systemHealth["exporter_ram_mb"] !== "N/A" && (
                <p className="text-[10px] text-indigo-400 mt-0.5">Termasuk {systemHealth["exporter_ram_mb"]} MB Exporter Overhead</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-rose-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 text-rose-500" />
                API Error Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">
                {systemHealth["http_error_rate"] === "N/A" || !systemHealth["http_error_rate"] ? "N/A" : `${systemHealth["http_error_rate"]} req/s`}
              </div>
              <p className="text-xs text-slate-500 mt-1">HTTP 5xx (5 menit terakhir)</p>
            </CardContent>
          </Card>
        </div>

        {/* MICROSERVICES BREAKDOWN */}
        <div className="mt-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Microservices Resource Allocation</h3>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">Service</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">CPU Usage (%)</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">RAM Usage (MB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(() => {
                  const cpuList = Array.isArray(systemHealth["microservices_cpu"]) ? systemHealth["microservices_cpu"] : [];
                  const ramList = Array.isArray(systemHealth["microservices_ram"]) ? systemHealth["microservices_ram"] : [];
                  
                  const services = [...new Set([...cpuList.map(item => item.job), ...ramList.map(item => item.job)])];
                  
                  return services.map(srv => {
                    const cpu = cpuList.find(c => c.job === srv)?.value || "0";
                    const ram = ramList.find(r => r.job === srv)?.value || "0";
                    return (
                      <tr key={srv}>
                        <td className="px-4 py-2 font-medium text-slate-700">{srv}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{cpu}%</td>
                        <td className="px-4 py-2 text-right text-slate-600">{ram} MB</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* DATABASE METRICS */}
        <div className="mt-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Database Health & Hardware</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="shadow-sm border border-slate-200">
              <CardHeader className="bg-slate-50 py-3 border-b border-slate-100">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Database className="w-4 h-4 mr-2 text-blue-600" /> PostgreSQL
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Active Connections</span>
                  <span className="font-semibold text-slate-700">{typeof systemHealth["pg_active_connections"] === "string" ? systemHealth["pg_active_connections"] : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Transactions / sec</span>
                  <span className="font-semibold text-slate-700">{typeof systemHealth["pg_xact_commit"] === "string" ? systemHealth["pg_xact_commit"] : "N/A"}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between">
                  <span className="text-sm text-slate-500 flex items-center"><Server className="w-3 h-3 mr-1" /> Hardware CPU</span>
                  <span className="font-semibold text-slate-700">
                    {(() => {
                      const arr = Array.isArray(systemHealth["db_hw_cpu"]) ? systemHealth["db_hw_cpu"] : [];
                      return arr.find(a => a.name?.includes("_postgres_"))?.value || "N/A";
                    })()}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500 flex items-center"><Server className="w-3 h-3 mr-1" /> Hardware RAM</span>
                  <span className="font-semibold text-slate-700">
                    {(() => {
                      const arr = Array.isArray(systemHealth["db_hw_ram"]) ? systemHealth["db_hw_ram"] : [];
                      return arr.find(a => a.name?.includes("_postgres_"))?.value || "N/A";
                    })()} MB
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-slate-200">
              <CardHeader className="bg-slate-50 py-3 border-b border-slate-100">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Database className="w-4 h-4 mr-2 text-rose-600" /> Redis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Connected Clients</span>
                  <span className="font-semibold text-slate-700">{typeof systemHealth["redis_connected_clients"] === "string" ? systemHealth["redis_connected_clients"] : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Internal RAM Used</span>
                  <span className="font-semibold text-slate-700">{typeof systemHealth["redis_memory_used_mb"] === "string" ? systemHealth["redis_memory_used_mb"] : "N/A"} MB</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between">
                  <span className="text-sm text-slate-500 flex items-center"><Server className="w-3 h-3 mr-1" /> Hardware CPU</span>
                  <span className="font-semibold text-slate-700">
                    {(() => {
                      const arr = Array.isArray(systemHealth["db_hw_cpu"]) ? systemHealth["db_hw_cpu"] : [];
                      return arr.find(a => a.name?.includes("_redis_"))?.value || "N/A";
                    })()}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500 flex items-center"><Server className="w-3 h-3 mr-1" /> Hardware RAM</span>
                  <span className="font-semibold text-slate-700">
                    {(() => {
                      const arr = Array.isArray(systemHealth["db_hw_ram"]) ? systemHealth["db_hw_ram"] : [];
                      return arr.find(a => a.name?.includes("_redis_"))?.value || "N/A";
                    })()} MB
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* TIER 3: QUEUE & DATA SYNC */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Database className="w-4 h-4 mr-2 text-blue-500" />
              Redis / Message Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-slate-700">
                {systemHealth["redis"] === "SERVING" ? "Connected" : "Disconnected"}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Status koneksi Redis Streams</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <MailWarning className="w-4 h-4 mr-2 text-amber-500" />
              Unprocessed Outbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <div className="text-2xl font-bold text-slate-700">
                {(Number(systemHealth["emr_outbox_unprocessed"]) || 0) + (Number(systemHealth["pharmacy_outbox_unprocessed"]) || 0)}
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Menumpuk
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">EMR ({Number(systemHealth["emr_outbox_unprocessed"]) || 0}) | Farmasi ({Number(systemHealth["pharmacy_outbox_unprocessed"]) || 0})</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-rose-500" />
              Failed / Dead Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-slate-700">{(Number(systemHealth["emr_outbox_failed"]) || 0) + (Number(systemHealth["pharmacy_outbox_failed"]) || 0)}</div>
              <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                Butuh Pengecekan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Event konsumen gagal diproses</p>
          </CardContent>
        </Card>
      </div>


      
      {/* TIER 4: INFRASTRUCTURE CHARTS */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-6 mb-3">Analitik Infrastruktur (Pro)</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {/* CHART 1: Outbox Load */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Beban Antrean Pesan (Outbox)</CardTitle>
              <CardDescription className="text-xs">Perbandingan event belum diproses & gagal</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'EMR', Unprocessed: Number(systemHealth.emr_outbox_unprocessed) || 0, Failed: Number(systemHealth.emr_outbox_failed) || 0 },
                  { name: 'Pharmacy', Unprocessed: Number(systemHealth.pharmacy_outbox_unprocessed) || 0, Failed: Number(systemHealth.pharmacy_outbox_failed) || 0 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Unprocessed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Failed" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* CHART 2: Resource Consumption Distribution */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resource Distribution</CardTitle>
              <CardDescription className="text-xs">Konsumsi CPU (%) vs RAM (MB) per Microservice</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={(() => {
                  const cpuMap = new Map();
                  const ramMap = new Map();
                  if (Array.isArray(systemHealth.microservices_cpu)) {
                    systemHealth.microservices_cpu.forEach((i: any) => cpuMap.set(i.job, parseFloat(i.value) || 0));
                  }
                  if (Array.isArray(systemHealth.microservices_ram)) {
                    systemHealth.microservices_ram.forEach((i: any) => ramMap.set(i.job, parseFloat(i.value) || 0));
                  }
                  const jobs = new Set([...cpuMap.keys(), ...ramMap.keys()]);
                  return Array.from(jobs).map(job => ({
                    name: String(job).replace('-service', '').replace('api-', ''),
                    cpu: cpuMap.get(job) || 0,
                    ram: ramMap.get(job) || 0
                  }));
                })()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} orientation="left" />
                  <YAxis yAxisId="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} orientation="right" />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar yAxisId="left" dataKey="ram" name="RAM (MB)" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="cpu" name="CPU (%)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* CHART 3: Database Stress Correlation */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium">PostgreSQL Stress Correlation</CardTitle>
              <CardDescription className="text-xs">Active Conn vs Transactions/sec (TPS)</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dbTrend.length > 0 ? dbTrend : [
                  { time: 'T-1', activeConn: 0, tps: 0, redisConn: 0, redisMem: 0 },
                  { time: 'T-0', activeConn: Number(systemHealth.pg_active_connections) || 0, tps: Number(systemHealth.pg_xact_commit) || 0, redisConn: 0, redisMem: 0 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} orientation="left" />
                  <YAxis yAxisId="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} orientation="right" />
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Line yAxisId="left" type="stepAfter" dataKey="activeConn" name="Connections" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Area yAxisId="right" type="monotone" dataKey="tps" name="Transactions/sec" fill="#10b981" stroke="#10b981" fillOpacity={0.2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* CHART 4: Redis Cache Utilization */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Redis Cache Utilization</CardTitle>
              <CardDescription className="text-xs">Memory Used (MB) vs Connected Clients</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dbTrend.length > 0 ? dbTrend : [
                  { time: 'T-1', activeConn: 0, tps: 0, redisConn: 0, redisMem: 0 },
                  { time: 'T-0', activeConn: 0, tps: 0, redisConn: Number(systemHealth.redis_connected_clients) || 0, redisMem: Number(systemHealth.redis_memory_used_mb) || 0 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} orientation="left" />
                  <YAxis yAxisId="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} orientation="right" />
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Area yAxisId="left" type="monotone" dataKey="redisMem" name="Memory (MB)" fill="#a855f7" stroke="#a855f7" fillOpacity={0.2} />
                  <Line yAxisId="right" type="stepAfter" dataKey="redisConn" name="Clients" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
      )}

      {activeTab === "data" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* TIER 4: SECURITY & OPERATIONS */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Keamanan & Akses (RBAC)</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <Users className="w-4 h-4 mr-2" />
                    User Menunggu Persetujuan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-slate-800">{usersPending}</div>
                    {usersPending > 0 && (
                      <Link to="/admin/users" className="text-sm text-blue-600 hover:underline">
                        Review Sekarang →
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Staf baru yang belum di-assign role</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <Activity className="w-4 h-4 mr-2" />
                    Total User Sistem
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{usersTotal}</div>
                  <p className="text-xs text-slate-500 mt-2">Seluruh akun yang pernah didaftarkan</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm opacity-60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <PackageX className="w-4 h-4 mr-2" />
                    Soft-Deleted Records
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">142</div>
                  <p className="text-xs text-slate-500 mt-2">Data sampah di database (Mock)</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* TIER 1: MASTER DATA VOLUME */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Volume Data Master</h2>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <Card className="shadow-sm border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    Kamus Besar Medis (KBM)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.total_kbm || 0}</div>
                  <p className="text-xs text-slate-500 mt-1">Total data simptom/diagnosis internal</p>
                  <InlineBreakdown items={masterMetrics.kbm_breakdown} />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-l-4 border-l-indigo-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    Katalog ICD-10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.total_icd10 || 0}</div>
                  <p className="text-xs text-slate-500 mt-1">Standar internasional penyakit</p>
                  <InlineBreakdown items={masterMetrics.icd10_breakdown} />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-l-4 border-l-teal-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <HeartPulse className="w-4 h-4 mr-2 text-teal-500" />
                    Tindakan Medis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.total_tindakan || 0}</div>
                  <p className="text-xs text-slate-500 mt-1">Tarif & jenis tindakan</p>
                  <InlineBreakdown items={masterMetrics.tindakan_breakdown} />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-l-4 border-l-emerald-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <Pill className="w-4 h-4 mr-2 text-emerald-500" />
                    Inventaris Obat
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.total_obat || 0}</div>
                  <p className="text-xs text-slate-500 mt-1">Item aktif di farmasi</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm border-l-4 border-l-pink-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <Stethoscope className="w-4 h-4 mr-2 text-pink-500" />
                    Dokter Aktif
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.dokter_breakdown?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}</div>
                  <p className="text-xs text-slate-500 mt-1">Total dokter bertugas</p>
                  <InlineBreakdown items={masterMetrics.dokter_breakdown} />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <UserPlus className="w-4 h-4 mr-2 text-orange-500" />
                    Perawat Aktif
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.perawat_breakdown?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}</div>
                  <p className="text-xs text-slate-500 mt-1">Total perawat bertugas</p>
                  <InlineBreakdown items={masterMetrics.perawat_breakdown} />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* TIER 2: DATA INTEGRITY & OPERATIONS */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Integritas & Operasional</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className={`shadow-sm border-l-4 ${masterMetrics.unmapped_kbm > 0 ? "border-l-rose-500 bg-rose-50/30" : "border-l-emerald-500"}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    {masterMetrics.unmapped_kbm > 0 ? (
                      <ShieldAlert className="w-4 h-4 mr-2 text-rose-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                    )}
                    KBM Belum Terpetakan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-slate-800">{masterMetrics.unmapped_kbm || 0}</div>
                    {masterMetrics.unmapped_kbm > 0 && (
                      <span className="text-xs font-medium text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                        Action Required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">KBM yang tidak memiliki relasi ke ICD-10</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <Users className="w-4 h-4 mr-2 text-blue-500" />
                    User Aktif
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.active_users || 0}</div>
                  <p className="text-xs text-slate-500 mt-2">Akun terverifikasi di sistem</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center text-slate-600">
                    <ActivitySquare className="w-4 h-4 mr-2 text-indigo-500" />
                    Transaksi Hari Ini
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">{masterMetrics.today_encounter || 0}</div>
                  <p className="text-xs text-slate-500 mt-2">Total kunjungan (encounters) pasien hari ini</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* TIER 3: CHARTS & VISUALIZATIONS */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Analitik Operasional</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Tren Kunjungan Pasien Harian (7 Hari)</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  {masterMetrics.encounters_trend ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={masterMetrics.encounters_trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={10} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">Belum ada data kunjungan</div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Distribusi Role Pengguna</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  {masterMetrics.role_demographics ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={masterMetrics.role_demographics}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="label"
                        >
                          {masterMetrics.role_demographics.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">Belum ada data demografi</div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-amber-600 flex items-center">
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Masa Tugas Berakhir (&lt;30 Hari)
                  </CardTitle>
                  <CardDescription className="text-xs">Dokter & Perawat yang akan selesai bertugas</CardDescription>
                </CardHeader>
                <CardContent className="h-64 overflow-y-auto pr-2">
                  {masterMetrics.upcoming_expirations && masterMetrics.upcoming_expirations.length > 0 ? (
                    <div className="space-y-3">
                      {masterMetrics.upcoming_expirations.map((exp: any, idx: number) => (
                        <div key={idx} className="flex flex-col p-2 bg-amber-50 rounded-md border border-amber-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-xs text-slate-800">{exp.name}</span>
                            <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                              Sisa {exp.days_left} hr
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{exp.type} - Poli: {exp.poli}</span>
                            <span>{exp.end_date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-300 mb-2" />
                      Tidak ada masa tugas yang hampir habis
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
