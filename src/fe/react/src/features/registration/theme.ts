/**
 * Centralized Design System & Theme Tokens for Admisi (Registration) Module
 * 
 * Best Practice:
 * When changing brand colors, typography, layout rules, or status styling,
 * update this file to reflect changes across all Admisi pages and components.
 */

export const admisiTheme = {
  // Brand Metadata
  brand: {
    systemName: "Codina SIMRS",
    moduleName: "Admisi & Pendaftaran",
    shortName: "Admisi",
  },

  // Color Tokens
  colors: {
    primary: {
      base: "bg-sky-600 hover:bg-sky-700 text-white",
      hover: "hover:bg-sky-700",
      light: "bg-sky-50/80 text-sky-700 border-sky-100",
      text: "text-sky-600",
      textDark: "text-sky-800",
      border: "border-sky-200",
      ring: "focus:ring-2 focus:ring-sky-600",
      gradient: "bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700",
      cardGradient: "bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent",
      shadow: "shadow-md shadow-sky-600/15",
    },
    accent: {
      teal: "bg-teal-50/90 text-teal-700 border-teal-200/60",
      tealText: "text-teal-600",
      indigo: "bg-indigo-50/90 text-indigo-700 border-indigo-200/60",
      indigoText: "text-indigo-600",
      purple: "bg-purple-50/90 text-purple-700 border-purple-200/60",
      purpleText: "text-purple-600",
    },
    status: {
      success: "bg-emerald-50/90 text-emerald-700 border-emerald-200/60",
      successDot: "bg-emerald-500",
      warning: "bg-amber-50/90 text-amber-700 border-amber-200/60",
      warningDot: "bg-amber-500",
      danger: "bg-rose-50/90 text-rose-700 border-rose-200/60",
      dangerDot: "bg-rose-500",
      neutral: "bg-slate-50 text-slate-600 border-slate-200/80",
      neutralDot: "bg-slate-400",
      info: "bg-sky-50/90 text-sky-700 border-sky-200/60",
      infoDot: "bg-sky-500",
    },
    surfaces: {
      canvas: "bg-[#f8fafc]",
      card: "card-premium",
      glass: "glass-panel",
      border: "border-slate-200/80",
      subtleBorder: "border-slate-100",
      inputBg: "bg-white border-slate-200 hover:border-slate-300 focus:border-sky-500",
    },
  },

  // Typography Tokens
  typography: {
    pageTitle: "text-2xl sm:text-3xl font-bold tracking-tight text-slate-900",
    pageSubtitle: "text-sm text-slate-500 mt-1",
    sectionTitle: "text-xs font-bold uppercase tracking-wider text-slate-500",
    cardTitle: "text-base font-bold text-slate-900 tracking-tight",
    statNumber: "text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900",
    statLabel: "text-xs font-semibold text-slate-500 uppercase tracking-wider",
    badge: "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border",
    pill: "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
  },

  // Layout & Grid System
  layout: {
    container: "w-full max-w-[1600px] mx-auto flex-1 flex flex-col space-y-5 min-h-0",
    gridStats: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
    gridTwoCol: "grid grid-cols-1 lg:grid-cols-12 gap-6",
    colMain: "lg:col-span-8 space-y-6",
    colSide: "lg:col-span-4 space-y-6",
    modalContent: "sm:max-w-2xl md:max-w-3xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl w-[95vw]",
  },
};

/**
 * Status style resolver for Admisi tables and badges
 */
export function getAdmisiStatusBadge(status: string) {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "SERVING":
    case "ACTIVE":
    case "UP":
      return {
        className: admisiTheme.colors.status.success,
        dotClass: admisiTheme.colors.status.successDot,
        label: "Online",
      };
    case "SELESAI":
    case "COMPLETED":
      return {
        className: admisiTheme.colors.status.success,
        dotClass: admisiTheme.colors.status.successDot,
        label: "Selesai",
      };
    case "WAITING_FOR_PAYMENT":
    case "WAITING":
    case "PENDING":
      return {
        className: admisiTheme.colors.status.warning,
        dotClass: admisiTheme.colors.status.warningDot,
        label: "Belum Bayar",
      };
    case "REGISTERED":
    case "QUEUED":
    case "QUEUED_FOR_POLI":
    case "WAITING_FOR_TRIAGE":
    case "WAITING_FOR_EXAM":
      return {
        className: admisiTheme.colors.status.info,
        dotClass: admisiTheme.colors.status.infoDot,
        label: "Siap Diperiksa",
      };
    case "IN_PROGRESS":
      return {
        className: "bg-blue-50 text-blue-800 border-blue-200",
        dotClass: "bg-blue-500 animate-pulse",
        label: "Sedang Diperiksa",
      };
    case "CANCELLED":
    case "BATAL":
      return {
        className: admisiTheme.colors.status.danger,
        dotClass: admisiTheme.colors.status.dangerDot,
        label: "Batal",
      };
    case "DOWN":
    case "OFFLINE":
      return {
        className: admisiTheme.colors.status.danger,
        dotClass: admisiTheme.colors.status.dangerDot,
        label: "Offline",
      };
    default:
      return {
        className: admisiTheme.colors.status.neutral,
        dotClass: admisiTheme.colors.status.neutralDot,
        label: status || "—",
      };
  }
}
