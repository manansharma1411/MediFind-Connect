import React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, leftIcon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-slate-800"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-11 rounded-xl bg-white border text-sm text-slate-900 placeholder:text-slate-400 transition-colors",
              leftIcon ? "pl-10 pr-4" : "px-4",
              error
                ? "border-rose-400 focus:border-rose-500"
                : "border-slate-200 hover:border-slate-300 focus:border-teal-600",
              "disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
              className
            )}
            {...props}
          />
        </div>

        {error && (
          <p className="text-xs font-medium text-rose-600" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
