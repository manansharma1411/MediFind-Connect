"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Clock,
  Layers,
  Search,
  ShieldCheck,
  TrendingUp,
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
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import {
  DemandTrendChart,
  DemandVsSupplyChart,
} from "@/components/intelligence/DemandCharts";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getDemandOverview } from "@/services/demandIntelligenceService";
import {
  formatDemandChangePct,
  validateDateRange,
} from "@/lib/intelligenceUtils";
import type { DemandOverviewSummary } from "@/types/intelligence";
import type { ApiError } from "@/types/api";

export default function IntelligenceOverviewPage() {
  const { session, logout } = usePharmacyAuth();
  const [area, setArea] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [data, setData] = useState<DemandOverviewSummary | null>(null);
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
        const res = await getDemandOverview(
          session,
          { area, dateFrom, dateTo },
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
        setError(apiErr.message || "Unable to load demand intelligence.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, area, dateFrom, dateTo, dateError, logout]);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Demand Intelligence" },
        ]}
        title="Local Demand Intelligence"
        description="Privacy-preserving regional search signals, unmet demand indicators, and supply comparisons."
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

      {/* Privacy & Signal Semantics Notice */}
      <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Signal Definition:</strong> Metrics reflect aggregated,
          anonymized medicine search signals (minimum aggregation thresholds
          enforced). Search signals do not represent confirmed sales, orders, or
          patient-level activity.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Select
            label="Area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            options={[
              { value: "all", label: "All Supported Areas" },
              { value: "MP Nagar Zone-I", label: "MP Nagar Zone-I" },
              { value: "Arera Colony", label: "Arera Colony" },
              { value: "New Market", label: "New Market" },
            ]}
          />
          <Input
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            error={dateError ?? undefined}
          />
          <Input
            label="To Date"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="Unable to load demand overview"
          description={error}
        />
      ) : !data ? (
        <EmptyState
          title="Demand intelligence endpoint unavailable"
          description="GET /api/v1/intelligence/demand/overview is awaiting Person B implementation."
        />
      ) : (
        <div className="space-y-6">
          {/* Data Freshness & Sample Sufficiency Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              Data freshness:{" "}
              <strong className="text-slate-700">
                {new Date(data.dataFreshnessAt).toLocaleString()}
              </strong>
            </span>
            <Badge variant={data.sampleSufficient ? "success" : "warning"} dot>
              {data.sampleSufficient
                ? "Sample Threshold Met"
                : "Insufficient Sample Size"}
            </Badge>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: "Popular Medicine Searches",
                value: data.popularSearchCount,
                sub: "Aggregated search signals",
                icon: <Search className="w-5 h-5 text-teal-600" />,
              },
              {
                label: "Unmet Demand Signals",
                value: data.unmetSignalCount,
                sub: "Unfulfilled / partial searches",
                icon: <AlertOctagon className="w-5 h-5 text-amber-600" />,
              },
              {
                label: "Local Supply Indicator",
                value: `${data.localSupplyIndex}%`,
                sub: "Nearby stock coverage",
                icon: <Layers className="w-5 h-5 text-sky-600" />,
              },
              {
                label: "Demand Change",
                value: formatDemandChangePct(data.demandChangePercent),
                sub: data.reportingPeriodLabel,
                icon: <TrendingUp className="w-5 h-5 text-teal-600" />,
              },
            ].map((card) => (
              <Card key={card.label}>
                <CardContent className="p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      {card.label}
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {card.value}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {card.sub}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DemandTrendChart
              title="Recent Demand Trends"
              description="Search signals vs. unmet signals across reporting window"
              points={data.recentTrends}
              sampleSufficient={data.sampleSufficient}
              minimumThresholdNote={data.minimumThresholdNote}
            />
            <DemandVsSupplyChart
              items={data.demandVsSupply}
              sampleSufficient={data.sampleSufficient}
            />
          </div>

          {/* Top Searched Medicines & Area Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Top Searched Medicines
                  </CardTitle>
                  <CardDescription>
                    Aggregated search interest vs. local store availability
                  </CardDescription>
                </div>
                <Link
                  href="/intelligence/medicines"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                >
                  <span>Explore Trends</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent>
                <TableContainer>
                  <TableHead>
                    <tr>
                      <TableHeaderCell>Medicine</TableHeaderCell>
                      <TableHeaderCell>Search Signals</TableHeaderCell>
                      <TableHeaderCell>Available Stores</TableHeaderCell>
                    </tr>
                  </TableHead>
                  <tbody>
                    {data.topSearchedMedicines.map((med) => (
                      <TableRow key={med.medicineId}>
                        <TableCell className="font-semibold text-slate-900">
                          {med.medicineName}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-teal-700">
                          {med.searchSignals}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {med.availableStoreCount} pharmacies
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </TableContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Area-Wise Demand Summary
                  </CardTitle>
                  <CardDescription>Neighborhood signal totals</CardDescription>
                </div>
                <Link
                  href="/intelligence/areas"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                >
                  <span>Area Insights</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.areaSummary.map((row) => (
                  <div
                    key={row.area}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-teal-600" />
                      <span className="font-bold text-slate-900">
                        {row.area}
                      </span>
                    </div>
                    <span className="text-slate-600">
                      <strong>{row.searchSignals}</strong> searches •{" "}
                      <strong className="text-amber-700">
                        {row.unmetSignals}
                      </strong>{" "}
                      unmet
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
