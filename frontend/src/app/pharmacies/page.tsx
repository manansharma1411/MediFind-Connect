"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Clock, List, Map as MapIcon, MapPin, Phone } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Select } from "@/components/ui/Select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { LocationPicker } from "@/features/location/LocationPicker";
import { PharmacyMapPanel } from "@/features/location/PharmacyMapPanel";
import { listPublicPharmacies } from "@/services/medicineService";
import type { PublicPharmacy, UserLocationState } from "@/types/medicine";
import type { ApiError } from "@/types/api";
import { cn } from "@/lib/cn";

export default function PharmaciesPage() {
  const [area, setArea] = useState("all");
  const [only24x7, setOnly24x7] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "list">("split");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [location, setLocation] = useState<UserLocationState>({
    status: "idle",
    coords: null,
    label: "No location selected",
    source: "none",
  });

  const [pharmacies, setPharmacies] = useState<PublicPharmacy[]>([]);
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = useCallback(async () => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    try {
      const res = await listPublicPharmacies(
        {
          area,
          is24x7: only24x7 ? true : undefined,
          coords: location.coords,
        },
        controller.signal
      );
      setPharmacies(res.items);
      setSource(res.source);
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.code !== "REQUEST_CANCELLED") {
        setError(apiErr.message || "Unable to load pharmacies.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [area, only24x7, location.coords]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await listPublicPharmacies(
          {
            area,
            is24x7: only24x7 ? true : undefined,
            coords: location.coords,
          },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setPharmacies(res.items);
        setSource(res.source);
        setError(null);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code !== "REQUEST_CANCELLED") {
          setError(apiErr.message || "Unable to load pharmacies.");
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
  }, [area, only24x7, location.coords]);

  return (
    <PageContainer className="py-8 sm:py-12 space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Pharmacies" }]}
        title="Partner Pharmacies"
        description="Locate verified community pharmacies, operating hours, and coordinates across the network."
        badge={
          source === "live" ? (
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

      {source === "demo" && (
        <DemoNoticeBanner
          title="Demo Directory Active"
          description="Backend endpoint GET /api/v1/pharmacies is planned. Showing isolated sample pharmacy records and OpenStreetMap coordinates."
        />
      )}

      <LocationPicker location={location} onChange={setLocation} />

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56">
              <Select
                aria-label="Filter by area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                options={[
                  { value: "all", label: "All Areas" },
                  { value: "MP Nagar Zone-I", label: "MP Nagar Zone-I" },
                  { value: "Arera Colony", label: "Arera Colony" },
                  { value: "New Market", label: "New Market" },
                ]}
              />
            </div>

            <button
              type="button"
              onClick={() => setOnly24x7((prev) => !prev)}
              className={cn(
                "h-11 px-4 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                only24x7
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              24x7 Stores Only
            </button>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer",
                viewMode === "split"
                  ? "bg-white text-teal-700 shadow-xs"
                  : "text-slate-600"
              )}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map & List</span>
            </button>
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
              <span>List Only</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : error ? (
        <ErrorState
          title="Unable to load pharmacies"
          description={error}
          actionLabel="Retry"
          onAction={handleRetry}
        />
      ) : pharmacies.length === 0 ? (
        <EmptyState
          title="No matching pharmacies"
          description="Try clearing the area or 24x7 filter."
          actionLabel="Show All"
          onAction={() => {
            setArea("all");
            setOnly24x7(false);
          }}
        />
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-6 items-start",
            viewMode === "split" && "lg:grid-cols-12"
          )}
        >
          <div
            className={cn(
              "space-y-4",
              viewMode === "split" ? "lg:col-span-6" : "grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0"
            )}
          >
            {pharmacies.map((pharm) => (
              <Card
                key={pharm.id}
                interactive
                onClick={() => setSelectedId(pharm.id)}
                className={cn(
                  "cursor-pointer",
                  selectedId === pharm.id &&
                    "border-teal-500 ring-2 ring-teal-500/20"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {pharm.is24x7 && <Badge variant="brand">24x7</Badge>}
                        {typeof pharm.isOpenNow === "boolean" && !pharm.is24x7 && (
                          <Badge
                            variant={pharm.isOpenNow ? "success" : "neutral"}
                            dot
                          >
                            {pharm.isOpenNow ? "Open Now" : "Closed"}
                          </Badge>
                        )}
                      </div>
                      <CardTitle>{pharm.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>
                          {pharm.location.address}, {pharm.location.area}
                        </span>
                      </CardDescription>
                    </div>
                    {typeof pharm.location.distanceKm === "number" && (
                      <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 shrink-0">
                        {pharm.location.distanceKm} km
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  {pharm.operatingHoursLabel && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {pharm.operatingHoursLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {pharm.phone}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          {viewMode === "split" && (
            <div className="lg:col-span-6 lg:sticky lg:top-24">
              <PharmacyMapPanel
                selectedId={selectedId}
                onSelectMarker={setSelectedId}
                markers={pharmacies.map((p) => ({
                  id: p.id,
                  name: p.name,
                  area: p.location.area,
                  address: p.location.address,
                  lat: p.location.lat,
                  lng: p.location.lng,
                  distanceKm: p.location.distanceKm ?? null,
                  statusLabel: p.is24x7 ? "24x7" : p.operatingHoursLabel ?? undefined,
                }))}
              />
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
