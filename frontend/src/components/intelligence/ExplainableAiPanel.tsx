import React from "react";
import { Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import {
  formatFreshnessDate,
  getConfidenceBadgeMeta,
} from "@/lib/aiIntelligenceUtils";
import type { ExplainableMetadata } from "@/types/aiIntelligence";

export function ExplainableAiPanel({
  title = "Explainable AI Reasoning",
  metadata,
}: {
  title?: string;
  metadata: ExplainableMetadata | null;
}) {
  if (!metadata) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            Decision-support transparency and limitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Explanation unavailable"
            description="Detailed supporting metrics and confidence metadata are not available for this record yet."
          />
        </CardContent>
      </Card>
    );
  }

  const confMeta = getConfidenceBadgeMeta(metadata.confidenceLevel);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              Period: {metadata.dataPeriod || "—"} · Updated:{" "}
              {formatFreshnessDate(metadata.dataFreshnessAt)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={confMeta.variant}>{confMeta.label}</Badge>
            <Badge variant={metadata.sampleSufficient ? "success" : "neutral"}>
              {metadata.sampleSufficient
                ? "Sample Sufficient"
                : "Insufficient Sample"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              What Was Identified
            </p>
            <p className="text-slate-800">{metadata.whatWasIdentified}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Why It Was Identified
            </p>
            <p className="text-slate-800">{metadata.whyIdentified}</p>
          </div>
        </div>

        {metadata.supportingMetrics.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Supporting Metrics
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {metadata.supportingMetrics.map((m) => (
                <div
                  key={m.label}
                  className="p-3 rounded-xl border border-slate-200 bg-white"
                >
                  <p className="text-[11px] text-slate-500">{m.label}</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Important Limitations: </span>
            {metadata.limitations}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
