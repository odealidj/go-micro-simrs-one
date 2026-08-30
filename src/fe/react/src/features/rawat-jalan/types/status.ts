/**
 * Master Status Definitions for SIMRS Microservices
 * - EncounterStatus: Alur kunjungan pasien dari domain registration (master_encounter_status)
 * - MedicalRecordStatus: Alur rekam medis dari domain rawat_jalan (master_emr_status)
 */

export type EncounterStatus =
  | "REGISTERED"
  | "WAITING_FOR_PAYMENT"
  | "QUEUED_FOR_POLI"
  | "IN_PROGRESS"
  | "IN_EXAMINATION"
  | "COMPLETED"
  | "CANCELLED";

export type MedicalRecordStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Status kunjungan yang siap diperiksa / ditriage di poliklinik */
export const QUEUED_STATUSES: string[] = ["REGISTERED", "QUEUED_FOR_POLI"];

/** Helper untuk memeriksa apakah pasien siap diperiksa di poli */
export const isReadyForExam = (status?: string): boolean => {
  if (!status) return false;
  return QUEUED_STATUSES.includes(status);
};

/** Helper untuk memeriksa apakah pasien belum bayar */
export const isWaitingForPayment = (status?: string): boolean => {
  return status === "WAITING_FOR_PAYMENT";
};

/** Helper untuk memeriksa apakah pemeriksaan sedang berlangsung */
export const isInProgress = (status?: string): boolean => {
  return status === "IN_PROGRESS" || status === "IN_EXAMINATION";
};

/** Helper untuk memeriksa apakah kunjungan/pemeriksaan telah selesai */
export const isCompleted = (status?: string): boolean => {
  return status === "COMPLETED";
};

/** Helper untuk memeriksa apakah kunjungan dibatalkan */
export const isCancelled = (status?: string): boolean => {
  return status === "CANCELLED" || status === "BATAL";
};
