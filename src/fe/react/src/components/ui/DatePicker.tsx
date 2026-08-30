import { useState, useRef, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  toHospitalDateString, 
  getHospitalTodayDate, 
  formatHospitalDate,
  parseDateOnly
} from "@/lib/dateUtils";

export interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  highlightWeekends?: boolean;
  showPresets?: boolean;
  presetMode?: "default" | "weekend";
  required?: boolean;
  id?: string;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const WEEKDAY_NAMES = [
  { key: 1, label: "Sen", full: "Senin", isWeekend: false },
  { key: 2, label: "Sel", full: "Selasa", isWeekend: false },
  { key: 3, label: "Rab", full: "Rabu", isWeekend: false },
  { key: 4, label: "Kam", full: "Kamis", isWeekend: false },
  { key: 5, label: "Jum", full: "Jumat", isWeekend: false },
  { key: 6, label: "Sab", full: "Sabtu", isWeekend: true },
  { key: 0, label: "Min", full: "Minggu", isWeekend: true },
];

export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal...",
  className,
  disabled = false,
  minDate,
  maxDate,
  highlightWeekends = true,
  showPresets = true,
  presetMode = "default",
  required = false,
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize selected value
  const selectedDateStr = value ? toHospitalDateString(value) : "";

  // View state (Year and Month being viewed)
  const todayStr = getHospitalTodayDate();
  const initialDate = selectedDateStr ? parseDateOnly(selectedDateStr) : parseDateOnly(todayStr);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Sync view when value changes or when opened
  useEffect(() => {
    if (selectedDateStr) {
      const d = parseDateOnly(selectedDateStr);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [selectedDateStr, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Build calendar matrix
  // 1. Day of week of first day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  // We want Monday as column 0, Sunday as column 6:
  const startCol = (firstDayOfWeek === 0 ? 7 : firstDayOfWeek) - 1;

  // 2. Number of days in current month
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // 3. Number of days in previous month
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handleSelectDay = (day: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const formatted = `${viewYear}-${monthStr}-${dayStr}`;
    onChange(formatted);
    setIsOpen(false);
  };

  // Quick Preset Handlers
  const handleSelectToday = () => {
    onChange(todayStr);
    setIsOpen(false);
  };

  const handleSelectThisSaturday = () => {
    const now = parseDateOnly(todayStr);
    const day = now.getDay(); // 0 is Sunday, 6 is Saturday
    const diff = (6 - day + 7) % 7;
    const target = new Date(now);
    target.setDate(now.getDate() + diff);
    onChange(toHospitalDateString(target));
    setIsOpen(false);
  };

  const handleSelectThisSunday = () => {
    const now = parseDateOnly(todayStr);
    const day = now.getDay(); // 0 is Sunday
    const diff = day === 0 ? 0 : 7 - day;
    const target = new Date(now);
    target.setDate(now.getDate() + diff);
    onChange(toHospitalDateString(target));
    setIsOpen(false);
  };

  const handleSelectNextWeekend = () => {
    const now = parseDateOnly(todayStr);
    const day = now.getDay();
    // Next week Saturday:
    const diffToSat = ((6 - day + 7) % 7) + 7;
    const target = new Date(now);
    target.setDate(now.getDate() + diffToSat);
    onChange(toHospitalDateString(target));
    setIsOpen(false);
  };

  const handleSelectTomorrow = () => {
    const now = parseDateOnly(todayStr);
    now.setDate(now.getDate() + 1);
    onChange(toHospitalDateString(now));
    setIsOpen(false);
  };

  const handleSelectNextMonday = () => {
    const now = parseDateOnly(todayStr);
    const day = now.getDay();
    const diff = ((1 - day + 7) % 7) || 7;
    now.setDate(now.getDate() + diff);
    onChange(toHospitalDateString(now));
    setIsOpen(false);
  };

  const handleSelectStartOfMonth = () => {
    const now = parseDateOnly(todayStr);
    const target = new Date(now.getFullYear(), now.getMonth(), 1);
    onChange(toHospitalDateString(target));
    setIsOpen(false);
  };

  // Check if selected date is weekend
  const isSelectedWeekend = (() => {
    if (!selectedDateStr) return false;
    const d = parseDateOnly(selectedDateStr).getDay();
    return d === 0 || d === 6;
  })();

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button (Looks like a clean, interactive input) */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-left text-sm",
          "flex items-center justify-between gap-2 shadow-2xs transition-all",
          "hover:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500",
          isOpen && "border-sky-600 ring-2 ring-sky-500/20",
          disabled && "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="p-1 rounded-lg bg-sky-50 text-sky-600 shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          {selectedDateStr ? (
            <span className="font-semibold text-slate-800 truncate">
              {formatHospitalDate(selectedDateStr, { month: "short" })}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedDateStr && highlightWeekends && isSelectedWeekend && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Weekend
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-200",
              isOpen && "transform rotate-180 text-sky-600"
            )}
          />
        </div>
      </button>

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={selectedDateStr}
          required={required}
          className="sr-only"
          tabIndex={-1}
          readOnly
        />
      )}

      {/* Calendar Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-76 sm:w-80 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-3.5 animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Popover Header: Month & Year Navigator */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
              <span>{MONTH_NAMES[viewMonth]}</span>
              <span>{viewYear}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Presets for Easy Selection */}
          {showPresets && (
            <div className="flex flex-wrap items-center gap-1 mb-3 pb-2.5 border-b border-slate-100 text-[11px]">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                Hari Ini
              </button>

              {presetMode === "weekend" ? (
                <>
                  <button
                    type="button"
                    onClick={handleSelectThisSaturday}
                    className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold border border-amber-200/60 transition-colors"
                  >
                    Sabtu Ini
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectThisSunday}
                    className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold border border-amber-200/60 transition-colors"
                  >
                    Minggu Ini
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectNextWeekend}
                    className="px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold border border-sky-200/60 transition-colors"
                  >
                    Sabtu Depan
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSelectTomorrow}
                    className="px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold border border-sky-200/60 transition-colors"
                  >
                    Besok
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectNextMonday}
                    className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200/60 transition-colors"
                  >
                    Senin Depan
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectStartOfMonth}
                    className="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium border border-slate-200/60 transition-colors"
                  >
                    Awal Bulan
                  </button>
                </>
              )}
            </div>
          )}

          {/* Weekday Column Headers (Sen, Sel, Rab, Kam, Jum, Sab, Min) */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((w) => (
              <div
                key={w.key}
                className={cn(
                  "py-1 text-[11px] font-bold uppercase tracking-wider rounded-sm",
                  w.isWeekend ? "text-amber-700 bg-amber-50/50" : "text-slate-400"
                )}
                title={w.full}
              >
                {w.label}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous Month trailing days */}
            {Array.from({ length: startCol }).map((_, idx) => {
              const dayNum = daysInPrevMonth - startCol + idx + 1;
              return (
                <div
                  key={`prev-${idx}`}
                  className="h-8 flex items-center justify-center text-xs text-slate-300 pointer-events-none select-none"
                >
                  {dayNum}
                </div>
              );
            })}

            {/* Current Month days */}
            {Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const monthStr = String(viewMonth + 1).padStart(2, "0");
              const dayStr = String(dayNum).padStart(2, "0");
              const currentDateIso = `${viewYear}-${monthStr}-${dayStr}`;

              const isSelected = currentDateIso === selectedDateStr;
              const isToday = currentDateIso === todayStr;

              // Check if day is Saturday or Sunday
              const dayOfWeek = (startCol + idx) % 7;
              const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6; // 5 = Sab, 6 = Min

              // Disabled if minDate / maxDate set
              const isDisabled = Boolean(
                (minDate && currentDateIso < minDate) ||
                (maxDate && currentDateIso > maxDate)
              );

              return (
                <button
                  key={`curr-${dayNum}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(dayNum)}
                  className={cn(
                    "h-8 w-full rounded-lg text-xs font-semibold flex items-center justify-center relative transition-all",
                    "hover:bg-slate-100 hover:text-slate-900 cursor-pointer",
                    // Weekend styling highlight
                    highlightWeekends && isWeekendDay && !isSelected && "text-amber-700 bg-amber-50/40 hover:bg-amber-100/60 font-bold",
                    // Today styling
                    isToday && !isSelected && "border border-sky-500 text-sky-700 font-bold",
                    // Selected styling
                    isSelected && "bg-sky-600 text-white font-bold shadow-xs hover:bg-sky-700 hover:text-white",
                    // Disabled styling
                    isDisabled && "opacity-25 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  <span>{dayNum}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-sky-600"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer note: Preview of selected date */}
          {selectedDateStr && (
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Terpilih:</span>
              <span className="font-bold text-slate-800">
                {formatHospitalDate(selectedDateStr, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
