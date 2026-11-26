import React from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "info";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  brand: "bg-teal-50 text-teal-800 border-teal-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
};

const dotClasses: Record<BadgeVariant, string> = {
  neutral: "bg-slate-400",
  brand: "bg-teal-600",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-sky-500",
};

export function Badge({
  className,
  variant = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", dotClasses[variant])}
        />
      )}
      {children}
    </span>
  );
}

export type AvailabilityStatus = "in_stock" | "low_stock" | "out_of_stock";

const availabilityConfig: Record<
  AvailabilityStatus,
  { label: string; variant: BadgeVariant }
> = {
  in_stock: { label: "In Stock", variant: "success" },
  low_stock: { label: "Low Stock", variant: "warning" },
  out_of_stock: { label: "Out of Stock", variant: "error" },
};

export function AvailabilityBadge({
  status,
  quantity,
  className,
}: {
  status: AvailabilityStatus;
  quantity?: number;
  className?: string;
}) {
  const cfg = availabilityConfig[status];
  return (
    <Badge variant={cfg.variant} dot className={className}>
      {cfg.label}
      {typeof quantity === "number" ? ` (${quantity})` : ""}
    </Badge>
  );
}

export type TransferStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "dispatched"
  | "received";

const transferStatusConfig: Record<
  TransferStatus,
  { label: string; variant: BadgeVariant }
> = {
  requested: { label: "Requested", variant: "info" },
  approved: { label: "Approved", variant: "brand" },
  rejected: { label: "Rejected", variant: "error" },
  dispatched: { label: "Dispatched", variant: "warning" },
  received: { label: "Received", variant: "success" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: TransferStatus;
  className?: string;
}) {
  const cfg = transferStatusConfig[status];
  return (
    <Badge variant={cfg.variant} dot className={className}>
      {cfg.label}
    </Badge>
  );
}
