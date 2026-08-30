/**
 * SIMRS Date & Time Utilities
 * 
 * Modul terpadu untuk standardisasi penanganan tanggal dan waktu di SIMRS.
 * Memastikan konsistensi antara backend (UTC) dan frontend (WIB / Asia/Jakarta)
 * serta mencegah bug pergeseran tanggal saat pergantian hari (00:00 - 07:00 WIB).
 */

/**
 * Zona waktu operasional standar rumah sakit (WIB = UTC+7).
 */
export const HOSPITAL_TIMEZONE = "Asia/Jakarta";

/**
 * Mengambil tanggal kalender hari ini (YYYY-MM-DD) berdasarkan zona waktu rumah sakit.
 * Dijamin akurat dan tidak mundur 1 hari meskipun diakses pada pagi hari (00:00 - 06:59 WIB).
 *
 * @example
 * getHospitalTodayDate() // => "2026-08-30"
 */
export function getHospitalTodayDate(timeZone: string = HOSPITAL_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/**
 * Mengonversi input apapun (Date, string ISO UTC, string tanggal, timestamp)
 * menjadi format tanggal kalender lokal 'YYYY-MM-DD' di zona waktu rumah sakit.
 *
 * Mendukung:
 * - Date object: dikonversi sesuai zona waktu target.
 * - String tanggal kalender ("2026-08-30"): dipertahankan tanpa shift UTC midnight.
 * - String timestamp UTC ("2026-08-29T23:45:00Z"): digeser +7 jam ke waktu RS => "2026-08-30".
 * - String timestamp tanpa offset ("2026-08-30T08:00:00"): diekstrak tanggalnya.
 *
 * @example
 * toHospitalDateString()                        // => "2026-08-30" (hari ini)
 * toHospitalDateString("2026-08-30")            // => "2026-08-30" (kalender murni)
 * toHospitalDateString("2026-08-29T23:45:00Z")  // => "2026-08-30" (UTC instant shifted)
 */
export function toHospitalDateString(
  input?: Date | string | number | null,
  timeZone: string = HOSPITAL_TIMEZONE
): string {
  if (!input) {
    return getHospitalTodayDate(timeZone);
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(input);
  }

  const str = String(input).trim();

  // Jika formatnya sudah berupa tanggal kalender murni: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Jika berupa UTC instant timestamp (mengandung 'Z' atau timezone offset +07:00 / -05:00)
  if (str.includes("Z") || /[+-]\d{2}:\d{2}$/.test(str)) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone }).format(parsed);
    }
  }

  // Jika berupa ISO timestamp tanpa penanda zona waktu (contoh: "2026-08-30T08:00:00")
  if (str.includes("T")) {
    return str.split("T")[0];
  }

  // Fallback parsing date/timestamp
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(parsed);
  }

  return str;
}

/**
 * Alias untuk toHospitalDateString demi kemudahan integrasi dan backward compatibility.
 */
export const getLocalDateString = toHospitalDateString;

/**
 * Mengurai string tanggal kalender "YYYY-MM-DD" menjadi objek Date lokal.
 * Mencegah perilaku default ECMAScript `new Date("YYYY-MM-DD")` yang menganggapnya sebagai UTC midnight.
 *
 * @example
 * parseDateOnly("2026-08-30") // => Date lokal jam 00:00:00 tanggal 30 Agustus
 */
export function parseDateOnly(dateStr: string): Date {
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const [year, month, day] = clean.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * Memformat input tanggal kalender menjadi representasi teks bahasa Indonesia yang ramah pengguna.
 *
 * @example
 * formatHospitalDate("2026-08-30") // => "Minggu, 30 Agu 2026"
 * formatHospitalDate("2026-08-30", { month: "long" }) // => "Minggu, 30 Agustus 2026"
 */
export function formatHospitalDate(
  input?: Date | string | number | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateStr = toHospitalDateString(input);
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return String(input || "-");
  }

  const d = parseDateOnly(dateStr);

  return d.toLocaleDateString("id-ID", {
    weekday: options.weekday ?? "long",
    day: options.day ?? "numeric",
    month: options.month ?? "short",
    year: options.year ?? "numeric",
    ...options,
  });
}

/**
 * Memformat timestamp UTC backend menjadi waktu lengkap operasional rumah sakit (WIB).
 *
 * @example
 * formatHospitalTimestamp("2026-08-29T23:45:00Z") // => "30 Agu 2026, 06:45 WIB"
 */
export function formatHospitalTimestamp(
  utcIsoString?: string | Date | number | null,
  timeZone: string = HOSPITAL_TIMEZONE
): string {
  if (!utcIsoString) return "-";
  const d = typeof utcIsoString === "string" || typeof utcIsoString === "number"
    ? new Date(utcIsoString)
    : utcIsoString;

  if (isNaN(d.getTime())) return "-";

  const datePart = d.toLocaleDateString("id-ID", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timePart = d.toLocaleTimeString("id-ID", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart}, ${timePart} WIB`;
}

/**
 * Menentukan status komparasi tanggal terhadap hari operasional rumah sakit saat ini.
 *
 * @returns
 * - "TODAY": Tanggal sama dengan hari operasional saat ini.
 * - "PAST": Tanggal sudah lewat / selesai.
 * - "FUTURE": Tanggal di masa mendatang.
 */
export function getHospitalDateStatus(
  dateInput: string | Date | number,
  timeZone: string = HOSPITAL_TIMEZONE
): "TODAY" | "PAST" | "FUTURE" {
  const targetDate = toHospitalDateString(dateInput, timeZone);
  const today = getHospitalTodayDate(timeZone);

  if (targetDate === today) return "TODAY";
  if (targetDate < today) return "PAST";
  return "FUTURE";
}
