import React from "react";
import { admisiTheme } from "../theme";
import { cn } from "@/lib/utils";

interface QuickStat {
  label: string;
  value: string | number;
  icon?: React.ElementType;
}

interface AdmisiPageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  quickStats?: QuickStat[];
  className?: string;
}

export function AdmisiPageHeader({
  title,
  description,
  badge,
  icon: Icon,
  actions,
  quickStats,
  className,
}: AdmisiPageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Title and Metadata */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {Icon && (
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100/80 shadow-xs">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <h1 className={admisiTheme.typography.pageTitle}>{title}</h1>
            {badge && (
              <span className={cn(admisiTheme.typography.badge, admisiTheme.colors.primary.light)}>
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className={admisiTheme.typography.pageSubtitle}>{description}</p>
          )}
        </div>

        {/* Action Controls */}
        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Optional Quick Stats Strip */}
      {quickStats && quickStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {quickStats.map((stat, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {stat.label}
                </p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">
                  {stat.value}
                </p>
              </div>
              {stat.icon && (
                <div className="p-2 rounded-lg bg-slate-50 text-slate-400">
                  <stat.icon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
