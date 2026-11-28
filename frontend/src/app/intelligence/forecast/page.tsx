"use client";

import React, { useEffect, useState } from "react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { ForecastChart } from "@/components/intelligence/ForecastChart";
import { ExplainableAiPanel } from "@/components/intelligence/ExplainableAiPanel";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getDemandForecast } from "@/services/aiIntelligenceService";
import type { DemandForecastData } from "@/types/aiIntelligence";
import type { ApiError } from "@/types/api";

export default function DemandForecastPage() {
  const { session, logout } = usePharmacyAuth();
  const [medicineId, setMedicineId] = useState("med-paracetamol-650");
  const [area, setArea] = useState("MP Nagar");
  const [horizonDays, setHorizonDays] = useState(7);

  const [data, setData] = useState<DemandForecastData | null>(null);
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
        const res = await getDemandForecast(
          session,
          { medicineId, area, horizonDays },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setData(res.data);
        setSource(res.source);
        setNotice(res.notice);
        setError(null);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Unable to load demand forecast.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, medicineId, area, horizonDays, logout]);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "AI Intelligence", href: "/intelligence/ai" },
          { label: "Demand Forecast" },
        ]}
        title="Demand Forecast"
        description="Compare observed anonymized search history against projected future demand bands and baseline assumptions."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live Forecast
            </Badge>
          ) : source === "preview" ? (
            <Badge variant="warning" dot>
              Preview Mode
            </Badge>
          ) : (
            <Badge variant="info">Awaiting Backend</Badge>
          )
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={
            source === "preview"
              ? "Demand Forecast Preview Mode"
              : "Forecast Endpoint Status"
          }
          description={notice}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forecast Parameters</CardTitle>
          <CardDescription>
            Select a medicine, geographic area, and forecast horizon.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Medicine"
            value={medicineId}
            onChange={(e) => setMedicineId(e.target.value)}
            options={[
              {
                value: "med-paracetamol-650",
                label: "Paracetamol 650mg Tablet",
              },
              {
                value: "med-azithromycin-500",
                label: "Azithromycin 500mg Tablet",
              },
              {
                value: "med-metformin-500",
                label: "Metformin 500mg SR Tablet",
              },
            ]}
          />
          <Select
            label="Geographic Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            options={[
              { value: "MP Nagar", label: "MP Nagar" },
              { value: "Arera Colony", label: "Arera Colony" },
              { value: "Kolar Road", label: "Kolar Road" },
              { value: "all", label: "All Areas" },
            ]}
          />
          <Select
            label="Forecast Horizon"
            value={String(horizonDays)}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            options={[
              { value: "7", label: "Next 7 Days" },
              { value: "14", label: "Next 14 Days" },
              { value: "30", label: "Next 30 Days" },
            ]}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState title="Failed to load forecast" description={error} />
      ) : !data ? (
        <EmptyState
          title="Forecast data unavailable"
          description="Forecasts will render once GET /api/v1/intelligence/forecast is active and sufficient history exists."
        />
      ) : (
        <div className="space-y-6">
          <ForecastChart forecast={data} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Model & Baseline Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Model</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {data.modelName}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Baseline</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {data.baselineDescription}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Evaluated Accuracy</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {typeof data.evaluatedAccuracyPct === "number"
                    ? `${data.evaluatedAccuracyPct.toFixed(1)}%`
                    : "Not published (no backtest score)"}
                </p>
              </div>
            </CardContent>
          </Card>

          <ExplainableAiPanel
            title="Forecast Methodology & Limitations"
            metadata={data.explainability}
          />
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
