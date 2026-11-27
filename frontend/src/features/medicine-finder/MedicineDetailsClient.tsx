"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  List,
  Map as MapIcon,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { LocationPicker } from "@/features/location/LocationPicker";
import { PharmacyMapPanel } from "@/features/location/PharmacyMapPanel";
import { PharmacyAvailabilityCard } from "@/features/medicine-finder/PharmacyAvailabilityCard";
import { PriceComparisonTable } from "@/features/medicine-finder/PriceComparisonTable";
import {
  getMedicineAvailability,
  getMedicineById,
  getMedicinePrices,
} from "@/services/medicineService";
import { filterAndSortAvailability } from "@/lib/medicineUtils";
import type {
  AvailabilityFilters,
  Medicine,
  MedicineAvailability,
  UserLocationState,
} from "@/types/medicine";
import type { ApiError } from "@/types/api";
import { cn } from "@/lib/cn";

export function MedicineDetailsClient() {
  const params = useParams<{ id: string }>();
  const medicineId = params?.id ?? "";

  const [location, setLocation] = useState<UserLocationState>({
    status: "idle",
    coords: null,
    label: "No location selected",
    source: "none",
  });

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [availability, setAvailability] = useState<MedicineAvailability[]>([]);
  const [prices, setPrices] = useState<MedicineAvailability[]>([]);
  const [dataSource, setDataSource] = useState<"live" | "demo">("demo");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(
    null
  );

  const [filters, setFilters] = useState<AvailabilityFilters>({
    availableNow: false,
    openNow: false,
    maxDistanceKm: null,
    sortBy: "distance",
  });

  const handleManualRefresh = async () => {
    if (!medicineId) return;
    const controller = new AbortController();
    setIsRefreshing(true);
    setError(null);

    try {
      const [medRes, availRes, priceRes] = await Promise.all([
        getMedicineById(medicineId, controller.signal),
        getMedicineAvailability(
          medicineId,
          location.coords,
          10,
          controller.signal
        ),
        getMedicinePrices(medicineId, location.coords, controller.signal),
      ]);
      setMedicine(medRes.medicine ?? availRes.medicine ?? priceRes.medicine);
      setAvailability(availRes.pharmacies);
      setPrices(priceRes.comparisons);
      setDataSource(
        medRes.source === "live" && availRes.source === "live" ? "live" : "demo"
      );
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.code !== "REQUEST_CANCELLED") {
        setError(apiErr.message || "Failed to load medicine details.");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!medicineId) return;
    const controller = new AbortController();

    (async () => {
      try {
        const [medRes, availRes, priceRes] = await Promise.all([
          getMedicineById(medicineId, controller.signal),
          getMedicineAvailability(
            medicineId,
            location.coords,
            10,
            controller.signal
          ),
          getMedicinePrices(medicineId, location.coords, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setMedicine(medRes.medicine ?? availRes.medicine ?? priceRes.medicine);
        setAvailability(availRes.pharmacies);
        setPrices(priceRes.comparisons);
        setDataSource(
          medRes.source === "live" && availRes.source === "live"
            ? "live"
            : "demo"
        );
        setError(null);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code !== "REQUEST_CANCELLED") {
          setError(apiErr.message || "Failed to load medicine details.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [medicineId, location.coords]);

  const effectiveFilters = useMemo<AvailabilityFilters>(
    () => ({
      ...filters,
      maxDistanceKm: location.coords ? filters.maxDistanceKm : null,
    }),
    [filters, location.coords]
  );

  const filteredAvailability = useMemo(
    () => filterAndSortAvailability(availability, effectiveFilters),
    [availability, effectiveFilters]
  );

  const clearAllFilters = () => {
    setFilters({
      availableNow: false,
      openNow: false,
      maxDistanceKm: null,
      sortBy: "distance",
    });
  };

  if (isLoading) {
    return (
      <PageContainer className="py-10 space-y-6">
        <LoadingSkeleton rows={5} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="py-10 space-y-6">
        <ErrorState
          title="Unable to load medicine details"
          description={error}
          actionLabel="Retry"
          onAction={handleManualRefresh}
        />
      </PageContainer>
    );
  }

  if (!medicine) {
    return (
      <PageContainer className="py-10 space-y-6">
        <EmptyState
          title="Medicine not found"
          description="The requested medicine record could not be located."
        />
        <div className="flex justify-center">
          <Link
            href="/medicines"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Medicine Finder</span>
          </Link>
        </div>
      </PageContainer>
    );
  }

  const hasActiveFilters =
    effectiveFilters.availableNow ||
    effectiveFilters.openNow ||
    effectiveFilters.maxDistanceKm !== null;

  return (
    <PageContainer className="py-8 sm:py-12 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Medicine Finder", href: "/medicines" },
          { label: medicine.primaryBrand ?? medicine.name },
        ]}
        title={medicine.primaryBrand ?? medicine.name}
        description={`Generic composition: ${medicine.genericName}`}
        badge={
          <Badge variant={medicine.isPrescriptionRequired ? "info" : "brand"}>
            {medicine.isPrescriptionRequired ? "Prescription Required" : "OTC"}
          </Badge>
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            leftIcon={
              <RefreshCw
                className={cn("w-4 h-4", isRefreshing && "animate-spin")}
              />
            }
            isLoading={isRefreshing}
            onClick={handleManualRefresh}
          >
            Refresh Stock
          </Button>
        }
      />

      {dataSource === "demo" && (
        <DemoNoticeBanner
          title="Demo Fallback Active"
          description="Backend endpoints /api/v1/medicines/:id, /availability, and /prices are planned. Displaying isolated demo records."
        />
      )}

      {/* Medicine Identification Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medicine Identification</CardTitle>
          <CardDescription>
            Standardized product attributes for accurate pharmacy verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-500 block">Strength</span>
              <span className="font-bold text-slate-900 text-sm">
                {medicine.strength}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Dosage Form</span>
              <span className="font-bold text-slate-900 text-sm">
                {medicine.form}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Pack Size</span>
              <span className="font-bold text-slate-900 text-sm">
                {medicine.packSize}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Storage</span>
              <span className="font-bold text-slate-900 text-sm">
                {medicine.storageCondition}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Available Brands
            </p>
            <div className="flex flex-wrap gap-2">
              {medicine.brands.map((b) => (
                <Badge key={b.id} variant="neutral">
                  {b.brandName} ({b.manufacturer})
                </Badge>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              This page provides medicine identification and store availability
              only. It does not provide medical diagnosis or personalized
              treatment advice.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* User Location Controls */}
      <LocationPicker location={location} onChange={setLocation} />

      {/* Availability Filters & Map/List Switcher */}
      <Card>
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters:
            </span>

            <button
              type="button"
              onClick={() =>
                setFilters((f) => ({ ...f, availableNow: !f.availableNow }))
              }
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                effectiveFilters.availableNow
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              Available now
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((f) => ({ ...f, openNow: !f.openNow }))
              }
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                effectiveFilters.openNow
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              Open now
            </button>

            <button
              type="button"
              disabled={!location.coords}
              title={
                !location.coords
                  ? "Set your location above to filter by distance"
                  : undefined
              }
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  maxDistanceKm: f.maxDistanceKm === 2 ? null : 2,
                }))
              }
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
                !location.coords
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : effectiveFilters.maxDistanceKm === 2
                  ? "bg-teal-600 text-white border-teal-600 cursor-pointer"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
              )}
            >
              Within 2 km
            </button>

            <button
              type="button"
              disabled={!location.coords}
              title={
                !location.coords
                  ? "Set your location above to filter by distance"
                  : undefined
              }
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  maxDistanceKm: f.maxDistanceKm === 5 ? null : 5,
                }))
              }
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
                !location.coords
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : effectiveFilters.maxDistanceKm === 5
                  ? "bg-teal-600 text-white border-teal-600 cursor-pointer"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer"
              )}
            >
              Within 5 km
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <Select
                aria-label="Sort pharmacies"
                value={effectiveFilters.sortBy}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    sortBy: e.target.value as AvailabilityFilters["sortBy"],
                  }))
                }
                options={[
                  { value: "distance", label: "Sort: Nearest distance" },
                  { value: "price", label: "Sort: Lowest price" },
                  { value: "availability", label: "Sort: Availability" },
                ]}
              />
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer",
                  viewMode === "list"
                    ? "bg-white text-teal-700 shadow-xs"
                    : "text-slate-600"
                )}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer",
                  viewMode === "map"
                    ? "bg-white text-teal-700 shadow-xs"
                    : "text-slate-600"
                )}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability List / Map */}
      {filteredAvailability.length === 0 ? (
        <EmptyState
          title="No pharmacies match your active filters"
          description="Try clearing your distance or availability filters to see all nearby stores."
          actionLabel="Clear Filters"
          onAction={clearAllFilters}
        />
      ) : viewMode === "map" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            {filteredAvailability.map((item) => (
              <PharmacyAvailabilityCard
                key={item.pharmacyId}
                item={item}
                isSelected={selectedPharmacyId === item.pharmacyId}
                onSelect={() => setSelectedPharmacyId(item.pharmacyId)}
              />
            ))}
          </div>
          <div className="lg:col-span-7 lg:sticky lg:top-24">
            <PharmacyMapPanel
              title="Pharmacies Stocking This Medicine"
              selectedId={selectedPharmacyId}
              onSelectMarker={setSelectedPharmacyId}
              markers={filteredAvailability.map((item) => ({
                id: item.pharmacyId,
                name: item.pharmacyName,
                area: item.area,
                address: item.address,
                lat: item.lat ?? null,
                lng: item.lng ?? null,
                distanceKm: item.distanceKm,
                statusLabel: item.status.replace(/_/g, " "),
              }))}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAvailability.map((item) => (
            <PharmacyAvailabilityCard key={item.pharmacyId} item={item} />
          ))}
        </div>
      )}

      {/* Price Comparison Table */}
      {prices.length > 0 && (
        <PriceComparisonTable
          items={prices}
          strength={medicine.strength}
          packSize={medicine.packSize}
        />
      )}

      <p className="text-xs text-slate-500 text-center">
        Stock Refresh Strategy: Use <strong>Refresh Stock</strong> above for
        on-demand updates. Live realtime stock subscriptions will activate once
        the backend event stream is published.
      </p>
    </PageContainer>
  );
}
