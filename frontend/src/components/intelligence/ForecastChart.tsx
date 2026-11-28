import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { getForecastChartMaxDomain } from "@/lib/aiIntelligenceUtils";
import type { DemandForecastData } from "@/types/aiIntelligence";

export function ForecastChart({ forecast }: { forecast: DemandForecastData }) {
  const totalPoints =
    forecast.historicalPoints.length + forecast.forecastPoints.length;

  if (!forecast.sampleSufficient || totalPoints === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Historical Demand & Future Forecast
          </CardTitle>
          <CardDescription>
            {forecast.medicineName} — {forecast.area}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Insufficient historical data for forecast"
            description={
              forecast.insufficientHistoryMessage ||
              "Minimum historical search-signal threshold has not been met to render a forecast."
            }
          />
        </CardContent>
      </Card>
    );
  }

  const maxY = getForecastChartMaxDomain(forecast);
  const width = 620;
  const height = 230;
  const padX = 40;
  const padY = 22;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const toX = (idx: number) =>
    totalPoints <= 1
      ? padX + plotW / 2
      : padX + (idx / (totalPoints - 1)) * plotW;
  const toY = (val: number) => padY + plotH - (val / maxY) * plotH;

  const histLen = forecast.historicalPoints.length;
  const histPath = forecast.historicalPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.observedDemand)}`)
    .join(" ");

  const forecastStartIdx = Math.max(0, histLen - 1);
  const forecastLinePoints = [
    ...(histLen > 0
      ? [
          {
            idx: histLen - 1,
            val: forecast.historicalPoints[histLen - 1].observedDemand,
          },
        ]
      : []),
    ...forecast.forecastPoints.map((p, i) => ({
      idx: histLen + i,
      val: p.predictedDemand,
    })),
  ];

  const forecastPath = forecastLinePoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.idx)},${toY(p.val)}`)
    .join(" ");

  const bandPoints = forecast.forecastPoints
    .map((p, i) => ({
      idx: histLen + i,
      low: p.lowerBound,
      high: p.upperBound,
    }))
    .filter(
      (b): b is { idx: number; low: number; high: number } =>
        typeof b.low === "number" && typeof b.high === "number"
    );

  const bandPolygon =
    bandPoints.length >= 2
      ? [
          ...bandPoints.map((b) => `${toX(b.idx)},${toY(b.high)}`),
          ...[...bandPoints].reverse().map((b) => `${toX(b.idx)},${toY(b.low)}`),
        ].join(" ")
      : null;

  const allLabels = [
    ...forecast.historicalPoints.map((p) => p.dateLabel),
    ...forecast.forecastPoints.map((p) => p.dateLabel),
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Historical Observations vs. {forecast.horizonDays}-Day Forecast
            </CardTitle>
            <CardDescription>
              {forecast.medicineName} — {forecast.area} ({forecast.modelName})
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-slate-800">
              <span className="w-4 h-0.5 bg-slate-800 inline-block" />
              Observed History
            </span>
            <span className="inline-flex items-center gap-1.5 text-teal-700">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-teal-600 inline-block" />
              Projected Forecast
            </span>
            {bandPolygon && (
              <span className="inline-flex items-center gap-1.5 text-teal-700">
                <span className="w-3 h-2.5 rounded-xs bg-teal-500/20 border border-teal-300 inline-block" />
                Uncertainty Range
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[480px] h-56"
            role="img"
            aria-label={`Demand forecast chart for ${forecast.medicineName}`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padY + plotH - ratio * plotH;
              const val = Math.round(ratio * maxY);
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
                    x={padX - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {histLen > 0 && forecast.forecastPoints.length > 0 && (
              <line
                x1={toX(forecastStartIdx)}
                y1={padY}
                x2={toX(forecastStartIdx)}
                y2={padY + plotH}
                stroke="#94a3b8"
                strokeDasharray="2 3"
              />
            )}

            {bandPolygon && (
              <polygon
                points={bandPolygon}
                fill="#0d9488"
                fillOpacity="0.14"
              />
            )}

            {histPath && (
              <path
                d={histPath}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {forecastPath && (
              <path
                d={forecastPath}
                fill="none"
                stroke="#0d9488"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {forecast.historicalPoints.map((p, i) => (
              <circle
                key={`h-${p.dateLabel}-${i}`}
                cx={toX(i)}
                cy={toY(p.observedDemand)}
                r="3.5"
                fill="#0f172a"
              />
            ))}

            {forecast.forecastPoints.map((p, i) => (
              <circle
                key={`f-${p.dateLabel}-${i}`}
                cx={toX(histLen + i)}
                cy={toY(p.predictedDemand)}
                r="3.5"
                fill="#0d9488"
              />
            ))}

            {allLabels.map((lbl, i) => (
              <text
                key={`${lbl}-${i}`}
                x={toX(i)}
                y={height - 4}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
              >
                {lbl}
              </text>
            ))}
          </svg>
        </div>

        <p className="text-xs text-slate-500">
          {forecast.baselineDescription}. {forecast.explanation}
        </p>
      </CardContent>
    </Card>
  );
}
