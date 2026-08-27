import { api } from "@/lib/api";
import type { GetMedicalRecordResponse } from "../types";

// ─── Rekam Medis ──────────────────────────────────────────────────────────────

export const getMedicalRecord = async (encounterNo: string): Promise<GetMedicalRecordResponse | null> => {
  try {
    const { data } = await api.get<{ data: GetMedicalRecordResponse }>(`/rekam-medis/record/${encounterNo}`);
    return data?.data;
  } catch (error) {
    console.error("Failed to fetch medical record", error);
    return null;
  }
};

export const searchPatientHistory = async (mrn: string): Promise<GetMedicalRecordResponse[]> => {
  try {
    const { data } = await api.get<{ data: GetMedicalRecordResponse[] }>(`/rekam-medis/patient/${mrn}/history`);
    return data?.data || [];
  } catch (error) {
    console.error("Failed to fetch patient history", error);
    return [];
  }
};

// ─── Medical Coding (Staf Rekam Medis) ───────────────────────────────────────

export const listPendingKBMVerifications = async (): Promise<any[]> => {
  try {
    const { data } = await api.get<{ data: any[] }>("/rekam-medis/coding/pending-kbm");
    return data?.data || [];
  } catch {
    return [];
  }
};

export const verifyKBMMapping = async (id: string, kbmCode: string): Promise<void> => {
  await api.post(`/rekam-medis/coding/verify-kbm/${id}`, { kbm_code: kbmCode });
};

export const finalizeSeverity = async (encounterNo: string, severityLevel: string): Promise<void> => {
  await api.post(`/rekam-medis/coding/finalize-severity`, { encounter_no: encounterNo, severity_level: severityLevel });
};

// ─── Master Data Catalog (Global, tanpa filter poli) ─────────────────────────

export const getMasterICD10 = async (search: string): Promise<{ code: string; name: string }[]> => {
  try {
    const { data } = await api.get("/master/icd10", {
      params: { search_name: search, page_size: 30 },
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

export const getMasterICD9 = async (search: string): Promise<{ code: string; name: string }[]> => {
  try {
    const { data } = await api.get("/master/icd9", {
      params: { search_name: search, page_size: 30 },
    });
    const items = data?.data || [];
    return items.map((item: any) => ({
      code: item.icd9_code || item.code,
      name: item.icd9_name_id || item.icd9_name_en || item.icd9_code,
    }));
  } catch {
    return [];
  }
};

export const getMasterKBMs = async (search: string): Promise<any[]> => {
  try {
    const { data } = await api.get("/master/kbm", {
      params: { search: search, page_size: 30 },
    });
    return data?.data || [];
  } catch {
    return [];
  }
};

export const getMasterSNOMED = async (search: string): Promise<any[]> => {
  try {
    const { data } = await api.get("/master/snomed", {
      params: { search, page_size: 30 },
    });
    return data?.data || [];
  } catch {
    return [];
  }
};
