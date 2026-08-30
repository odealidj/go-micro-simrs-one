export * from "./status";

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

export interface EncounterDiagnosis {
  id: string;
  icd10_code: string;
  icd10_name: string;
  diagnosis_type: "PRIMARY" | "SECONDARY" | "DIFFERENTIAL" | string;
  sequence: number;
  clinical_notes: string;
  severity_level: "I" | "II" | "III" | string;
  severity_set_role: string;
  auto_kbm_code: string;
  auto_kbm_name: string;
  kbm_mapping_confidence: string;
  is_verified_by_rm: boolean;
  verified_by: string;
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

export interface ClinicalChecklist {
  triage_completed: boolean;
  diagnosis_completed: boolean;
  actions_completed: boolean;
  actions_count: number;
  prescription_completed: boolean;
  prescription_count: number;
  is_ready_to_complete: boolean;
  missing_mandatory_fields: string[];
  base_consultation_fee?: string;
}

export interface GetMedicalRecordResponse {
  encounter_no: string;
  patient_mrn: string;
  patient_name?: string;
  triage: TriageData;
  diagnoses: EncounterDiagnosis[];
  encounter_severity_level?: string;
  actions: MedicalAction[];
  prescriptions?: PrescriptionDraftItem[];
  disposition?: DispositionData;
  notes: string;
  status?: string;
  checklist?: ClinicalChecklist;
}
