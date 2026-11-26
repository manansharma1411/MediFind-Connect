import React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onClear?: () => void;
  containerClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, value, onClear, ...props }, ref) => {
    const hasValue = Boolean(value && String(value).length > 0);

    return (
      <div className={cn("relative flex items-center w-full", containerClassName)}>
        <Search
          aria-hidden="true"
          className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
        />
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            "w-full h-11 pl-10 pr-10 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-600 transition-colors",
            className
          )}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-2.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
