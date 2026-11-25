import React from "react";
import { cn } from "@/lib/cn";

export interface PageContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  size?: "md" | "lg" | "xl";
}

const sizeClasses: Record<"md" | "lg" | "xl", string> = {
  md: "max-w-4xl",
  lg: "max-w-7xl",
  xl: "max-w-[1440px]",
};

export function PageContainer({
  className,
  size = "lg",
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto px-4 sm:px-6 lg:px-8",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
