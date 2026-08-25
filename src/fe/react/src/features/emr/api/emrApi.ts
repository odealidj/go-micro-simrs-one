import { api } from "@/lib/api";
import type {
  EncounterDetail,
  GetMedicalRecordResponse,
  PrescriptionDraftItem,
  TriageData,
} from "../types";

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
  await api.post("/emr/start", { encounter_no: encounterNo });
};

export const completeEncounter = async (encounterNo: string): Promise<void> => {
  await api.post("/emr/complete", { encounter_no: encounterNo });
};

export const submitTriage = async (
  encounterNo: string,
  triageData: TriageData
): Promise<void> => {
  await api.post("/emr/triage", {
    encounter_no: encounterNo,
    blood_pressure_systolic: triageData.blood_pressure_systolic,
    blood_pressure_diastolic: triageData.blood_pressure_diastolic,
    temperature: triageData.temperature,
    heart_rate: triageData.heart_rate,
    notes: triageData.notes,
  });
};

export const getKBMSuggestionsForICD10 = async (icd10Code: string): Promise<any[]> => {
  const { data } = await api.get<{ data: { suggestions: any[] } }>(`/emr/icd10/${icd10Code}/kbm-suggestions`);
  return data?.data?.suggestions || [];
};

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
  await api.post("/emr/diagnosis", {
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
  await api.put(`/emr/diagnosis/${id}`, {
    diagnosis_type: diagnosisType,
    severity_level: severityLevel,
    clinical_notes: clinicalNotes,
  });
};

export const removeEncounterDiagnosis = async (id: string): Promise<void> => {
  await api.delete(`/emr/diagnosis/${id}`);
};

export const finalizeSeverity = async (
  encounterNo: string,
  severityLevel: string
): Promise<void> => {
  await api.post(`/emr/encounter/${encounterNo}/severity/finalize`, {
    severity_level: severityLevel,
  });
};

export const verifyKBMMapping = async (
  id: string,
  kbmCode: string
): Promise<void> => {
  await api.post(`/emr/diagnosis/${id}/verify-kbm`, {
    kbm_code: kbmCode,
  });
};

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
  await api.post("/emr/actions", {
    encounter_no: encounterNo,
    action_code: actionCode,
    action_name: actionName,
    price,
    notes
  });
};

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

export const getMedicalRecord = async (encounterNo: string): Promise<GetMedicalRecordResponse | null> => {
  try {
    const { data } = await api.get<{ data: GetMedicalRecordResponse }>(`/emr/record/${encounterNo}`);
    return data?.data;
  } catch (error) {
    console.error("Failed to fetch medical record", error);
    return null;
  }
};

export interface SNOMEDICD10MapDetail {
  icd10_code: string;
  icd10_name_id: string;
  icd10_name_en: string;
  chapter_code: string;
  block_code: string;
  map_group: number;
  map_priority: number;
  map_rule: string;
  map_advice: string;
  is_primary: boolean;
}

export interface SNOMEDICD9MapDetail {
  icd9_code: string;
  icd9_name_id: string;
  icd9_name_en: string;
  category: string;
  is_primary: boolean;
}

export interface SNOMEDMappingResponse {
  concept_id: string;
  icd10_mappings: SNOMEDICD10MapDetail[];
  icd9_mappings: SNOMEDICD9MapDetail[];
}

export const getSNOMEDMappings = async (conceptId: string): Promise<SNOMEDMappingResponse | null> => {
  try {
    const { data } = await api.get<{ data: SNOMEDMappingResponse }>(`/master/snomed/${conceptId}/mappings`);
    return data?.data || null;
  } catch (error) {
    console.error("Failed to fetch SNOMED mappings", error);
    return null;
  }
};

export interface PolyclinicItem {
  code: string;
  name: string;
}

export interface ICD10SuggestionItem {
  icd10_code: string;
  icd10_name: string;
  is_primary: boolean;
  mapping_confidence?: string;
}

export interface KBMICD10SuggestionsResponse {
  suggestions: ICD10SuggestionItem[];
  polyclinics?: PolyclinicItem[];
}

export const getKBMICD10Suggestions = async (kbmCode: string): Promise<KBMICD10SuggestionsResponse> => {
  try {
    const { data } = await api.get<{ data: any }>(`/master/kbm/${kbmCode}/icd10-suggestions`);
    if (Array.isArray(data?.data)) {
      return { suggestions: data.data, polyclinics: [] };
    }
    return {
      suggestions: data?.data?.suggestions || [],
      polyclinics: data?.data?.polyclinics || [],
    };
  } catch (error) {
    console.error("Failed to fetch ICD-10 suggestions for KBM", error);
    return { suggestions: [], polyclinics: [] };
  }
};

export interface ICD10MappingDetailsResponse {
  icd10_code: string;
  kbm_mappings?: {
    kbm_code: string;
    kbm_name: string;
    is_primary: boolean;
    mapping_confidence: string;
  }[];
  snomed_mappings?: {
    concept_id: string;
    fsn: string;
    term_id: string;
    semantic_tag: string;
    is_active: boolean;
  }[];
  polyclinics?: PolyclinicItem[];
}

export const getICD10Mappings = async (icd10Code: string): Promise<ICD10MappingDetailsResponse | null> => {
  try {
    const { data } = await api.get<{ data: ICD10MappingDetailsResponse }>(`/master/icd10/${icd10Code}/mappings`);
    return data?.data || null;
  } catch (error) {
    console.error("Failed to fetch ICD-10 mapping details", error);
    return null;
  }
};

export interface ICD9MappingDetailsResponse {
  icd9_code: string;
  snomed_mappings?: {
    concept_id: string;
    fsn: string;
    term_id: string;
    semantic_tag: string;
    is_active: boolean;
  }[];
  tindakan_mappings?: {
    kode_tindakan: string;
    nama_tindakan: string;
    base_price: number;
    is_primary: boolean;
  }[];
  polyclinics?: PolyclinicItem[];
}

export const getICD9Mappings = async (icd9Code: string): Promise<ICD9MappingDetailsResponse | null> => {
  try {
    const { data } = await api.get<{ data: ICD9MappingDetailsResponse }>(`/master/icd9/${icd9Code}/mappings`);
    return data?.data || null;
  } catch (error) {
    console.error("Failed to fetch ICD-9 mapping details", error);
    return null;
  }
};

export interface ICD9SuggestionItem {
  icd9_code: string;
  icd9_name: string;
  is_primary: boolean;
}

export interface TindakanICD9SuggestionsResponse {
  suggestions: ICD9SuggestionItem[];
  polyclinics?: PolyclinicItem[];
}

export const getICD9SuggestionsForTindakan = async (kodeTindakan: string): Promise<TindakanICD9SuggestionsResponse> => {
  try {
    const { data } = await api.get<{ data: any }>(`/master/tindakan/${kodeTindakan}/icd9-suggestions`);
    if (Array.isArray(data?.data)) {
      return { suggestions: data.data, polyclinics: [] };
    }
    return {
      suggestions: data?.data?.suggestions || [],
      polyclinics: data?.data?.polyclinics || [],
    };
  } catch (error) {
    console.error("Failed to fetch ICD-9 suggestions for Tindakan", error);
    return { suggestions: [], polyclinics: [] };
  }
};

// -- KFA & BPJS DPHO Master & Mapping API --
export interface KFAItem {
  kfa_code: string;
  name: string;
  active_substance?: string;
  dosage_form?: string;
  strength?: string;
  bpom_nie?: string;
  atc_code?: string;
  snomed_concept_id?: string;
  is_active?: boolean;
  mapped_item_count?: number;
}

export interface DPHOItem {
  dpho_code: string;
  dpho_name: string;
  is_fornas?: boolean;
  is_prb?: boolean;
  restriction?: string;
  max_qty_per_claim?: number;
  is_active?: boolean;
  mapped_item_count?: number;
}

export interface ObatKFAMapDetail {
  kfa_code: string;
  name: string;
  active_substance?: string;
  dosage_form?: string;
  strength?: string;
  bpom_nie?: string;
  atc_code?: string;
  snomed_concept_id?: string;
  is_primary?: boolean;
  mapping_confidence?: string;
}

export interface ObatDPHOMapDetail {
  dpho_code: string;
  dpho_name: string;
  is_fornas?: boolean;
  is_prb?: boolean;
  restriction?: string;
  max_qty_per_claim?: number;
}

export interface ObatMappingDetailsResponse {
  item_code: string;
  kfa_mappings: ObatKFAMapDetail[];
  dpho_mappings: ObatDPHOMapDetail[];
  polyclinics: string[];
}

export const getObatMappingDetails = async (itemCode: string): Promise<ObatMappingDetailsResponse> => {
  try {
    const { data } = await api.get<{ data: any }>(`/master/obat/${itemCode}/mappings`);
    return {
      item_code: data?.data?.item_code || itemCode,
      kfa_mappings: data?.data?.kfa_mappings || [],
      dpho_mappings: data?.data?.dpho_mappings || [],
      polyclinics: data?.data?.polyclinics || [],
    };
  } catch (error) {
    console.error("Failed to fetch Obat mapping details", error);
    return { item_code: itemCode, kfa_mappings: [], dpho_mappings: [], polyclinics: [] };
  }
};

