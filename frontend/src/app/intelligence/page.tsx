import React from "react";
import Link from "next/link";
import { ArrowRight, Radar, RefreshCw, ShieldCheck } from "lucide-react";
import { PortalShell } from "@/components/layout/PortalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";

export default function IntelligencePage() {
  return (
    <PortalShell>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Intelligence" },
        ]}
        title="Network Intelligence Overview"
        description="Evidence-based supply visibility, shortage detection, and restock guidance derived from verified network activity."
        badge={<Badge variant="info">Awaiting Verified Data</Badge>}
      />

      {/* Explicit Empty / Standby State */}
      <EmptyState
        title="Intelligence data will appear when sufficient verified data is available."
        description="MediFind Connect does not fabricate predictions, synthetic confidence scores, or simulated shortage alerts. Insights populate automatically once live pharmacy stock and search telemetry meet verification thresholds."
      />

      {/* Module Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card interactive>
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mb-2">
              <Radar className="w-5 h-5" />
            </div>
            <CardTitle>Shortage Radar</CardTitle>
            <CardDescription>
              Regional shortage severity, evidence summaries, and transparent
              uncertainty indicators.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/intelligence/shortage-radar"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              <span>Open Shortage Radar</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>

        <Card interactive>
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center mb-2">
              <RefreshCw className="w-5 h-5" />
            </div>
            <CardTitle>Smart Restock</CardTitle>
            <CardDescription>
              Reorder quantity guidance, demand trend context, and supplier lead
              times.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/intelligence/smart-restock"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              <span>Open Smart Restock</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Responsible Intelligence Policy:</strong> Every alert and
          restock recommendation includes an explicit explanation and uncertainty
          indicator once backed by verified backend telemetry.
        </p>
      </div>
    </PortalShell>
  );
}
