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
  getSmartRestockDetails,
  getSmartRestockRecommendations,
} from "@/services/aiIntelligenceService";
import {
  getConfidenceBadgeMeta,
  getDemandBasisLabel,
} from "@/lib/aiIntelligenceUtils";
import type { SmartRestockItem } from "@/types/aiIntelligence";
import type { ApiError } from "@/types/api";

export default function SmartRestockPage() {
  const { session, logout } = usePharmacyAuth();
  const [items, setItems] = useState<SmartRestockItem[]>([]);
  const [selected, setSelected] = useState<SmartRestockItem | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Record<string, boolean>>({});
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
        const res = await getSmartRestockRecommendations(
          session,
          controller.signal
        );
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
        setError(apiErr.message || "Unable to load Smart Restock.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const handleReview = async (item: SmartRestockItem) => {
    setReviewedIds((prev) => ({ ...prev, [item.id]: true }));
    setSelected(item);
    if (!session || session.isPreviewSession) return;
    try {
      const detail = await getSmartRestockDetails(session, item.medicineId);
      if (detail.data) setSelected(detail.data);
    } catch {
      // Keep list item explainability
    }
  };

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "AI Intelligence", href: "/intelligence/ai" },
          { label: "Smart Restock" },
        ]}
        title="Smart Restock Recommendations"
        description="Advisory reorder suggestions for manual pharmacist review. Never modifies inventory or creates purchase orders automatically."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live Advisory
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
              ? "Smart Restock Preview Mode"
              : "Smart Restock Endpoint Status"
          }
          description={notice}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState title="Failed to load Smart Restock" description={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No restock recommendations available"
          description="Advisory restock suggestions require sufficient verified inventory and search-demand history."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Advisory Restock Queue
              </CardTitle>
              <CardDescription>
                Review suggested quantities alongside supporting data and
                demand basis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Medicine</TableHeaderCell>
                    <TableHeaderCell>Eligible Stock</TableHeaderCell>
                    <TableHeaderCell>Suggested Qty</TableHeaderCell>
                    <TableHeaderCell>Est. Coverage</TableHeaderCell>
                    <TableHeaderCell>Demand Basis</TableHeaderCell>
                    <TableHeaderCell>Confidence</TableHeaderCell>
                    <TableHeaderCell>Action</TableHeaderCell>
                  </tr>
                </TableHead>
                <tbody>
                  {items.map((item) => {
                    const confMeta = getConfidenceBadgeMeta(
                      item.confidenceLevel
                    );
                    const isReviewed = Boolean(reviewedIds[item.id]);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {item.medicineName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.recommendationReason}
                          </p>
                        </TableCell>
                        <TableCell>{item.currentEligibleStock}</TableCell>
                        <TableCell className="font-bold text-teal-800">
                          +{item.suggestedRestockQuantity}
                        </TableCell>
                        <TableCell>
                          {typeof item.estimatedCoverageDays === "number"
                            ? `${item.estimatedCoverageDays} days`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-600">
                            {getDemandBasisLabel(item.demandBasis)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={confMeta.variant}>
                            {confMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={isReviewed ? "secondary" : "outline"}
                            onClick={() => handleReview(item)}
                          >
                            {isReviewed ? "Reviewed" : "Review"}
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
                    Review Summary — {selected.medicineName}
                  </CardTitle>
                  <CardDescription>
                    Generated:{" "}
                    {new Date(selected.generatedAt).toLocaleString()} ·{" "}
                    {getDemandBasisLabel(selected.demandBasis)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                    {selected.supportingData.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <ExplainableAiPanel
                title={`Restock Rationale — ${selected.medicineName}`}
                metadata={selected.explainability}
              />
            </div>
          )}
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
