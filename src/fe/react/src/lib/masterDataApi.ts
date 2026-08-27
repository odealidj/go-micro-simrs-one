/**
 * masterDataApi.ts
 *
 * API layer untuk data master katalog klinis (ICD-10, ICD-9, KBM, SNOMED, Tindakan, Obat).
 * Digunakan oleh admin pages dan medical-record feature.
 * Tidak bergantung pada feature emr, rawat-jalan, atau medical-record.
 */
import { api } from "@/lib/api";

// ─── ICD-10 ───────────────────────────────────────────────────────────────────

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

// ─── ICD-9 ───────────────────────────────────────────────────────────────────

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

// ─── KBM ─────────────────────────────────────────────────────────────────────

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

// ─── SNOMED-CT ───────────────────────────────────────────────────────────────

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

// ─── Obat / Farmasi ───────────────────────────────────────────────────────────

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
