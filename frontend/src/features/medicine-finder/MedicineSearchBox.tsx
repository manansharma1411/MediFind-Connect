"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MedicineSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  suggestions: string[];
  isLoading?: boolean;
  placeholder?: string;
}

export function MedicineSearchBox({
  value,
  onChange,
  onSubmit,
  suggestions,
  isLoading = false,
  placeholder = "Search by generic name, brand (e.g. Dolo 650, Augmentin), or partial name...",
}: MedicineSearchBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown =
    isOpen && value.trim().length > 0 && suggestions.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showDropdown) setIsOpen(true);
      setActiveIndex((prev) =>
        suggestions.length === 0 ? -1 : (prev + 1) % suggestions.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        suggestions.length === 0
          ? -1
          : (prev - 1 + suggestions.length) % suggestions.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showDropdown && activeIndex >= 0 && suggestions[activeIndex]) {
        const chosen = suggestions[activeIndex];
        onChange(chosen);
        onSubmit(chosen);
      } else {
        onSubmit(value);
      }
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="medicine-search-suggestions"
          aria-activedescendant={
            activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
          }
          aria-label="Search medicines"
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-12 pl-10 pr-24 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-600 transition-colors"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isLoading && (
            <Loader2
              aria-label="Searching"
              className="w-4 h-4 text-teal-600 animate-spin mr-1"
            />
          )}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                onSubmit("");
                setIsOpen(false);
                setActiveIndex(-1);
              }}
              aria-label="Clear search"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onSubmit(value);
              setIsOpen(false);
            }}
            className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Search
          </button>
        </div>
      </div>

      {showDropdown && (
        <ul
          id="medicine-search-suggestions"
          role="listbox"
          className="absolute z-30 mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 max-h-64 overflow-y-auto"
        >
          {suggestions.map((item, idx) => (
            <li
              key={item}
              id={`suggestion-${idx}`}
              role="option"
              aria-selected={activeIndex === idx}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item);
                onSubmit(item);
                setIsOpen(false);
                setActiveIndex(-1);
              }}
              className={cn(
                "px-4 py-2.5 text-sm cursor-pointer flex items-center gap-2.5 transition-colors",
                activeIndex === idx
                  ? "bg-teal-50 text-teal-900 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
