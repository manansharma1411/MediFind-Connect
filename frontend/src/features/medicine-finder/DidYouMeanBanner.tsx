import React from "react";
import { HelpCircle } from "lucide-react";

export function DidYouMeanBanner({
  originalQuery,
  suggestion,
  onSelectSuggestion,
}: {
  originalQuery: string;
  suggestion: string | null;
  onSelectSuggestion: (suggestion: string) => void;
}) {
  if (!suggestion || suggestion.toLowerCase() === originalQuery.toLowerCase()) {
    return null;
  }

  return (
    <div
      role="status"
      className="px-4 py-3 rounded-xl bg-teal-50/70 border border-teal-200 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700"
    >
      <HelpCircle className="w-4 h-4 text-teal-600 shrink-0" />
      <span>
        Showing results for <strong className="text-slate-900">{originalQuery}</strong>.
        Did you mean{" "}
      </span>
      <button
        type="button"
        onClick={() => onSelectSuggestion(suggestion)}
        className="font-bold text-teal-700 underline underline-offset-2 hover:text-teal-900 cursor-pointer"
      >
        {suggestion}
      </button>
      <span>?</span>
    </div>
  );
}
