import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { getChartMaxDomain } from "@/lib/intelligenceUtils";
import type { UnmetDemandSignal } from "@/types/intelligence";
import { cn } from "@/lib/cn";

export function DemandTrendChart({
  title,
  description,
  points,
  sampleSufficient,
  minimumThresholdNote,
}: {
  title: string;
  description: string;
  points: Array<{
    periodLabel: string;
    searchSignals: number;
    unmetSignals: number;
  }>;
  sampleSufficient: boolean;
  minimumThresholdNote?: string | null;
}) {
  if (!sampleSufficient || points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Insufficient sample size for chart"
            description={
              minimumThresholdNote ||
              "Minimum privacy aggregation threshold has not been met for this period."
            }
          />
        </CardContent>
      </Card>
    );
  }

  const maxY = getChartMaxDomain(
    points.flatMap((p) => [p.searchSignals, p.unmetSignals])
  );
  const width = 560;
  const height = 200;
  const padX = 36;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const toX = (idx: number) =>
    points.length === 1
      ? padX + plotW / 2
      : padX + (idx / (points.length - 1)) * plotW;
  const toY = (val: number) => padY + plotH - (val / maxY) * plotH;

  const searchPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.searchSignals)}`)
    .join(" ");
  const unmetPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.unmetSignals)}`)
    .join(" ");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-teal-700">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              Search Signals
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Unmet Signals
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${title} — Search signals (non-sales) over time`}
            className="w-full min-w-[360px] h-52"
          >
            {/* Zero-based horizontal gridlines */}
            {[0, 0.5, 1].map((ratio) => {
              const y = padY + plotH - ratio * plotH;
              const tickVal = Math.round(ratio * maxY);
              return (
                <g key={ratio}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={width - padX}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padX - 6}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px]"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            <path
              d={searchPath}
              fill="none"
              stroke="#0d9488"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d={unmetPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />

            {points.map((p, i) => (
              <g key={p.periodLabel}>
                <circle
                  cx={toX(i)}
                  cy={toY(p.searchSignals)}
                  r="3.5"
                  fill="#0d9488"
                />
                <circle
                  cx={toX(i)}
                  cy={toY(p.unmetSignals)}
                  r="3"
                  fill="#f59e0b"
                />
                <text
                  x={toX(i)}
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px]"
                >
                  {p.periodLabel}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <p className="text-[11px] text-slate-500">
          Unit: Aggregated search signals (not confirmed sales or orders). Y-axis
          starts at 0.
        </p>
      </CardContent>
    </Card>
  );
}

export function DemandVsSupplyChart({
  items,
  sampleSufficient,
}: {
  items: Array<{
    label: string;
    demandSignals: number;
    localSupplyUnits: number;
  }>;
  sampleSufficient: boolean;
}) {
  if (!sampleSufficient || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demand vs. Local Supply</CardTitle>
          <CardDescription>
            Search signals compared against local pharmacy inventory units
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Insufficient sample size"
            description="Demand vs. supply comparison requires verified aggregation."
          />
        </CardContent>
      </Card>
    );
  }

  const maxVal = getChartMaxDomain(
    items.flatMap((i) => [i.demandSignals, i.localSupplyUnits])
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Demand vs. Local Supply</CardTitle>
            <CardDescription>
              Aggregated search signals vs. reported local stock units
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-teal-700">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-600" />
              Search Signals
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-800" />
              Local Supply
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {items.map((row) => {
          const demandPct = Math.round((row.demandSignals / maxVal) * 100);
          const supplyPct = Math.round((row.localSupplyUnits / maxVal) * 100);
          return (
            <div key={row.label} className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-800">{row.label}</span>
                <span className="text-slate-500">
                  {row.demandSignals} signals / {row.localSupplyUnits} units
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{ width: `${demandPct}%` }}
                  />
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-800"
                    style={{ width: `${supplyPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function UnmetCategoryChart({
  signals,
}: {
  signals: UnmetDemandSignal[];
}) {
  if (signals.length === 0) return null;

  const counts = {
    NO_MEDICINE_MATCH: signals
      .filter((s) => s.category === "NO_MEDICINE_MATCH")
      .reduce((acc, s) => acc + s.aggregatedDemandIndicator, 0),
    NO_ELIGIBLE_STOCK: signals
      .filter((s) => s.category === "NO_ELIGIBLE_STOCK")
      .reduce((acc, s) => acc + s.aggregatedDemandIndicator, 0),
    PARTIAL_AVAILABILITY: signals
      .filter((s) => s.category === "PARTIAL_AVAILABILITY")
      .reduce((acc, s) => acc + s.aggregatedDemandIndicator, 0),
  };

  const total = Math.max(
    1,
    counts.NO_MEDICINE_MATCH +
      counts.NO_ELIGIBLE_STOCK +
      counts.PARTIAL_AVAILABILITY
  );

  const bars = [
    {
      label: "No Eligible Nearby Stock",
      value: counts.NO_ELIGIBLE_STOCK,
      color: "bg-rose-500",
    },
    {
      label: "Partial Availability",
      value: counts.PARTIAL_AVAILABILITY,
      color: "bg-amber-500",
    },
    {
      label: "No Medicine Match",
      value: counts.NO_MEDICINE_MATCH,
      color: "bg-slate-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Unmet Demand by Category (Search Signals)
        </CardTitle>
        <CardDescription>
          Aggregated unmet search categories across the selected period
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bars.map((b) => {
          const pct = Math.round((b.value / total) * 100);
          return (
            <div key={b.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">{b.label}</span>
                <span className="text-slate-500">
                  {b.value} signals ({pct}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn("h-full rounded-full", b.color)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
