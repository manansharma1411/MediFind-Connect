"use client";

import React, { useEffect, useState } from "react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
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
import { DemandTrendChart } from "@/components/intelligence/DemandCharts";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getMedicineDemandTrends } from "@/services/demandIntelligenceService";
import { validateDateRange } from "@/lib/intelligenceUtils";
import { DEMO_MEDICINES } from "@/mock-data/discoveryDemo";
import type { DemandPeriodGrouping, MedicineDemandSeries } from "@/types/intelligence";
import type { ApiError } from "@/types/api";
import { cn } from "@/lib/cn";

export default function MedicineDemandTrendsPage() {
  const { session, logout } = usePharmacyAuth();
  const [medicineId, setMedicineId] = useState(DEMO_MEDICINES[0].id);
  const [area, setArea] = useState("all");
  const [grouping, setGrouping] = useState<DemandPeriodGrouping>("day");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [series, setSeries] = useState<MedicineDemandSeries | null>(null);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateError = validateDateRange(dateFrom, dateTo);

  useEffect(() => {
    if (!session || dateError) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getMedicineDemandTrends(
          session,
          { medicineId, area, grouping, dateFrom, dateTo },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setSeries(res.data);
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
        setError(apiErr.message || "Failed to load medicine demand trends.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, medicineId, area, grouping, dateFrom, dateTo, dateError, logout]);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Demand Intelligence", href: "/intelligence" },
          { label: "Medicine Demand" },
        ]}
        title="Medicine Demand Trends"
        description="Explore aggregated medicine search trends, day/week comparisons, and search outcome breakdowns."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live API
            </Badge>
          ) : source === "preview" ? (
            <Badge variant="warning" dot>
              UI Preview Data
            </Badge>
          ) : (
            <Badge variant="neutral">Awaiting Backend API</Badge>
          )
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <Select
              label="Medicine"
              value={medicineId}
              onChange={(e) => setMedicineId(e.target.value)}
              options={DEMO_MEDICINES.map((m) => ({
                value: m.id,
                label: `${m.primaryBrand ?? m.name} (${m.strength})`,
              }))}
            />
          </div>

          <div className="lg:col-span-3">
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

          <div className="lg:col-span-2">
            <span className="text-sm font-semibold text-slate-800 block mb-1.5">
              Grouping
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {(["day", "week"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrouping(g)}
                  className={cn(
                    "h-8 rounded-lg text-xs font-semibold capitalize cursor-pointer",
                    grouping === g
                      ? "bg-white text-teal-700 shadow-xs"
                      : "text-slate-600"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <Input
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              error={dateError ?? undefined}
            />
            <Input
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load trends" description={error} />
      ) : !series ? (
        <EmptyState
          title="Medicine demand endpoint unavailable"
          description="GET /api/v1/intelligence/demand/medicines/:medicineId is awaiting Person B implementation."
        />
      ) : !series.sampleSufficient ? (
        <EmptyState
          title="Insufficient data for aggregation threshold"
          description={
            series.minimumThresholdNote ||
            "Search volume for this selection is below the minimum privacy threshold."
          }
        />
      ) : (
        <div className="space-y-6">
          <DemandTrendChart
            title={`${series.medicineName} — ${series.grouping === "day" ? "Daily" : "Weekly"} Search Signals`}
            description={`Area: ${series.area} • Updated ${new Date(
              series.dataFreshnessAt
            ).toLocaleString()}`}
            points={series.points.map((p) => ({
              periodLabel: p.periodLabel,
              searchSignals: p.searchSignals,
              unmetSignals: p.unmetCount,
            }))}
            sampleSufficient={series.sampleSufficient}
            minimumThresholdNote={series.minimumThresholdNote}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Search Outcome Breakdown
              </CardTitle>
              <CardDescription>
                Matched vs. partial vs. unmet search signals per period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Period</TableHeaderCell>
                    <TableHeaderCell>Total Search Signals</TableHeaderCell>
                    <TableHeaderCell>Matched</TableHeaderCell>
                    <TableHeaderCell>Partial</TableHeaderCell>
                    <TableHeaderCell>Unmet</TableHeaderCell>
                    <TableHeaderCell>Local Supply Stores</TableHeaderCell>
                  </tr>
                </TableHead>
                <tbody>
                  {series.points.map((pt) => (
                    <TableRow key={pt.periodLabel}>
                      <TableCell className="font-semibold text-slate-900">
                        {pt.periodLabel}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-teal-700">
                        {pt.searchSignals}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-700">
                        {pt.matchedCount}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-amber-700">
                        {pt.partialCount}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-rose-700">
                        {pt.unmetCount}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {pt.localSupplyStores} stores
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </TableContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
