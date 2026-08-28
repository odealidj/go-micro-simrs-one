import React from "react";
import { AlertTriangle, Info, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ItemDetail {
  label: string;
  value: React.ReactNode;
}

export interface ModernConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
  itemDetails?: ItemDetail[];
  note?: string;
}

export const ModernConfirmModal: React.FC<ModernConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  variant = "danger",
  isLoading = false,
  itemDetails,
  note,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconBg: "bg-red-50 text-red-600 ring-8 ring-red-500/10",
          icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
          confirmBtn:
            "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 focus:ring-red-500",
        };
      case "warning":
        return {
          iconBg: "bg-amber-50 text-amber-600 ring-8 ring-amber-500/10",
          icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
          confirmBtn:
            "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/25 focus:ring-amber-500",
        };
      case "info":
      default:
        return {
          iconBg: "bg-blue-50 text-blue-600 ring-8 ring-blue-500/10",
          icon: <Info className="w-6 h-6 text-blue-600" />,
          confirmBtn:
            "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 focus:ring-blue-500",
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Tutup</span>
        </button>

        {/* Icon & Title */}
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform ${vStyles.iconBg}`}
          >
            {vStyles.icon}
          </div>

          <div className="flex-1 pr-4">
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {title}
            </h3>
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        {/* Item Details Box (if any) */}
        {itemDetails && itemDetails.length > 0 && (
          <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1.5">
            {itemDetails.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-medium">{item.label}</span>
                <span className="font-semibold text-slate-800 text-right">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Important Warning Note */}
        {note && (
          <div className="mt-3 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="leading-tight">{note}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={onClose}
            className="rounded-xl px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isLoading}
            onClick={onConfirm}
            className={`rounded-xl px-4 text-xs font-semibold transition-all ${vStyles.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Memproses...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
