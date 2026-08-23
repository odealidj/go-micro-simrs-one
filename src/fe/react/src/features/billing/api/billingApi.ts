import { api } from "@/lib/api";

export interface InvoiceItem {
  item_type?: string;
  description: string;
  amount: number;
  quantity?: number;
  unit_price?: number;
  total?: number;
  category?: string;
}

export interface Invoice {
  invoice_id: string;
  encounter_no: string;
  patient_name?: string;
  mrn?: string;
  poli_name?: string;
  doctor_name?: string;
  visit_date?: string;
  items: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  total_amount: number;
  status: string;
  created_at?: string;
}

export interface BillingPatientQueueItem {
  encounter_no: string;
  mrn: string;
  patient_name: string;
  gender?: string;
  date_of_birth?: string;
  department_code: string;
  doctor_id?: string;
  status: string;
  status_pasien?: string;
  registered_time: string;
  estimated_amount?: number;
}

export interface PayInvoiceRequest {
  invoice_id: string;
  payment_method: string;
  amount_paid: number;
}

export const getBillingQueue = async (dateStr?: string): Promise<BillingPatientQueueItem[]> => {
  try {
    const url = dateStr ? `/registrations/today?date=${dateStr}` : "/registrations/today";
    const { data } = await api.get<any>(url);
    let rawList: any[] = [];
    if (Array.isArray(data?.data)) {
      rawList = data.data;
    } else if (Array.isArray(data?.data?.encounters)) {
      rawList = data.data.encounters;
    }

    return rawList.map((e: any) => ({
      encounter_no: e.encounter_no,
      mrn: e.mrn || e.patient_mrn || "-",
      patient_name: e.patient_name || e.name || e.mrn,
      gender: e.gender || e.patient_gender || "-",
      date_of_birth: e.date_of_birth || e.patient_birthdate || e.dob || "-",
      department_code: e.department_code || "-",
      doctor_id: e.doctor_id || "-",
      status: e.status || "WAITING_FOR_PAYMENT",
      status_pasien: e.status_pasien || e.guarantor || "Umum",
      registered_time: e.registered_time || "",
    }));
  } catch (error) {
    console.error("Failed to load billing queue", error);
    return [];
  }
};

export const getInvoice = async (encounterNo: string): Promise<Invoice | null> => {
  try {
    const { data } = await api.get<any>(`/billing/invoice/${encounterNo}`);
    const res = data?.data;
    if (!res) return null;

    const items: InvoiceItem[] = (res.items || res.Items || []).map((it: any) => ({
      item_type: it.item_type || it.ItemType || "ACTION",
      description: it.description || it.Description || "Layanan",
      amount: Number(it.amount || it.Amount || 0),
      quantity: 1,
      total: Number(it.amount || it.Amount || 0),
      category: it.item_type || it.ItemType || "Layanan",
    }));

    const totalAmount = Number(res.total_amount || res.TotalAmount || res.total || 0);

    return {
      invoice_id: res.invoice_id || res.InvoiceId || `INV-${encounterNo}`,
      encounter_no: encounterNo,
      patient_name: res.patient_name || "",
      mrn: res.mrn || "",
      poli_name: res.poli_name || "",
      doctor_name: res.doctor_name || "",
      visit_date: res.visit_date || new Date().toISOString(),
      items: items,
      total_amount: totalAmount,
      status: res.status || (totalAmount > 0 ? "UNPAID" : "UNPAID"),
      created_at: res.created_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch invoice", error);
    return null;
  }
};

export const payInvoice = async (payload: PayInvoiceRequest): Promise<boolean> => {
  try {
    await api.post("/billing/pay", {
      invoice_id: payload.invoice_id,
      amount_paid: Number(payload.amount_paid),
      payment_method: payload.payment_method,
    });
    return true;
  } catch (error) {
    console.error("Failed to pay invoice", error);
    throw error;
  }
};
