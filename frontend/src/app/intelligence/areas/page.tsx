"use client";

import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getAreaDemandInsights } from "@/services/demandIntelligenceService";
import type { AreaDemandInsight } from "@/types/intelligence";
import type { ApiError } from "@/types/api";

export default function AreaInsightsPage() {
  const { session, logout } = usePharmacyAuth();
  const [area, setArea] = useState("all");
  const [pincode, setPincode] = useState("");

  const [areas, setAreas] = useState<AreaDemandInsight[]>([]);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getAreaDemandInsights(
          session,
          { area, pincode: pincode.trim() || undefined },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setAreas(res.data ?? []);
        setSource(res.source);
        setNotice(res.notice);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Unable to load area insights.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, area, pincode, logout]);

  const anyGeoMapping = areas.some((a) => a.hasReliableGeoMapping);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Demand Intelligence", href: "/intelligence" },
          { label: "Area Insights" },
        ]}
        title="Area Demand Insights"
        description="Compare aggregated search signals, local supply indicators, and popular medicines across neighborhoods and PIN codes."
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end">
          <div className="w-full sm:w-60">
            <Select
              label="Area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              options={[
                { value: "all", label: "All Areas" },
                { value: "MP Nagar Zone-I", label: "MP Nagar Zone-I" },
                { value: "Arera Colony", label: "Arera Colony" },
              ]}
            />
          </div>
          <div className="w-full sm:w-48">
            <Input
              label="PIN Code"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 462011"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load area insights" description={error} />
      ) : source === "unavailable" ? (
        <EmptyState
          title="Area insights endpoint unavailable"
          description="GET /api/v1/intelligence/demand/areas is awaiting Person B implementation."
        />
      ) : areas.length === 0 ? (
        <EmptyState
          title="No area insights available"
          description="Try clearing your area or PIN code filter, or wait for sufficient verified sample size."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {areas.map((item) => (
              <Card key={`${item.area}-${item.pincode}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{item.area}</CardTitle>
                      <CardDescription>
                        {item.city} • PIN {item.pincode}
                      </CardDescription>
                    </div>
                    <Badge variant="neutral">
                      {item.supplyIndicatorCount} local stores
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">
                        Search Signals
                      </span>
                      <strong className="text-base text-teal-700">
                        {item.searchSignals}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        Unmet Signals
                      </span>
                      <strong className="text-base text-amber-700">
                        {item.unmetSignals}
                      </strong>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">
                      Popular Searched Medicines
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.popularMedicines.map((m) => (
                        <Badge key={m} variant="brand">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Geographic Visualization (explicit empty state when accurate mapping is unavailable) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Geographic Demand Visualization
              </CardTitle>
              <CardDescription>
                Rendered only when verified area boundary coordinates are
                provided by the backend
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!anyGeoMapping ? (
                <EmptyState
                  title="Geographic area visualization unavailable"
                  description="Verified area boundary coordinates are not yet provided by the backend. No synthetic coordinates are plotted."
                />
              ) : (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <span>Verified area geo-mapping active.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
