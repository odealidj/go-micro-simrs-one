import { api } from "@/lib/api";
import type {
  EncounterDetail,
  GetMedicalRecordResponse,
  PrescriptionDraftItem,
  TriageData,
} from "../types";

// ─── Encounter Lifecycle ───────────────────────────────────────────────────────

export const getTodayEncounters = async (poliCode?: string): Promise<EncounterDetail[]> => {
  const { data } = await api.get<any>("/registrations/today");

  let rawList: any[] = [];
  if (Array.isArray(data?.data)) {
    rawList = data.data;
  } else if (Array.isArray(data?.data?.encounters)) {
    rawList = data.data.encounters;
  }

  let encounters: EncounterDetail[] = rawList.map((e: any) => ({
    encounter_no: e.encounter_no,
    mrn: e.mrn || e.patient_mrn || "-",
    department_code: e.department_code,
    doctor_id: e.doctor_id,
    status: e.status,
    registered_time: e.registered_time,
    patient_name: e.patient_name || e.name || e.mrn,
    patient_gender: e.gender || e.patient_gender || "-",
    patient_birthdate: e.date_of_birth || e.patient_birthdate || e.dob || "-",
    guarantor: e.status_pasien || e.guarantor || "",
  }));

  if (poliCode) {
    encounters = encounters.filter(e => e.department_code === poliCode);
  }

  return encounters;
};

export const startEncounter = async (encounterNo: string): Promise<void> => {
  await api.post("/rawat-jalan/encounter/start", { encounter_no: encounterNo });
};

export const resetEncounter = async (encounterNo: string): Promise<void> => {
  await api.post("/rawat-jalan/encounter/reset", { encounter_no: encounterNo });
};

export const completeEncounter = async (encounterNo: string): Promise<void> => {
  await api.post("/rawat-jalan/encounter/complete", { encounter_no: encounterNo });
};

// ─── Triage ───────────────────────────────────────────────────────────────────

export const submitTriage = async (
  encounterNo: string,
  triageData: TriageData
): Promise<void> => {
  await api.post("/rawat-jalan/triage", {
    encounter_no: encounterNo,
    blood_pressure_systolic: triageData.blood_pressure_systolic,
    blood_pressure_diastolic: triageData.blood_pressure_diastolic,
    temperature: triageData.temperature,
    heart_rate: triageData.heart_rate,
    notes: triageData.notes,
  });
};

// ─── Diagnosis (ICD-10 First) ──────────────────────────────────────────────────

export const searchICD10 = async (search: string, poliCode?: string): Promise<{ code: string; name: string }[]> => {
  try {
    const endpoint = poliCode ? `/master/icd10/poli/${poliCode}` : "/master/icd10";
    const { data } = await api.get(endpoint, {
      params: { search_name: search, page_size: 20 },
    });
    const items = data?.data || [];
    return items.map((item: any) => ({
      code: item.icd10_code || item.code,
      name: item.name_id || item.name_en || item.icd10_code,
    }));
  } catch {
    return [];
  }
};

export const addEncounterDiagnosis = async (
  encounterNo: string,
  icd10Code: string,
  diagnosisType: string,
  severityLevel: string,
  clinicalNotes: string
): Promise<void> => {
  await api.post("/rawat-jalan/diagnosis", {
    encounter_no: encounterNo,
    icd10_code: icd10Code,
    diagnosis_type: diagnosisType,
    severity_level: severityLevel,
    clinical_notes: clinicalNotes,
  });
};

export const updateEncounterDiagnosis = async (
  id: string,
  diagnosisType: string,
  severityLevel: string,
  clinicalNotes: string
): Promise<void> => {
  await api.put(`/rawat-jalan/diagnosis/${id}`, {
    diagnosis_type: diagnosisType,
    severity_level: severityLevel,
    clinical_notes: clinicalNotes,
  });
};

export const removeEncounterDiagnosis = async (id: string): Promise<void> => {
  await api.delete(`/rawat-jalan/diagnosis/${id}`);
};

export const finalizeSeverity = async (
  encounterNo: string,
  severityLevel: string
): Promise<void> => {
  await api.post(`/rawat-jalan/encounter/${encounterNo}/severity/finalize`, {
    severity_level: severityLevel,
  });
};

export const getKBMSuggestionsForICD10 = async (icd10Code: string): Promise<any[]> => {
  const { data } = await api.get<{ data: { suggestions: any[] } }>(`/rawat-jalan/icd10/${icd10Code}/kbm-suggestions`);
  return data?.data?.suggestions || [];
};

export const searchKBM = async (query: string, deptCode?: string): Promise<any[]> => {
  try {
    const endpoint = deptCode ? `/master/kbm/poli/${deptCode}` : "/master/kbm";
    const { data } = await api.get(endpoint, {
      params: { search: query, page_size: 20 },
    });
    return data?.data || [];
  } catch {
    return [];
  }
};

export const verifyKBMMapping = async (
  id: string,
  kbmCode: string
): Promise<void> => {
  await api.post(`/emr/diagnosis/${id}/verify-kbm`, {
    kbm_code: kbmCode,
  });
};

// ─── Tindakan Medis ───────────────────────────────────────────────────────────

export const searchMasterTindakan = async (search: string, poliCode?: string): Promise<{ code: string; name: string; price: number }[]> => {
  try {
    const endpoint = poliCode ? `/master/tindakan/poli/${poliCode}` : "/master/tindakan";
    const { data } = await api.get(endpoint, {
      params: { search_name: search, page_size: 20 },
    });
    const items = data?.data || [];
    return items.map((item: any) => ({
      code: item.kode_tindakan || item.code,
      name: item.nama_tindakan || item.name,
      price: Number(item.base_price || item.price || 0),
    }));
  } catch {
    return [];
  }
};

export const addMedicalAction = async (
  encounterNo: string,
  actionCode: string,
  actionName: string,
  price: number,
  notes: string
): Promise<void> => {
  await api.post("/rawat-jalan/actions", {
    encounter_no: encounterNo,
    action_code: actionCode,
    action_name: actionName,
    price,
    notes,
  });
};

// ─── Resep ────────────────────────────────────────────────────────────────────

export interface SearchObatItem {
  code: string;
  name: string;
  price: number;
  stock: number;
  is_fornas?: boolean;
  kfa_code?: string;
  bpjs_dpho_code?: string;
  restriction?: string;
}

export const searchMasterObat = async (search: string, poliCode?: string): Promise<SearchObatItem[]> => {
  try {
    const endpoint = poliCode ? `/master/obat/poli/${poliCode}` : "/master/obat";
    const { data } = await api.get(endpoint, {
      params: { search_name: search, page_size: 20 },
    });
    const items = data?.data || [];
    return items.map((item: any) => ({
      code: item.item_code || item.code,
      name: item.name,
      price: Number(item.price || 0),
      stock: Number(item.stock_quantity || 0),
      is_fornas: Boolean(item.is_fornas),
      kfa_code: item.kfa_code || "",
      bpjs_dpho_code: item.bpjs_dpho_code || "",
      restriction: item.restriction || "",
    }));
  } catch {
    return [];
  }
};

export const createPrescription = async (
  encounterNo: string,
  items: PrescriptionDraftItem[]
): Promise<void> => {
  await api.post("/pharmacy/prescriptions", {
    encounter_no: encounterNo,
    items,
  });
};

// ─── Medical Record (read-only untuk dokter/perawat) ─────────────────────────

export const getMedicalRecord = async (encounterNo: string): Promise<GetMedicalRecordResponse | null> => {
  try {
    const { data } = await api.get<{ data: GetMedicalRecordResponse }>(`/rawat-jalan/record/${encounterNo}`);
    return data?.data;
  } catch (error) {
    console.error("Failed to fetch medical record", error);
    return null;
  }
};
