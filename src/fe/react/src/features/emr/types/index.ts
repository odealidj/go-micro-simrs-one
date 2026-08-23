export interface TriageData {
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  temperature: number;
  heart_rate: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  height?: number; // in cm
  weight?: number; // in kg
  bmi?: number;
  allergies?: string;
  notes: string;
}

export interface MedicalAction {
  id?: string;
  action_code: string;
  action_name: string;
  price: number;
  quantity?: number;
  performer?: string; // "DOKTER" | "PERAWAT" | "BERSAMA"
  notes?: string;
}

export interface KBMItem {
  kbm_code: string;
  kbm_name: string;
  description: string;
  body_system: string;
  polyclinics: string[];
}

export interface SecondaryDiagnosis {
  icd10_code: string;
  name: string;
  category?: "KOMORBID" | "KOMPLIKASI" | "BANDING" | string;
}

export interface PrescriptionDraftItem {
  drug_code: string;
  drug_name: string;
  quantity: number;
  unit: string;
  dosage: string;
  notes?: string;
}

export interface DispositionData {
  status: "PULANG" | "KONTROL" | "KONSUL_POLI" | "RAWAT_INAP" | "RUJUK_LUAR" | string;
  follow_up_date?: string;
  target_poly?: string;
  education_notes?: string;
}

export interface EncounterDetail {
  encounter_no: string;
  mrn: string;
  department_code: string;
  doctor_id: string;
  status: string;
  registered_time: string;
  patient_name?: string;
  patient_gender?: string;
  patient_birthdate?: string;
  guarantor?: string;
}

export interface GetMedicalRecordResponse {
  encounter_no: string;
  patient_mrn: string;
  patient_name?: string;
  triage: TriageData;
  icd10_codes: string[];
  kbm_code: string;
  kbm_name: string;
  icd10_mapping_status: string;
  secondary_diagnoses?: SecondaryDiagnosis[];
  actions: MedicalAction[];
  prescriptions?: PrescriptionDraftItem[];
  disposition?: DispositionData;
  notes: string;
}
