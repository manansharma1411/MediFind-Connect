import React from "react";
import { cn } from "@/lib/cn";

export function TableContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]",
        className
      )}
    >
      <table className="w-full text-left border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function TableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        "bg-slate-50/90 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500",
        className
      )}
    >
      {children}
    </thead>
  );
}

export function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={cn("py-3.5 px-4 whitespace-nowrap", className)}>{children}</th>;
}

export function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("py-3.5 px-4 text-slate-700 align-middle", className)}>{children}</td>;
}
