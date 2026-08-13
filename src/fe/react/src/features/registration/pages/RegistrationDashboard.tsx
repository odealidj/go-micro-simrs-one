import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Clock, CalendarCheck } from "lucide-react";

export function RegistrationDashboard() {
  const stats = [
    {
      title: "Total Pasien Hari Ini",
      value: "124",
      icon: Users,
      trend: "+12% dari kemarin",
      trendColor: "text-green-400"
    },
    {
      title: "Pasien Baru",
      value: "18",
      icon: UserPlus,
      trend: "+4% dari kemarin",
      trendColor: "text-green-400"
    },
    {
      title: "Rata-rata Waktu Tunggu",
      value: "14mnt",
      icon: Clock,
      trend: "-2mnt dari kemarin",
      trendColor: "text-blue-400"
    },
    {
      title: "Booking Online",
      value: "45",
      icon: CalendarCheck,
      trend: "+15% dari kemarin",
      trendColor: "text-green-400"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard Pendaftaran</h2>
        <p className="text-slate-400 mt-1">Ringkasan aktivitas rawat jalan hari ini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-white/10 backdrop-blur-md border-white/10 shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-all duration-500 group-hover:bg-blue-500/20" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-slate-300">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <p className={`text-xs mt-1 ${stat.trendColor}`}>
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder for charts or recent registrations list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-black/20 backdrop-blur-md border-white/10 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Trend Kunjungan Poli</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center border border-dashed border-white/10 rounded-xl mx-6 mb-6">
            <p className="text-slate-500">Area Chart Visualisasi Data</p>
          </CardContent>
        </Card>
        
        <Card className="bg-black/20 backdrop-blur-md border-white/10 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Status Antrean Terkini</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {['Poli Umum', 'Poli Gigi', 'Poli Anak', 'Poli Kandungan'].map((poli) => (
              <div key={poli} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <span className="text-slate-300 font-medium">{poli}</span>
                <span className="text-blue-400 font-bold">12 antrean</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
