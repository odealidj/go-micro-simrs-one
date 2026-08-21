import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { api } from "@/lib/api";
import { Bot, Save, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AISettingsFormData {
  gemini_ocr_model: string;
}

export function AdminAISettingsPage() {
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  const { control, handleSubmit, reset } = useForm<AISettingsFormData>({
    defaultValues: {
      gemini_ocr_model: "gemini-3.6-flash",
    },
  });

  useEffect(() => {
    fetchModels();
    fetchSettings();
  }, []);

  const fetchModels = async () => {
    try {
      const res = await api.get("/admin/ai/models");
      if (res.data.success) {
        setModels(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch models", err);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get("/admin/ai/settings");
      if (res.data.success && res.data.data) {
        reset({
          gemini_ocr_model: res.data.data.gemini_ocr_model || "gemini-3.6-flash",
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const onSubmit = async (data: AISettingsFormData) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.put("/admin/ai/settings", data);
      if (res.data.success) {
        setMessage({ type: "success", text: "Pengaturan AI berhasil disimpan." });
      } else {
        setMessage({ type: "danger", text: res.data.message || "Gagal menyimpan pengaturan." });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "danger", text: err.response?.data?.message || "Terjadi kesalahan saat menyimpan pengaturan." });
    } finally {
      setSaving(false);
    }
  };

  if (loadingModels || loadingSettings) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500">Memuat pengaturan AI...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bot className="h-6 w-6 text-blue-600" />
          Pengaturan AI
        </h2>
        <p className="text-slate-500 mt-1">Kelola preferensi dan model AI untuk sistem</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 mt-0.5" /> : <AlertCircle className="h-5 w-5 mt-0.5" />}
            <div className="flex-1">{message.text}</div>
            <button onClick={() => setMessage(null)} className="opacity-50 hover:opacity-100">&times;</button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Model Gemini untuk OCR KTP
            </label>
            <Controller
              name="gemini_ocr_model"
              control={control}
              rules={{ required: "Model harus dipilih" }}
              render={({ field, fieldState }) => (
                <div>
                  <select
                    {...field}
                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:outline-none transition-colors ${
                      fieldState.error ? 'border-red-300 focus:ring-red-200 focus:border-red-500' : 'border-slate-300 focus:ring-blue-100 focus:border-blue-500'
                    }`}
                  >
                    <option value="">-- Pilih Model AI --</option>
                    {models && models.length > 0 ? (
                      models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                        <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                      </>
                    )}
                  </select>
                  {fieldState.error && (
                    <p className="mt-1 text-sm text-red-500">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />
            <p className="mt-2 text-sm text-slate-500">
              Model ini akan digunakan untuk mengekstrak informasi pasien dari gambar KTP secara otomatis saat pendaftaran.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button type="submit" disabled={saving} className="min-w-[150px]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Simpan Pengaturan
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
