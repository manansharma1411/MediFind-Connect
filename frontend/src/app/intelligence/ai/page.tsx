"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Clock,
  GitCompareArrows,
  LineChart,
  RefreshCw,
} from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getAiOverview } from "@/services/aiIntelligenceService";
import type { AiOverviewSummary } from "@/types/aiIntelligence";
import type { ApiError } from "@/types/api";

export default function AiIntelligenceOverviewPage() {
  const { session, logout } = usePharmacyAuth();
  const [data, setData] = useState<AiOverviewSummary | null>(null);
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
        const res = await getAiOverview(session, controller.signal);
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
        setError(apiErr.message || "Unable to load AI Intelligence overview.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "AI Intelligence" },
        ]}
        title="AI Intelligence Overview"
        description="Decision-support summary across shortage risk radar, smart restock review, demand forecasting, and supply-demand matching."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live AI Telemetry
            </Badge>
          ) : source === "preview" ? (
            <Badge variant="warning" dot>
              Preview Mode
            </Badge>
          ) : (
            <Badge variant="info">Awaiting Phase 9 Backend</Badge>
          )
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={
            source === "preview"
              ? "AI Intelligence Preview Mode"
              : "Phase 9 Backend Status"
          }
          description={notice}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState title="Failed to load AI Overview" description={error} />
      ) : !data ? (
        <EmptyState
          title="AI Intelligence data unavailable"
          description="No verified Phase 9 intelligence endpoints are active yet. Data will appear automatically once backend AI telemetry is enabled."
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <Badge variant={data.sampleSufficient ? "success" : "warning"}>
              {data.sampleSufficient
                ? "Sample Sufficiency: Sufficient"
                : "Sample Sufficiency: Insufficient"}
            </Badge>
            {data.dataFreshnessAt && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Last updated: {new Date(data.dataFreshnessAt).toLocaleString()}
              </span>
            )}
          </div>

          {!data.sampleSufficient && data.insufficiencyReason && (
            <EmptyState
              title="Insufficient verified data"
              description={data.insufficiencyReason}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>High-Risk Medicines</CardDescription>
                <CardTitle className="text-2xl text-slate-900">
                  {data.highRiskMedicineCount ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href="/intelligence/shortage-radar"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Open Shortage Radar <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Restock Recommendations</CardDescription>
                <CardTitle className="text-2xl text-slate-900">
                  {data.restockRecommendationCount ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href="/intelligence/smart-restock"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Review Smart Restock <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Forecast Highlights</CardDescription>
                <CardTitle className="text-2xl text-slate-900">
                  {data.forecastHighlights.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href="/intelligence/forecast"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Explore Forecasts <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Supply-Demand Matches</CardDescription>
                <CardTitle className="text-2xl text-slate-900">
                  {data.supplyDemandOpportunityCount ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href="/intelligence/matching"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  View Matches <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-teal-600" />
                  Forecast Highlights
                </CardTitle>
                <CardDescription>
                  Observed search-demand projections (not confirmed sales)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.forecastHighlights.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No forecast highlights available for this reporting window.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.forecastHighlights.map((h) => (
                      <li
                        key={`${h.medicineName}-${h.area}`}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-sm"
                      >
                        <p className="font-semibold text-slate-900">
                          {h.medicineName} · {h.area}
                        </p>
                        <p className="text-slate-600 text-xs mt-1">
                          {h.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-teal-600" />
                  Latest Intelligence Updates
                </CardTitle>
                <CardDescription>
                  Recent probabilistic risk and restock review signals
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.latestUpdates.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No recent intelligence updates recorded.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {data.latestUpdates.map((u) => (
                      <li
                        key={u.id}
                        className="p-3 rounded-xl border border-slate-200 flex items-start gap-3 text-sm"
                      >
                        {u.category === "SHORTAGE" ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : u.category === "RESTOCK" ? (
                          <RefreshCw className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        ) : (
                          <GitCompareArrows className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-slate-900">
                            {u.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(u.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
