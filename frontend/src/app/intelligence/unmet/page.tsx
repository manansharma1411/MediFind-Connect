"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { UnmetCategoryChart } from "@/components/intelligence/DemandCharts";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getUnmetDemandSignals } from "@/services/demandIntelligenceService";
import { filterUnmetSignals } from "@/lib/intelligenceUtils";
import type { UnmetDemandCategory, UnmetDemandSignal } from "@/types/intelligence";
import type { ApiError } from "@/types/api";

function renderCategoryBadge(category: UnmetDemandCategory) {
  switch (category) {
    case "NO_MEDICINE_MATCH":
      return <Badge variant="neutral">No Medicine Match</Badge>;
    case "NO_ELIGIBLE_STOCK":
      return <Badge variant="error">No Eligible Nearby Stock</Badge>;
    case "PARTIAL_AVAILABILITY":
      return <Badge variant="warning">Partial Availability</Badge>;
  }
}

export default function UnmetDemandPage() {
  const { session, logout } = usePharmacyAuth();
  const [area, setArea] = useState("all");
  const [category, setCategory] = useState<"all" | UnmetDemandCategory>("all");

  const [signals, setSignals] = useState<UnmetDemandSignal[]>([]);
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
        const res = await getUnmetDemandSignals(
          session,
          { area, category },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setSignals(res.data ?? []);
        setSource(res.source);
        setNotice(res.notice);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Unable to load unmet demand signals.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, area, category, logout]);

  const filtered = useMemo(
    () => filterUnmetSignals(signals, { area, category }),
    [signals, area, category]
  );

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Demand Intelligence", href: "/intelligence" },
          { label: "Unmet Demand" },
        ]}
        title="Aggregated Unmet Demand Signals"
        description="Analyze searches where medicines were unmatched, out of stock nearby, or only partially available."
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Privacy & Interpretation:</strong> Signals are aggregated at
          the area level with zero patient identifiers. Search volume is not
          confirmed purchase demand.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-56">
            <Select
              label="Area"
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

          <div className="w-full sm:w-64">
            <Select
              label="Unmet Category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as "all" | UnmetDemandCategory)
              }
              options={[
                { value: "all", label: "All Categories" },
                { value: "NO_MEDICINE_MATCH", label: "No Medicine Match" },
                { value: "NO_ELIGIBLE_STOCK", label: "No Eligible Nearby Stock" },
                { value: "PARTIAL_AVAILABILITY", label: "Partial Availability" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load unmet demand" description={error} />
      ) : source === "unavailable" ? (
        <EmptyState
          title="Unmet demand endpoint unavailable"
          description="GET /api/v1/intelligence/demand/unmet is awaiting Person B implementation."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No unmet demand signals meeting privacy thresholds"
          description="Minimum aggregation counts must be reached before displaying area-level unmet demand."
        />
      ) : (
        <div className="space-y-6">
          <UnmetCategoryChart signals={filtered} />

          <TableContainer>
            <TableHead>
              <tr>
                <TableHeaderCell>Medicine / Query Group</TableHeaderCell>
                <TableHeaderCell>Area</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Aggregated Demand</TableHeaderCell>
                <TableHeaderCell>Eligible Local Supply</TableHeaderCell>
                <TableHeaderCell>Reporting Period</TableHeaderCell>
                <TableHeaderCell>Data Freshness</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {filtered.map((sig) => (
                <TableRow key={sig.id}>
                  <TableCell className="font-semibold text-slate-900">
                    {sig.medicineName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {sig.area}
                  </TableCell>
                  <TableCell>{renderCategoryBadge(sig.category)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-teal-700">
                    {sig.aggregatedDemandIndicator} signals
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {sig.eligibleLocalSupplyCount !== null
                      ? `${sig.eligibleLocalSupplyCount} stores`
                      : "N/A"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {sig.reportingPeriod}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(sig.dataFreshnessAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </TableContainer>
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
