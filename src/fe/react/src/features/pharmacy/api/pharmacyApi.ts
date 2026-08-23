import { api } from "@/lib/api";

export interface PrescriptionItem {
  drug_code: string;
  drug_name: string;
  quantity: number;
  unit: string;
  dosage: string;
  notes: string;
}

export interface Prescription {
  prescription_id: string;
  encounter_no: string;
  patient_name: string;
  mrn: string;
  doctor_name: string;
  poli_name: string;
  items: PrescriptionItem[];
  status: string; // PENDING | DISPENSED
  created_at: string;
}

export const createPrescription = async (encounterNo: string, items: PrescriptionItem[]): Promise<void> => {
  await api.post("/pharmacy/prescriptions", { encounter_no: encounterNo, items });
};

export const dispensePrescription = async (prescriptionId: string): Promise<void> => {
  await api.post("/pharmacy/dispense", { prescription_id: prescriptionId });
};

export const getPharmacyQueue = async (): Promise<Prescription[]> => {
  try {
    const { data } = await api.get<{ data: Prescription[] }>("/queue/pharmacy/stream");
    return data?.data || [];
  } catch {
    return [];
  }
};
