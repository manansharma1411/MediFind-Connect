"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { MedicineSearchBox } from "@/features/medicine-finder/MedicineSearchBox";
import { DidYouMeanBanner } from "@/features/medicine-finder/DidYouMeanBanner";
import { MedicineResultCard } from "@/features/medicine-finder/MedicineResultCard";
import { LocationPicker } from "@/features/location/LocationPicker";
import { searchMedicines } from "@/services/medicineService";
import type {
  MedicineSearchResult,
  UserLocationState,
} from "@/types/medicine";
import type { ApiError } from "@/types/api";

const FORM_OPTIONS = [
  { value: "all", label: "All Dosage Forms" },
  { value: "Tablet", label: "Tablet" },
  { value: "Capsule", label: "Capsule" },
  { value: "Syrup", label: "Syrup" },
  { value: "Injection", label: "Injection" },
  { value: "Inhaler", label: "Inhaler" },
  { value: "Drops", label: "Drops" },
  { value: "Ointment", label: "Ointment" },
];

export default function MedicinesPage() {
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [formFilter, setFormFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [location, setLocation] = useState<UserLocationState>({
    status: "idle",
    coords: null,
    label: "No location selected",
    source: "none",
  });

  const [result, setResult] = useState<MedicineSearchResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (q: string, form: string, targetPage: number) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const data = await searchMedicines(
          { q, form, page: targetPage, limit: 8 },
          controller.signal
        );
        if (!controller.signal.aborted) {
          setResult(data);
          setSuggestions(data.suggestions);
          setError(null);
        }
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        setError(
          apiErr.message || "Failed to load medicines. Please try again."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  // Initial load and query/filter/page updates (setState only after await)
  useEffect(() => {
    const controller = new AbortController();
    searchAbortRef.current?.abort();
    searchAbortRef.current = controller;

    (async () => {
      try {
        const data = await searchMedicines(
          { q: submittedQuery, form: formFilter, page, limit: 8 },
          controller.signal
        );
        if (!controller.signal.aborted) {
          setResult(data);
          setSuggestions(data.suggestions);
          setError(null);
        }
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        setError(
          apiErr.message || "Failed to load medicines. Please try again."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [submittedQuery, formFilter, page]);

  // Debounced suggestion fetcher (300ms)
  useEffect(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const data = await searchMedicines(
          { q: trimmed, form: formFilter, page: 1, limit: 5 },
          controller.signal
        );
        if (!controller.signal.aborted) {
          setSuggestions(data.suggestions);
        }
      } catch {
        // Ignore cancelled suggestion requests
      } finally {
        if (!controller.signal.aborted) {
          setIsSuggesting(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue, formFilter]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (!val.trim()) {
      setSuggestions([]);
      setIsSuggesting(false);
    }
  };

  const handleSubmit = (q: string) => {
    setIsLoading(true);
    setPage(1);
    setSubmittedQuery(q);
  };

  return (
    <PageContainer className="py-8 sm:py-12 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Medicine Finder" },
        ]}
        title="Patient Medicine Finder"
        description="Search by generic name, brand name, or partial term, then view verified pharmacy availability and price comparisons."
        badge={
          result?.source === "live" ? (
            <Badge variant="success" dot>
              Live API
            </Badge>
          ) : (
            <Badge variant="warning" dot>
              Demo Fallback (Backend Planned)
            </Badge>
          )
        }
      />

      {result?.source === "demo" && (
        <DemoNoticeBanner
          title="Demo Fallback Active"
          description="Person B's planned endpoint GET /api/v1/medicines is not yet live in the backend. Showing isolated demo records so you can test search, suggestions, details, and price comparison."
        />
      )}

      <LocationPicker location={location} onChange={setLocation} />

      {/* Search & Dosage Form Filter */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <MedicineSearchBox
                value={inputValue}
                onChange={handleInputChange}
                onSubmit={handleSubmit}
                suggestions={suggestions}
                isLoading={isSuggesting}
              />
            </div>
            <div className="w-full md:w-52 shrink-0">
              <Select
                aria-label="Filter by dosage form"
                value={formFilter}
                onChange={(e) => {
                  setFormFilter(e.target.value);
                  setPage(1);
                }}
                options={FORM_OPTIONS}
              />
            </div>
          </div>

          {result && !isLoading && !error && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
              <span>
                Found{" "}
                <strong className="text-slate-800">
                  {result.pagination.total}
                </strong>{" "}
                medicine{result.pagination.total === 1 ? "" : "s"}
                {submittedQuery.trim()
                  ? ` for "${submittedQuery.trim()}"`
                  : ""}
              </span>
              {submittedQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue("");
                    setSubmittedQuery("");
                    setFormFilter("all");
                    setPage(1);
                  }}
                  className="font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  Clear search & filters
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Did You Mean (only when backend returns a suggestion) */}
      {result?.didYouMean && (
        <DidYouMeanBanner
          originalQuery={submittedQuery}
          suggestion={result.didYouMean}
          onSelectSuggestion={(s) => {
            setInputValue(s);
            handleSubmit(s);
          }}
        />
      )}

      {/* Results Area */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState
          title="Unable to complete medicine search"
          description={error}
          actionLabel="Retry Search"
          onAction={() => runSearch(submittedQuery, formFilter, page)}
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No matching medicines found"
          description="Try checking your spelling, searching by generic composition (e.g. Paracetamol), or clearing the dosage form filter."
          actionLabel="Reset Search"
          onAction={() => {
            setInputValue("");
            setSubmittedQuery("");
            setFormFilter("all");
            setPage(1);
          }}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.items.map((med) => (
              <MedicineResultCard key={med.id} medicine={med} />
            ))}
          </div>

          {/* Pagination */}
          {result.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Page {result.pagination.page} of {result.pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= result.pagination.totalPages}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
