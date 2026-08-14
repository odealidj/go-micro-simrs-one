import { useState } from "react";
import { Mic, SkipForward, RotateCcw, CheckCircle2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mock Data
const MOCK_WAITLIST = [
  { id: "A-002", name: "Ibu Siti Aminah", type: "Pasien Lama (BPJS)", time: "10:45", estimate: "~5 mnt" },
  { id: "A-003", name: "Agus Pratama", type: "Pasien Baru (Umum)", time: "10:55", estimate: "~15 mnt" },
  { id: "A-004", name: "Dewi Lestari", type: "Pasien Lama (Asuransi)", time: "11:10", estimate: "~30 mnt" },
];

export function QueueManagerPage() {
  const [activeTab, setActiveTab] = useState("umum");
  
  // States for Queue Logic
  const [activeCall, setActiveCall] = useState<{id: string, name: string} | null>({
    id: "A-001",
    name: "Bpk. Budi Santoso"
  });
  const [waitlist, setWaitlist] = useState(MOCK_WAITLIST);
  
  const queueTabs = [
    { id: "umum", label: "Poli Umum", activeCount: waitlist.length + (activeCall ? 1 : 0) },
    { id: "gigi", label: "Poli Gigi", activeCount: 5 },
    { id: "anak", label: "Poli Anak", activeCount: 8 },
  ];

  const handleNextCall = () => {
    if (waitlist.length > 0) {
      const nextPatient = waitlist[0];
      setActiveCall({ id: nextPatient.id, name: nextPatient.name });
      setWaitlist(waitlist.slice(1));
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Antrean</h2>
        <p className="text-slate-500 mt-1">Kontrol pemanggilan pasien dan estimasi pelayanan.</p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {queueTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-2",
              activeTab === tab.id 
                ? "bg-blue-600 text-white shadow-sm" 
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab.label}
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs",
              activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
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
                
                {waitlist.length > 0 ? waitlist.map((patient, index) => (
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
