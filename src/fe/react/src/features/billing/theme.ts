/**
 * Centralized Design System & Theme Tokens for Kasir & Pembayaran (Billing Module)
 * 
 * Best Practice:
 * When changing brand colors, typography, layout rules, or status styling for Kasir,
 * update this file to reflect changes across all Kasir pages and components.
 */

export const kasirTheme = {
  // Brand Metadata
  brand: {
    systemName: "Codina SIMRS",
    moduleName: "Kasir & Pembayaran",
    shortName: "Kasir",
  },

  // Color Tokens (Orange / Amber Brand Palette)
  colors: {
    primary: {
      base: "bg-amber-600 hover:bg-amber-700 text-white",
      hover: "hover:bg-amber-700",
      light: "bg-amber-50/80 text-amber-800 border-amber-200/70",
      text: "text-amber-600",
      textDark: "text-amber-800",
      border: "border-amber-200",
      ring: "focus:ring-2 focus:ring-amber-500",
      gradient: "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600",
      cardGradient: "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent",
      shadow: "shadow-md shadow-amber-600/15",
    },
    accent: {
      orange: "bg-orange-50/90 text-orange-700 border-orange-200/60",
      orangeText: "text-orange-600",
      emerald: "bg-emerald-50/90 text-emerald-700 border-emerald-200/60",
      emeraldText: "text-emerald-600",
      blue: "bg-sky-50/90 text-sky-700 border-sky-200/60",
      blueText: "text-sky-600",
      purple: "bg-purple-50/90 text-purple-700 border-purple-200/60",
      purpleText: "text-purple-600",
    },
    status: {
      success: "bg-emerald-50/90 text-emerald-700 border-emerald-200/60",
      successDot: "bg-emerald-500",
      warning: "bg-amber-50/90 text-amber-800 border-amber-200/80",
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
      inputBg: "bg-white border-slate-200 hover:border-slate-300 focus:border-amber-500",
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
    container: "max-w-7xl mx-auto space-y-6",
    gridStats: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
    gridTwoCol: "grid grid-cols-1 lg:grid-cols-12 gap-6",
    colMain: "lg:col-span-8 space-y-6",
    colSide: "lg:col-span-4 space-y-6",
    modalContent: "sm:max-w-2xl md:max-w-3xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl w-[95vw]",
  },
};

/**
 * Status style resolver for Kasir tables and badges
 */
export function getKasirStatusBadge(status: string) {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "PAID":
    case "LUNAS":
    case "SUCCESS":
    case "COMPLETED":
    case "SELESAI":
      return {
        className: kasirTheme.colors.status.success,
        dotClass: kasirTheme.colors.status.successDot,
        label: "Lunas",
      };
    case "WAITING_FOR_PAYMENT":
    case "MENUNGGU_PEMBAYARAN":
    case "UNPAID":
    case "REGISTERED":
    case "PENDING":
      return {
        className: kasirTheme.colors.status.warning,
        dotClass: kasirTheme.colors.status.warningDot,
        label: "Menunggu Pembayaran",
      };
    case "CANCELLED":
    case "BATAL":
    case "EXPIRED":
      return {
        className: kasirTheme.colors.status.danger,
        dotClass: kasirTheme.colors.status.dangerDot,
        label: "Dibatalkan",
      };
    case "QUEUED_FOR_POLI":
    case "IN_PROGRESS":
      return {
        className: kasirTheme.colors.status.info,
        dotClass: kasirTheme.colors.status.infoDot,
        label: "Antre Poli",
      };
    default:
      return {
        className: kasirTheme.colors.status.neutral,
        dotClass: kasirTheme.colors.status.neutralDot,
        label: status || "—",
      };
  }
}

/**
 * Helper to format Rupiah currency nicely
 */
export function formatRupiah(amount: number | string | undefined | null) {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount || 0);
  if (isNaN(num)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
}
