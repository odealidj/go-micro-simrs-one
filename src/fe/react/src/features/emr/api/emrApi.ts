import { api } from "@/lib/api";
import type {
  EncounterDetail,
  GetMedicalRecordResponse,
  KBMItem,
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

export const searchKBM = async (query: string, deptCode?: string): Promise<KBMItem[]> => {
  const params = new URLSearchParams();
  if (query) params.append("q", query);
  if (deptCode) params.append("dept_code", deptCode);
  
  const { data } = await api.get<{ data: { items: KBMItem[] } }>(`/emr/kbm/search?${params.toString()}`);
  return data?.data?.items || [];
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
      name: item.name || item.description || item.icd10_code,
    }));
  } catch {
    return [];
  }
};

export const addDiagnosisKBM = async (
  encounterNo: string,
  kbmCode: string,
  notes: string,
  doctorId: string,
  deptCode: string
): Promise<void> => {
  await api.post("/emr/diagnosis-kbm", {
    encounter_no: encounterNo,
    kbm_code: kbmCode,
    notes,
    doctor_id: doctorId,
    department_code: deptCode
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

export const searchMasterObat = async (search: string, poliCode?: string): Promise<{ code: string; name: string; price: number; stock: number }[]> => {
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
