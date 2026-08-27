import { useState, useEffect } from "react";
import { Mic, SkipForward, RotateCcw, CheckCircle2, User, MonitorPlay } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AdmisiPageHeader } from "../components/AdmisiPageHeader";
import { admisiTheme } from "../theme";

interface QueuePatient {
  id: string;
  name: string;
  type: string;
  time: string;
  estimate: string;
  status: string;
  departmentCode: string;
}

export function QueueManagerPage() {
  const [_loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [waitlist, setWaitlist] = useState<QueuePatient[]>([]);
  const [activeCall, setActiveCall] = useState<{id: string, name: string} | null>(null);
  
  // Format current date to YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const response = await api.get('/registrations/today', {
        params: {
          date: getTodayString(),
          queue_only: true
        }
      });
      if (response.data?.success) {
        const encounters = response.data.data.encounters || [];
        const mappedQueue: QueuePatient[] = encounters.map((e: any) => ({
          id: e.encounter_no,
          name: e.patient_name,
          type: e.status_pasien, // "Baru RS" / "Lama RS"
          time: e.registered_time.substring(11, 16), // extract HH:mm
          estimate: "~5 mnt", // TODO: dynamic estimation
          status: e.status,
          departmentCode: e.department_code,
        }));
        
        setWaitlist(mappedQueue);
        
        if (mappedQueue.length > 0 && !activeCall) {
          // If no active call, don't automatically set it yet, but you could.
        }
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
      toast.error("Terjadi kesalahan mengambil data antrean");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Refresh queue every 15 seconds
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const queueTabs = [
    { id: "all", label: "Semua Poli", activeCount: waitlist.length },
    { id: "01", label: "Poli Umum", activeCount: waitlist.filter(w => w.departmentCode === "01").length },
    { id: "02", label: "Poli Gigi", activeCount: waitlist.filter(w => w.departmentCode === "02").length },
  ];

  const filteredWaitlist = activeTab === "all" ? waitlist : waitlist.filter(w => w.departmentCode === activeTab);

  const handleNextCall = () => {
    if (filteredWaitlist.length > 0) {
      const nextPatient = filteredWaitlist[0];
      setActiveCall({ id: nextPatient.id, name: nextPatient.name });
      // Remove from waitlist locally until next refresh
      setWaitlist(waitlist.filter(w => w.id !== nextPatient.id));
    } else {
      setActiveCall(null);
    }
  };

  const handleComplete = () => {
    handleNextCall();
  };

  const handleSkip = () => {
    // In a real app, move them to the end of the line or mark as skipped. 
    // Here we just pull the next patient.
    handleNextCall();
  };

  return (
    <div className={admisiTheme.layout.container}>
      <AdmisiPageHeader
        title="Manajemen Antrean"
        description="Kontrol pemanggilan antrean pasien, estimasi pelayanan, dan alur per poliklinik."
        badge="Live Queue Control"
        icon={MonitorPlay}
      />

      {/* Tabs Navigation */}
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">
        {queueTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 border",
              activeTab === tab.id 
                ? "bg-sky-600 border-sky-600 text-white shadow-xs" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
            )}
          >
            {tab.label}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold",
              activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {tab.activeCount}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Active Call Controls */}
        <div className="col-span-1 lg:col-span-7 space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg text-slate-800 text-center">Sedang Dipanggil</CardTitle>
            </CardHeader>
            <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              {activeCall ? (
                <>
                  <div className="text-[120px] font-bold leading-none tracking-tighter text-blue-600 mb-2">
                    {activeCall.id}
                  </div>
                  <p className="text-2xl font-medium text-slate-800">{activeCall.name}</p>
                  <p className="text-slate-500 mt-1">Poli Umum • Dr. Ali Ube</p>
                  
                  <div className="flex items-center gap-4 mt-10">
                    <Button variant="outline" size="lg" className="h-16 w-16 rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600">
                      <RotateCcw className="h-6 w-6" />
                    </Button>
                    <Button size="lg" className="h-16 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-sm gap-2">
                      <Mic className="h-6 w-6" />
                      Panggil (Audio)
                    </Button>
                    <Button onClick={handleSkip} variant="outline" size="lg" className="h-16 w-16 rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-amber-600">
                      <SkipForward className="h-6 w-6" />
                    </Button>
                  </div>
                </>
              ) : (
                 <div className="text-center text-slate-500">
                    <p className="text-xl font-medium">Antrean Kosong</p>
                    <p className="mt-2 text-sm">Tidak ada pasien dalam daftar panggil.</p>
                 </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Tandai Selesai</h3>
                  <p className="text-sm text-slate-500">Pasien telah selesai menerima pelayanan admin.</p>
                </div>
                <Button 
                  onClick={handleComplete} 
                  disabled={!activeCall}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 disabled:bg-emerald-600/50"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Selesai
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Waiting List */}
        <div className="col-span-1 lg:col-span-5">
          <Card className="bg-white border-slate-200 shadow-sm h-full flex flex-col">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-slate-800">Daftar Tunggu</CardTitle>
                <span className="text-sm text-slate-500">Estimasi</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="divide-y divide-slate-100">
                
                {filteredWaitlist.length > 0 ? filteredWaitlist.map((patient, index) => (
                  <div key={patient.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl font-bold flex items-center justify-center text-lg",
                        index === 0 ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
                      )}>
                        {patient.id}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{patient.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" /> {patient.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-medium", index === 0 ? "text-amber-600" : "text-slate-600")}>{patient.estimate}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{patient.time}</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-slate-500">
                     Daftar antrean kosong.
                  </div>
                )}
                
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
