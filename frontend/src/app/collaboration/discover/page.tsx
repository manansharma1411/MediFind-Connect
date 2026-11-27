"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Clock, MapPin } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { MedicineSearchBox } from "@/features/medicine-finder/MedicineSearchBox";
import { LocationPicker } from "@/features/location/LocationPicker";
import { searchMedicines, getMedicineAvailability } from "@/services/medicineService";
import { formatLastUpdated, mapStockStatusToBadge } from "@/lib/medicineUtils";
import type { CollaborationStockCandidate } from "@/types/collaboration";
import type { UserLocationState } from "@/types/medicine";
import type { ApiError } from "@/types/api";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { cn } from "@/lib/cn";

export default function CollaborationDiscoverPage() {
  const { session } = usePharmacyAuth();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [location, setLocation] = useState<UserLocationState>({
    status: "idle",
    coords: null,
    label: "No location selected",
    source: "none",
  });

  const [maxDistanceKm, setMaxDistanceKm] = useState<string>("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const [candidates, setCandidates] = useState<CollaborationStockCandidate[]>([]);
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const res = await searchMedicines({ q: trimmed, limit: 5 }, controller.signal);
        if (!controller.signal.aborted) {
          setSuggestions(res.suggestions);
        }
      } catch {
        // Ignore cancelled
      } finally {
        if (!controller.signal.aborted) setIsSuggesting(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const medRes = await searchMedicines(
          { q: submittedQuery, page: 1, limit: 6 },
          controller.signal
        );
        if (controller.signal.aborted) return;

        const availList = await Promise.all(
          medRes.items.map(async (med) => {
            const avail = await getMedicineAvailability(
              med.id,
              location.coords,
              10,
              controller.signal
            );
            return { med, avail };
          })
        );

        if (controller.signal.aborted) return;

        const merged: CollaborationStockCandidate[] = [];
        let anyDemo = medRes.source === "demo";

        for (const { med, avail } of availList) {
          if (avail.source === "demo") anyDemo = true;
          for (const ph of avail.pharmacies) {
            if (session && ph.pharmacyId === session.pharmacyId) continue;
            merged.push({
              pharmacyId: ph.pharmacyId,
              pharmacyName: ph.pharmacyName,
              area: ph.area,
              medicineId: med.id,
              medicineName: med.primaryBrand ?? med.name,
              strength: med.strength,
              form: med.form,
              distanceKm: ph.distanceKm,
              status: ph.status,
              sellingPrice: ph.sellingPrice,
              lastUpdatedAt: ph.lastUpdatedAt,
            });
          }
        }

        setCandidates(merged);
        setSource(anyDemo ? "demo" : "live");
        setError(null);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code !== "REQUEST_CANCELLED") {
          setError(apiErr.message || "Failed to discover partner stock.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [submittedQuery, location.coords, session]);

  const filteredCandidates = useMemo(() => {
    const maxKm = maxDistanceKm === "all" ? null : Number(maxDistanceKm);
    return candidates.filter((c) => {
      if (onlyAvailable && c.status === "OUT_OF_STOCK") return false;
      if (maxKm !== null && (c.distanceKm === null || c.distanceKm > maxKm)) {
        return false;
      }
      return true;
    });
  }, [candidates, onlyAvailable, maxDistanceKm]);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Collaboration", href: "/collaboration" },
          { label: "Stock Discovery" },
        ]}
        title="Partner Stock Discovery"
        description="Search public-safe availability across nearby pharmacies to request emergency stock transfers."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live API
            </Badge>
          ) : (
            <Badge variant="warning" dot>
              Demo Fallback
            </Badge>
          )
        }
      />

      {source === "demo" && (
        <DemoNoticeBanner
          title="Demo Discovery Data"
          description="Displaying public-safe sample pharmacy availability while live discovery endpoints are finalized."
        />
      )}

      <LocationPicker location={location} onChange={setLocation} />

      <Card>
        <CardContent className="p-4 space-y-3">
          <MedicineSearchBox
            value={query}
            onChange={(val) => {
              setQuery(val);
              if (!val.trim()) setSuggestions([]);
            }}
            onSubmit={(q) => {
              setIsLoading(true);
              setSubmittedQuery(q);
            }}
            suggestions={suggestions}
            isLoading={isSuggesting}
            placeholder="Search medicine to request from partner pharmacies..."
          />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setOnlyAvailable((p) => !p)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                onlyAvailable
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-white text-slate-700 border-slate-200"
              )}
            >
              Transfer-Eligible Only
            </button>

            <div className="w-48">
              <Select
                aria-label="Distance filter"
                disabled={!location.coords}
                value={location.coords ? maxDistanceKm : "all"}
                onChange={(e) => setMaxDistanceKm(e.target.value)}
                options={[
                  { value: "all", label: "Any Distance" },
                  { value: "2", label: "Within 2 km" },
                  { value: "5", label: "Within 5 km" },
                  { value: "10", label: "Within 10 km" },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load stock discovery" description={error} />
      ) : filteredCandidates.length === 0 ? (
        <EmptyState
          title="No transfer-eligible stock found"
          description="Try clearing your distance filter or searching another medicine."
          actionLabel="Show All"
          onAction={() => {
            setQuery("");
            setSubmittedQuery("");
            setOnlyAvailable(false);
            setMaxDistanceKm("all");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCandidates.map((item) => (
            <Card key={`${item.pharmacyId}-${item.medicineId}`} interactive>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <AvailabilityBadge status={mapStockStatusToBadge(item.status)} />
                    <CardTitle className="mt-2 text-base">
                      {item.medicineName}
                    </CardTitle>
                    <CardDescription>
                      {item.strength} • {item.form}
                    </CardDescription>
                  </div>
                  {typeof item.distanceKm === "number" && (
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                      {item.distanceKm} km
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>{item.pharmacyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {item.area}
                  </span>
                  <span className="font-bold text-teal-700">
                    ₹{item.sellingPrice.toFixed(2)}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  Updated {formatLastUpdated(item.lastUpdatedAt)}
                </div>
              </CardContent>

              <CardFooter>
                <span className="text-[11px] text-slate-500">
                  Public-safe availability
                </span>
                <Link
                  href={`/collaboration/request?pharmacyId=${encodeURIComponent(
                    item.pharmacyId
                  )}&medicineId=${encodeURIComponent(item.medicineId)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  <span>Request Stock</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
