"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastVariant = "info" | "success" | "warning";

export interface ToastProps {
  title: string;
  description?: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<ToastVariant, string> = {
  info: "bg-sky-50 border-sky-200 text-sky-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
};

export function Toast({
  title,
  description,
  variant = "info",
  onDismiss,
  className,
}: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3 flex items-start justify-between gap-3 text-xs sm:text-sm shadow-xs",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        {variantIcons[variant]}
        <div>
          <p className="font-semibold">{title}</p>
          {description && (
            <p className="opacity-90 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
