"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { getSupplyDemandMatches } from "@/services/aiIntelligenceService";
import { buildTransferRequestHref } from "@/lib/aiIntelligenceUtils";
import type { SupplyDemandMatchItem } from "@/types/aiIntelligence";
import type { ApiError } from "@/types/api";

export default function SupplyDemandMatchingPage() {
  const { session, logout } = usePharmacyAuth();
  const [items, setItems] = useState<SupplyDemandMatchItem[]>([]);
  const [selected, setSelected] = useState<SupplyDemandMatchItem | null>(null);
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
        const res = await getSupplyDemandMatches(
          session,
          {},
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
        setError(
          apiErr.message || "Unable to load supply-demand matching data."
        );
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
          { label: "AI Intelligence", href: "/intelligence/ai" },
          { label: "Supply-Demand Matching" },
        ]}
        title="Supply-Demand Matching"
        description="Identify nearby participating pharmacies with transfer-eligible availability. Transfers are never created or approved automatically."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live Matches
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
              ? "Matching Preview Mode"
              : "Matching Endpoint Status"
          }
          description={notice}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState title="Failed to load matches" description={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No supply-demand matches available"
          description="Transfer-eligible match suggestions will appear here once backend matching is active."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Suggested Transfer Matches
              </CardTitle>
              <CardDescription>
                Private batch numbers and unit costs are never exposed. Proceed
                to Phase 7 transfer workflow to submit a manual request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Medicine</TableHeaderCell>
                    <TableHeaderCell>Demand Area</TableHeaderCell>
                    <TableHeaderCell>Supplying Pharmacy</TableHeaderCell>
                    <TableHeaderCell>Distance</TableHeaderCell>
                    <TableHeaderCell>Transfer Eligibility</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </tr>
                </TableHead>
                <tbody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-semibold text-slate-900">
                          {item.medicineName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.matchExplanation}
                        </p>
                      </TableCell>
                      <TableCell>{item.demandArea}</TableCell>
                      <TableCell>{item.supplyingPharmacyName}</TableCell>
                      <TableCell>
                        {typeof item.distanceKm === "number"
                          ? `${item.distanceKm.toFixed(1)} km`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.transferEligibleAvailability === "AVAILABLE"
                              ? "success"
                              : item.transferEligibleAvailability === "LIMITED"
                              ? "warning"
                              : "neutral"
                          }
                        >
                          {item.transferEligibleAvailability}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelected(item)}
                          >
                            Explain
                          </Button>
                          <Link
                            href={buildTransferRequestHref({
                              medicineId: item.medicineId,
                              supplyingPharmacyId: item.supplyingPharmacyId,
                            })}
                          >
                            <Button
                              size="sm"
                              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                            >
                              Request Transfer
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </TableContainer>
            </CardContent>
          </Card>

          {selected && (
            <ExplainableAiPanel
              title={`Match Reasoning — ${selected.medicineName}`}
              metadata={selected.explainability}
            />
          )}
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
