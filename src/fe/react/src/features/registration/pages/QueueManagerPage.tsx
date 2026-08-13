import { useState } from "react";
import { Mic, CheckCircle2, User, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QueueManagerPage() {
  const [activePoli, setActivePoli] = useState("Poli Umum");

  const poliList = ["Poli Umum", "Poli Gigi", "Poli Anak", "Poli Kandungan"];
  
  const queues = [
    { id: "A-001", name: "Budi Santoso", status: "Sedang Dilayani", time: "09:00" },
    { id: "A-002", name: "Siti Aminah", status: "Menunggu", time: "09:15" },
    { id: "A-003", name: "Andi Saputra", status: "Menunggu", time: "09:30" },
    { id: "A-004", name: "Rina Wati", status: "Menunggu", time: "09:45" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Manajemen Antrean</h2>
          <p className="text-slate-400 mt-1">Kelola dan panggil antrean pasien per poliklinik.</p>
        </div>
        <div className="flex bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-1">
          {poliList.map(poli => (
            <button
              key={poli}
              onClick={() => setActivePoli(poli)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activePoli === poli 
                  ? "bg-blue-600 text-white shadow-lg" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {poli}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left: Active Queue Info */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <Card className="bg-gradient-to-br from-blue-600/40 to-blue-900/40 backdrop-blur-xl border-blue-500/30 shadow-2xl overflow-hidden relative flex-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <CardHeader className="text-center pb-2 relative z-10">
              <CardTitle className="text-blue-200 text-lg uppercase tracking-widest font-semibold">
                Sedang Dipanggil
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-1 relative z-10">
              <div className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                A-001
              </div>
              <div className="mt-6 text-xl text-slate-200 font-medium">Budi Santoso</div>
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm font-semibold">
                <Clock className="w-4 h-4" />
                Estimasi Selesai: 15 Menit
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-md border-white/10 shadow-xl">
            <CardContent className="p-6 flex flex-col gap-4">
              <Button size="lg" className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-[0_0_20px_rgba(22,163,74,0.3)] border border-green-500/50">
                <Mic className="mr-2 h-6 w-6" />
                Panggil Nomor A-002
              </Button>
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-12 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl">
                  Ulangi Panggilan
                </Button>
                <Button variant="outline" className="h-12 border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl">
                  Lewati (Skip)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Queue List */}
        <div className="flex-1">
          <Card className="bg-black/20 backdrop-blur-md border-white/10 shadow-xl h-full flex flex-col">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white flex items-center justify-between">
                Daftar Antrean
                <span className="text-sm font-normal text-slate-400 bg-white/5 px-3 py-1 rounded-full">
                  Total: 12 Pasien
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto flex-1">
              <div className="divide-y divide-white/5">
                {queues.map((q, idx) => (
                  <div key={q.id} className={cn(
                    "flex items-center justify-between p-4 hover:bg-white/5 transition-colors",
                    idx === 0 && "bg-blue-900/20"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-inner",
                        idx === 0 ? "bg-blue-600 text-white" : "bg-white/10 text-slate-300"
                      )}>
                        {q.id}
                      </div>
                      <div>
                        <p className={cn("font-medium", idx === 0 ? "text-white" : "text-slate-300")}>{q.name}</p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          {idx === 0 ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <User className="w-3 h-3" />}
                          {q.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-300">{q.time}</p>
                      <p className="text-xs text-slate-500 mt-1">Estimasi</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
