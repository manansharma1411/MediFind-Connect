"use client";

import React, { useMemo, useState } from "react";
import {
  MapPin,
  Building2,
  SlidersHorizontal,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { SAMPLE_MEDICINES, type SampleMedicine } from "@/mock-data/medicines";
import { cn } from "@/lib/cn";

const QUICK_SUGGESTIONS = ["Dolo 650", "Paracetamol", "Augmentin", "Pan-D"];

export default function MedicinesPage() {
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState("distance");
  const [selectedMedicine, setSelectedMedicine] =
    useState<SampleMedicine | null>(null);

  const filteredMedicines = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = SAMPLE_MEDICINES.filter((med) => {
      const matchesQuery =
        !q ||
        med.brandName.toLowerCase().includes(q) ||
        med.genericName.toLowerCase().includes(q) ||
        med.category.toLowerCase().includes(q);

      const matchesAvailable =
        !availableOnly || med.availability !== "out_of_stock";

      const matchesDistance =
        maxDistanceKm === null || med.nearestDistanceKm <= maxDistanceKm;

      // Open now filter is represented visually on the UI shell until live store hours API connects
      const matchesOpen = !openNowOnly || med.samplePharmacyCount > 0;

      return (
        matchesQuery && matchesAvailable && matchesDistance && matchesOpen
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "price") {
        return a.priceRangeInr.min - b.priceRangeInr.min;
      }
      if (sortBy === "availability") {
        const rank = { in_stock: 0, low_stock: 1, out_of_stock: 2 };
        return rank[a.availability] - rank[b.availability];
      }
      return a.nearestDistanceKm - b.nearestDistanceKm;
    });
  }, [query, availableOnly, openNowOnly, maxDistanceKm, sortBy]);

  const resetFilters = () => {
    setQuery("");
    setAvailableOnly(false);
    setOpenNowOnly(false);
    setMaxDistanceKm(null);
    setSortBy("distance");
  };

  return (
    <PageContainer className="py-8 sm:py-12 space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Find Medicines" }]}
        title="Medicine Discovery"
        description="Search by brand name, generic salt, or therapeutic category and compare local pharmacy availability."
        badge={<Badge variant="neutral">UI Preview</Badge>}
      />

      <DemoNoticeBanner
        title="Sample Layout Data"
        description="Filters and medicine cards below use isolated sample records to demonstrate the discovery UI. Live pharmacy stock and real-time search will activate once backend endpoints are connected."
      />

      {/* Search & Suggestions */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              placeholder="Search medicine, brand (e.g. Dolo 650, Augmentin), or generic salt..."
              aria-label="Search medicines"
            />
            <div className="w-full sm:w-52 shrink-0">
              <Select
                aria-label="Sort results"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: "distance", label: "Sort: Nearest distance" },
                  { value: "price", label: "Sort: Lowest price" },
                  { value: "availability", label: "Sort: Availability" },
                ]}
              />
            </div>
          </div>

          {/* Search Suggestions Area */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">
              Sample suggestions:
            </span>
            {QUICK_SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuery(item)}
                className="px-3 py-1 rounded-full bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-200 font-medium transition-colors cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>

          {/* Filter Controls */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters:
              </span>

              <button
                type="button"
                onClick={() => setAvailableOnly((prev) => !prev)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                  availableOnly
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                Available now
              </button>

              <button
                type="button"
                onClick={() => setOpenNowOnly((prev) => !prev)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                  openNowOnly
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                Open now
              </button>

              <button
                type="button"
                onClick={() =>
                  setMaxDistanceKm((prev) => (prev === 2 ? null : 2))
                }
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                  maxDistanceKm === 2
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                Within 2 km
              </button>

              <button
                type="button"
                onClick={() =>
                  setMaxDistanceKm((prev) => (prev === 5 ? null : 5))
                }
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                  maxDistanceKm === 5
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                Within 5 km
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>
                Showing {filteredMedicines.length} of {SAMPLE_MEDICINES.length}{" "}
                sample items
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      {filteredMedicines.length === 0 ? (
        <EmptyState
          title="No matching sample medicines"
          description="Try clearing your active filters or searching a different brand or generic salt."
          actionLabel="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMedicines.map((med) => (
            <Card
              key={med.id}
              interactive
              className="flex flex-col justify-between"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{med.category}</Badge>
                      {med.prescriptionRequired ? (
                        <Badge variant="info">Rx Required</Badge>
                      ) : (
                        <Badge variant="brand">OTC</Badge>
                      )}
                    </div>
                    <CardTitle className="pt-1">{med.brandName}</CardTitle>
                    <CardDescription>
                      {med.genericName} • {med.strength} • {med.form}
                    </CardDescription>
                  </div>
                  <AvailabilityBadge status={med.availability} />
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-500 block">Sample Price</span>
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{med.priceRangeInr.min}–₹{med.priceRangeInr.max}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Pharmacies</span>
                    <span className="font-semibold text-slate-800 inline-flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      {med.samplePharmacyCount} stores
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nearest</span>
                    <span className="font-semibold text-slate-800 inline-flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-600" />
                      {med.nearestDistanceKm} km
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <span className="text-xs text-slate-500">
                  Mfr: {med.manufacturer}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedMedicine(med)}
                >
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Medicine Details Modal */}
      <Modal
        isOpen={Boolean(selectedMedicine)}
        onClose={() => setSelectedMedicine(null)}
        title={selectedMedicine?.brandName ?? "Medicine Details"}
        description={
          selectedMedicine
            ? `${selectedMedicine.genericName} (${selectedMedicine.strength})`
            : undefined
        }
        footer={
          <Button variant="primary" onClick={() => setSelectedMedicine(null)}>
            Close Preview
          </Button>
        }
      >
        {selectedMedicine && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <AvailabilityBadge status={selectedMedicine.availability} />
              <Badge variant={selectedMedicine.prescriptionRequired ? "info" : "brand"}>
                {selectedMedicine.prescriptionRequired
                  ? "Prescription Required"
                  : "Over-the-Counter (OTC)"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Dosage Form</span>
                <span className="font-semibold text-slate-900">
                  {selectedMedicine.form}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Manufacturer</span>
                <span className="font-semibold text-slate-900">
                  {selectedMedicine.manufacturer}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sample Price Range</span>
                <span className="font-bold text-teal-700">
                  ₹{selectedMedicine.priceRangeInr.min} – ₹
                  {selectedMedicine.priceRangeInr.max}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sample Coverage</span>
                <span className="font-semibold text-slate-900">
                  {selectedMedicine.samplePharmacyCount} nearby stores
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{selectedMedicine.dosageNote}</p>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
