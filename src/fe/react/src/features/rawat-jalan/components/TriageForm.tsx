import { useState, useMemo, useEffect } from "react";
import { submitTriage } from "../api/rawatJalanApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TriageData } from "../types";
import {
  HeartPulse,
  Save,
  CheckCircle,
  Activity,
  Weight,
  ShieldAlert,
  Thermometer,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TriageFormProps {
  encounterNo: string;
  initialData?: TriageData;
  readOnly?: boolean;
  onSuccess?: () => void;
  onDataChange?: (data: TriageFormState) => void;
  autoSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

export interface TriageFormState {
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  temperature: string;
  heart_rate: string;
  respiratory_rate: string;
  oxygen_saturation: string;
  height: string;
  weight: string;
  allergies: string;
  notes: string;
}

export function TriageForm({
  encounterNo,
  initialData,
  readOnly = false,
  onSuccess,
  onDataChange,
  autoSaveRef,
}: TriageFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<TriageFormState>({
    blood_pressure_systolic: initialData?.blood_pressure_systolic ? String(initialData.blood_pressure_systolic) : "",
    blood_pressure_diastolic: initialData?.blood_pressure_diastolic ? String(initialData.blood_pressure_diastolic) : "",
    temperature: initialData?.temperature ? String(initialData.temperature) : "",
    heart_rate: initialData?.heart_rate ? String(initialData.heart_rate) : "",
    respiratory_rate: initialData?.respiratory_rate ? String(initialData.respiratory_rate) : "",
    oxygen_saturation: initialData?.oxygen_saturation ? String(initialData.oxygen_saturation) : "",
    height: initialData?.height ? String(initialData.height) : "",
    weight: initialData?.weight ? String(initialData.weight) : "",
    allergies: initialData?.allergies || "",
    notes: initialData?.notes || "",
  });

  // Keep formData in sync if initialData arrives after mount
  useEffect(() => {
    if (initialData) {
      setFormData(prev => {
        const next = {
          blood_pressure_systolic: initialData.blood_pressure_systolic ? String(initialData.blood_pressure_systolic) : prev.blood_pressure_systolic,
          blood_pressure_diastolic: initialData.blood_pressure_diastolic ? String(initialData.blood_pressure_diastolic) : prev.blood_pressure_diastolic,
          temperature: initialData.temperature ? String(initialData.temperature) : prev.temperature,
          heart_rate: initialData.heart_rate ? String(initialData.heart_rate) : prev.heart_rate,
          respiratory_rate: initialData.respiratory_rate ? String(initialData.respiratory_rate) : prev.respiratory_rate,
          oxygen_saturation: initialData.oxygen_saturation ? String(initialData.oxygen_saturation) : prev.oxygen_saturation,
          height: initialData.height ? String(initialData.height) : prev.height,
          weight: initialData.weight ? String(initialData.weight) : prev.weight,
          allergies: initialData.allergies ?? prev.allergies,
          notes: initialData.notes ?? prev.notes,
        };
        if (onDataChange) onDataChange(next);
        return next;
      });
    }
  }, [initialData]);

  // Calculate BMI: Weight(kg) / (Height(m)^2)
  const bmiCalc = useMemo(() => {
    const h = Number(formData.height);
    const w = Number(formData.weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const heightInMeters = h / 100;
    const val = w / (heightInMeters * heightInMeters);
    const score = Number(val.toFixed(1));
    let label = "Normal";
    let color = "text-emerald-700 bg-emerald-50 border-emerald-200";

    if (score < 18.5) {
      label = "Berat Rendah (Underweight)";
      color = "text-amber-700 bg-amber-50 border-amber-200";
    } else if (score >= 25 && score < 30) {
      label = "Kelebihan Berat (Overweight)";
      color = "text-orange-700 bg-orange-50 border-orange-200";
    } else if (score >= 30) {
      label = "Obesitas";
      color = "text-red-700 bg-red-50 border-red-200";
    }

    return { score, label, color };
  }, [formData.height, formData.weight]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: value,
      };
      if (onDataChange) {
        onDataChange(updated);
      }
      return updated;
    });
  };

  const handleSaveTriage = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await submitTriage(encounterNo, {
        blood_pressure_systolic: Number(formData.blood_pressure_systolic) || 0,
        blood_pressure_diastolic: Number(formData.blood_pressure_diastolic) || 0,
        temperature: Number(formData.temperature) || 0,
        heart_rate: Number(formData.heart_rate) || 0,
        respiratory_rate: formData.respiratory_rate ? Number(formData.respiratory_rate) : undefined,
        oxygen_saturation: formData.oxygen_saturation ? Number(formData.oxygen_saturation) : undefined,
        height: formData.height ? Number(formData.height) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
        allergies: formData.allergies,
        notes: formData.notes,
        bmi: bmiCalc?.score,
      });
      setSuccess(true);
      if (onSuccess) onSuccess();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Gagal menyimpan data triage");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Expose save function to parent ref for auto-saving
  useEffect(() => {
    if (autoSaveRef) {
      autoSaveRef.current = handleSaveTriage;
    }
    return () => {
      if (autoSaveRef) {
        autoSaveRef.current = null;
      }
    };
  }, [formData, bmiCalc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveTriage();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-slate-800 text-lg">Pemeriksaan Awal & Triage</h3>
        </div>
        <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Dapat diisi oleh Perawat / Dokter
        </span>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
          <div>
            <h4 className="font-medium">Tanda Vital & Triage Tersimpan</h4>
            <p className="text-sm mt-0.5">Data tanda vital berhasil diperbarui dan siap ditinjau.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tanda-tanda Vital */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-600" />
            1. Tanda-Tanda Vital (Vital Signs)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tekanan Darah (mmHg)
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  name="blood_pressure_systolic"
                  value={formData.blood_pressure_systolic}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="h-10 text-center font-medium"
                  placeholder="Contoh: 120"
                  min="0"
                />
                <span className="text-slate-400 font-bold">/</span>
                <Input
                  type="number"
                  name="blood_pressure_diastolic"
                  value={formData.blood_pressure_diastolic}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="h-10 text-center font-medium"
                  placeholder="Contoh: 80"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                Suhu Tubuh (°C)
              </label>
              <Input
                type="number"
                name="temperature"
                step="0.1"
                value={formData.temperature}
                onChange={handleChange}
                disabled={readOnly}
                className="h-10 font-medium"
                placeholder="Contoh: 36.5"
                min="30"
                max="45"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Detak Jantung (bpm)
              </label>
              <Input
                type="number"
                name="heart_rate"
                value={formData.heart_rate}
                onChange={handleChange}
                disabled={readOnly}
                className="h-10 font-medium"
                placeholder="Contoh: 80"
                min="0"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Laju Napas (x/mnt) & SpO₂ (%)
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  name="respiratory_rate"
                  value={formData.respiratory_rate}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="h-10 text-center font-medium"
                  placeholder="Contoh: 20"
                  min="0"
                />
                <span className="text-slate-400 font-bold">|</span>
                <Input
                  type="number"
                  name="oxygen_saturation"
                  value={formData.oxygen_saturation}
                  onChange={handleChange}
                  disabled={readOnly}
                  className="h-10 text-center font-medium"
                  placeholder="Contoh: 98"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Antropometri */}
        <div className="pt-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Weight className="h-3.5 w-3.5 text-cyan-600" />
            2. Antropometri & Status Gizi
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tinggi Badan (cm)
              </label>
              <Input
                type="number"
                name="height"
                value={formData.height}
                onChange={handleChange}
                disabled={readOnly}
                className="h-10 font-medium"
                placeholder="Contoh: 165"
                min="20"
                max="250"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Berat Badan (kg)
              </label>
              <Input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                disabled={readOnly}
                className="h-10 font-medium"
                placeholder="Contoh: 60"
                min="1"
                max="300"
              />
            </div>

            {bmiCalc && (
              <div className={cn("p-2.5 rounded-lg border flex items-center justify-between text-xs", bmiCalc.color)}>
                <div>
                  <span className="font-semibold block">IMT: {bmiCalc.score} kg/m²</span>
                  <span className="text-[11px] opacity-90">{bmiCalc.label}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alergi & Keluhan Awal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
              Riwayat Alergi (Obat / Makanan)
            </label>
            <Input
              type="text"
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              disabled={readOnly}
              className="h-10"
              placeholder="Contoh: Alergi Amoxicillin, Seafood (atau tulis 'Tidak Ada')"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Keluhan Utama / Catatan Awal
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full h-20 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-700 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-colors resize-none disabled:opacity-75 disabled:cursor-not-allowed"
              placeholder="Contoh: Pasien mengeluh pusing dan demam sejak 2 hari yang lalu..."
            />
          </div>
        </div>

        {/* Submit */}
        {!readOnly && (
          <div className="pt-3 flex justify-end">
            <Button 
              type="submit" 
              disabled={loading}
              className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm"
            >
              <Save className="h-4 w-4" />
              {loading ? "Menyimpan..." : "Simpan Data Triage"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
