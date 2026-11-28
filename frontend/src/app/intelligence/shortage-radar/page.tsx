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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { ExplainableAiPanel } from "@/components/intelligence/ExplainableAiPanel";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import {
  getShortageDetails,
  getShortageRadar,
} from "@/services/aiIntelligenceService";
import {
  getConfidenceBadgeMeta,
  getShortageRiskMeta,
} from "@/lib/aiIntelligenceUtils";
import type { ShortageRadarItem } from "@/types/aiIntelligence";
import type { ApiError } from "@/types/api";

export default function ShortageRadarPage() {
  const { session, logout } = usePharmacyAuth();
  const [items, setItems] = useState<ShortageRadarItem[]>([]);
  const [selected, setSelected] = useState<ShortageRadarItem | null>(null);
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
        const res = await getShortageRadar(session, {}, controller.signal);
        if (controller.signal.aborted) return;
        const list = res.data ?? [];
        setItems(list);
        setSelected(list[0] ?? null);
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
        setError(apiErr.message || "Unable to load Shortage Radar.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const handleSelectItem = async (item: ShortageRadarItem) => {
    setSelected(item);
    if (!session || session.isPreviewSession) return;
    try {
      const detail = await getShortageDetails(session, item.medicineId);
      if (detail.data) setSelected(detail.data);
    } catch {
      // Keep list item explainability if detail fetch fails
    }
  };

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "AI Intelligence", href: "/intelligence/ai" },
          { label: "Shortage Radar" },
        ]}
        title="Regional Shortage Radar"
        description="Probabilistic shortage risk indicators based on anonymized search signals and participating supply — never presented as a guaranteed shortage."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live Signals
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
              ? "Shortage Radar Preview Mode"
              : "Shortage Radar Endpoint Status"
          }
          description={notice}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState title="Failed to load Shortage Radar" description={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No shortage risk signals available"
          description="Risk flags will appear here when sufficient verified backend search and supply data is available."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Shortage Risk Indicators
              </CardTitle>
              <CardDescription>
                Select any row to inspect the explainable reasoning and sample
                sufficiency behind the flag.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Medicine</TableHeaderCell>
                    <TableHeaderCell>Risk Category</TableHeaderCell>
                    <TableHeaderCell>Risk Score</TableHeaderCell>
                    <TableHeaderCell>Pharmacy / Area</TableHeaderCell>
                    <TableHeaderCell>Forecast Period</TableHeaderCell>
                    <TableHeaderCell>Confidence</TableHeaderCell>
                    <TableHeaderCell>Details</TableHeaderCell>
                  </tr>
                </TableHead>
                <tbody>
                  {items.map((item) => {
                    const riskMeta = getShortageRiskMeta(item.riskCategory);
                    const confMeta = getConfidenceBadgeMeta(
                      item.confidenceLevel
                    );
                    const isSelected = selected?.id === item.id;
                    return (
                      <TableRow
                        key={item.id}
                        className={isSelected ? "bg-teal-50/40" : undefined}
                      >
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {item.medicineName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.explanation}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={riskMeta.badgeVariant}>
                            {riskMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {typeof item.riskScore === "number"
                            ? item.riskScore.toFixed(2)
                            : "—"}
                        </TableCell>
                        <TableCell>{item.pharmacyOrArea}</TableCell>
                        <TableCell>{item.forecastPeriod}</TableCell>
                        <TableCell>
                          <Badge variant={confMeta.variant}>
                            {confMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={isSelected ? "primary" : "outline"}
                            onClick={() => handleSelectItem(item)}
                          >
                            {isSelected ? "Inspecting" : "Inspect"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </TableContainer>
            </CardContent>
          </Card>

          {selected && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Supporting Indicators — {selected.medicineName}
                  </CardTitle>
                  <CardDescription>
                    Area: {selected.pharmacyOrArea} · Period:{" "}
                    {selected.forecastPeriod}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                    {selected.supportingIndicators.map((ind) => (
                      <li key={ind}>{ind}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <ExplainableAiPanel
                title={`Explainable AI Reasoning — ${selected.medicineName}`}
                metadata={selected.explainability}
              />
            </div>
          )}
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
