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

export interface InvoiceDetail {
  invoice_id: string;
  encounter_no: string;
  total_amount: number;
  status: string;
  is_paid: boolean;
  items: InvoiceItem[];
  created_at: string;
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
  is_paid?: boolean;
  invoices?: InvoiceDetail[];
  created_at?: string;
}

export const getInvoicesByEncounter = async (encounterNo: string): Promise<InvoiceDetail[]> => {
  try {
    const { data } = await api.get<any>(`/billing/invoices/${encounterNo}`);
    return data?.data || [];
  } catch (error) {
    console.error("Failed to fetch invoices by encounter", error);
    return [];
  }
};

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
  payment_status?: string;
  has_unpaid?: boolean;
  total_amount?: number;
  paid_amount?: number;
  unpaid_amount?: number;
  active_invoice_id?: string;
  invoices?: InvoiceDetail[];
  estimated_amount?: number;
}

export interface PayInvoiceRequest {
  invoice_id: string;
  payment_method: string;
  amount_paid: number;
}

export const getBillingQueue = async (dateStr?: string): Promise<BillingPatientQueueItem[]> => {
  try {
    const url = dateStr ? `/billing/queue?date=${dateStr}` : "/billing/queue";
    const { data } = await api.get<any>(url);
    let rawList: any[] = [];
    if (Array.isArray(data?.data)) {
      rawList = data.data;
    } else if (Array.isArray(data?.data?.encounters)) {
      rawList = data.data.encounters;
    } else if (Array.isArray(data?.data?.queue)) {
      rawList = data.data.queue;
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
      payment_status: e.payment_status || (e.status === "WAITING_FOR_PAYMENT" ? "UNPAID" : "PAID"),
      has_unpaid: Boolean(e.has_unpaid ?? (e.status === "WAITING_FOR_PAYMENT" || e.status === "REGISTERED")),
      total_amount: Number(e.total_amount ?? 50000),
      paid_amount: Number(e.paid_amount ?? 0),
      unpaid_amount: Number(e.unpaid_amount ?? (e.has_unpaid ? 50000 : 0)),
      active_invoice_id: e.active_invoice_id || "",
      invoices: Array.isArray(e.invoices)
        ? e.invoices.map((inv: any) => ({
            invoice_id: inv.invoice_id || inv.InvoiceId,
            encounter_no: inv.encounter_no || inv.EncounterNo || e.encounter_no,
            total_amount: Number(inv.total_amount || inv.TotalAmount || 0),
            status: inv.status || inv.Status || "UNPAID",
            is_paid: Boolean(inv.is_paid || inv.IsPaid || inv.status === "PAID"),
            items: (inv.items || inv.Items || []).map((it: any) => ({
              item_type: it.item_type || it.ItemType || "ACTION",
              description: it.description || it.Description || "Layanan",
              amount: Number(it.amount || it.Amount || 0),
              quantity: 1,
              total: Number(it.amount || it.Amount || 0),
              category: it.item_type || it.ItemType || "Layanan",
            })),
            created_at: inv.created_at || inv.CreatedAt || new Date().toISOString(),
          }))
        : [],
    }));
  } catch (error) {
    console.error("Failed to load billing queue from /billing/queue", error);
    // Fallback to /registrations/today if error
    try {
      const regUrl = dateStr ? `/registrations/today?date=${dateStr}` : "/registrations/today";
      const { data } = await api.get<any>(regUrl);
      const list = Array.isArray(data?.data) ? data.data : data?.data?.encounters || [];
      return list.map((e: any) => ({
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
        has_unpaid: e.status === "WAITING_FOR_PAYMENT" || e.status === "REGISTERED",
      }));
    } catch {
      return [];
    }
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
      is_paid: Boolean(res.is_paid || res.status === "PAID"),
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

export interface RevenueReportMetrics {
  total_revenue: number;
  total_transactions: number;
  tunai_amount: number;
  tunai_count: number;
  qris_amount: number;
  qris_count: number;
  debit_amount: number;
  debit_count: number;
  bpjs_amount: number;
  bpjs_count: number;
  non_tunai_amount: number;
  non_tunai_count: number;
}

export interface ServiceBreakdownItem {
  department_code: string;
  department_name: string;
  count: number;
  total: number;
}

export interface SettlementItem {
  item_type?: string;
  description: string;
  qty: number;
  amount: number;
}

export interface SettlementTransactionItem {
  encounter_no: string;
  mrn: string;
  patient_name: string;
  department_code: string;
  department_name: string;
  payment_method: "CASH" | "QRIS" | "DEBIT" | "BPJS";
  total_amount: number;
  paid_at: string;
  cashier_name: string;
  status: string;
  items?: SettlementItem[];
}

export interface RevenueReportData {
  period: string;
  metrics: RevenueReportMetrics;
  service_breakdown: ServiceBreakdownItem[];
  transactions: SettlementTransactionItem[];
}

export const getRevenueReport = async (params?: {
  date?: string;
  start_date?: string;
  end_date?: string;
  department_code?: string;
  payment_method?: string;
}): Promise<RevenueReportData | null> => {
  try {
    const query = new URLSearchParams();
    if (params?.start_date) query.append("start_date", params.start_date);
    if (params?.end_date) query.append("end_date", params.end_date);
    if (params?.date && params.date !== "TODAY") query.append("date", params.date);
    if (params?.department_code && params.department_code !== "ALL") query.append("department_code", params.department_code);
    if (params?.payment_method && params.payment_method !== "ALL") query.append("payment_method", params.payment_method);

    const qs = query.toString() ? `?${query.toString()}` : "";
    const { data } = await api.get<{ success: boolean; data: RevenueReportData }>(`/billing/reports/rekap${qs}`);
    return data?.data || null;
  } catch (error) {
    console.error("Failed to fetch revenue report from backend", error);
    return null;
  }
};

