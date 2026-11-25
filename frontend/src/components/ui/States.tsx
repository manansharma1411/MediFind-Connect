import React from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

export interface StateProps {
  title?: string;
  description?: string;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function LoadingState({
  title = "Loading...",
  description = "Fetching latest network data.",
  className,
}: Omit<StateProps, "actionLabel" | "onAction">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl bg-white border border-slate-200",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Unable to complete this request. Please try again.",
  actionLabel,
  onAction,
  className,
}: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl bg-rose-50/40 border border-rose-200",
        className
      )}
      role="alert"
    >
      <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1 max-w-md">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title = "No records found",
  description = "There is nothing to display here yet.",
  actionLabel,
  onAction,
  className,
}: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl bg-white border border-dashed border-slate-300",
        className
      )}
    >
      <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
        <Inbox className="w-5 h-5" />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
