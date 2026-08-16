import { Users, UserPlus, Clock, Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function RegistrationDashboard() {
  const stats = [
    {
      title: "Total Pasien Hari Ini",
      value: "142",
      icon: Users,
      bgColor: "bg-blue-100",
      color: "text-blue-600",
    },
    {
      title: "Pasien Baru",
      value: "18",
      icon: UserPlus,
      bgColor: "bg-emerald-100",
      color: "text-emerald-600",
    },
    {
      title: "Rata-rata Tunggu",
      value: "12 mnt",
      icon: Clock,
      bgColor: "bg-amber-100",
      color: "text-amber-600",
    },
    {
      title: "Poli Aktif",
      value: "8",
      icon: Stethoscope,
      bgColor: "bg-purple-100",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Pendaftaran</h2>
        <p className="text-slate-500 mt-1">Ringkasan aktivitas rawat jalan hari ini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                </div>
                <div className={cn("p-3 rounded-lg", stat.bgColor, stat.color)}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
