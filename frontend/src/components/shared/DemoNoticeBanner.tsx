import React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

export function DemoNoticeBanner({
  title = "UI Preview Mode",
  description,
  className,
}: {
  title?: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-2xl bg-sky-50/80 border border-sky-200/90 px-4 py-3.5 flex items-start gap-3 text-xs sm:text-sm text-sky-950",
        className
      )}
    >
      <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
      <div>
        <span className="font-bold">{title}: </span>
        <span className="text-sky-900 leading-relaxed">{description}</span>
      </div>
    </div>
  );
}
