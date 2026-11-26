"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  GitCompareArrows,
  ShieldAlert,
} from "lucide-react";
import { PortalShell } from "@/components/layout/PortalShell";
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import {
  SAMPLE_INVENTORY_ROWS,
  SAMPLE_RECENT_ACTIVITY,
} from "@/mock-data/inventory";
import { cn } from "@/lib/cn";

type PreviewMode = "sample" | "loading" | "empty" | "error" | "permission";

export default function PharmacyDashboardPage() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("sample");

  const totalCount = SAMPLE_INVENTORY_ROWS.length;
  const availableCount = SAMPLE_INVENTORY_ROWS.filter(
    (r) => r.availability === "in_stock"
  ).length;
  const lowStockCount = SAMPLE_INVENTORY_ROWS.filter(
    (r) => r.availability === "low_stock"
  ).length;
  const outOfStockCount = SAMPLE_INVENTORY_ROWS.filter(
    (r) => r.availability === "out_of_stock"
  ).length;

  const kpis = [
    {
      label: "Total Listed Medicines",
      value: totalCount,
      icon: <Package className="w-5 h-5 text-teal-600" />,
      tone: "bg-teal-50 border-teal-100",
    },
    {
      label: "Available Stock",
      value: availableCount,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      tone: "bg-emerald-50 border-emerald-100",
    },
    {
      label: "Low-Stock Items",
      value: lowStockCount,
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      tone: "bg-amber-50 border-amber-100",
    },
    {
      label: "Out-of-Stock Items",
      value: outOfStockCount,
      icon: <XCircle className="w-5 h-5 text-rose-600" />,
      tone: "bg-rose-50 border-rose-100",
    },
  ];

  return (
    <PortalShell>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal" },
          { label: "Dashboard" },
        ]}
        title="Pharmacy Operations Dashboard"
        description="Overview of store inventory health, recent stock updates, and quick access to inter-pharmacy collaboration."
        badge={<Badge variant="neutral">Sample Layout</Badge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/pharmacy/inventory"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              <Package className="w-4 h-4" />
              <span>Manage Inventory</span>
            </Link>
            <Link
              href="/collaboration"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white text-slate-700 border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <GitCompareArrows className="w-4 h-4 text-teal-600" />
              <span>Collaboration</span>
            </Link>
          </div>
        }
      />

      <DemoNoticeBanner
        title="Sample Layout Preview"
        description="Metrics and activity items below come from isolated sample data (src/mock-data) to illustrate the dashboard layout. Real operational counts will appear after backend integration."
      />

      {/* State Switcher for UI Verification */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-500">
          Inspect UI State:
        </span>
        {(
          [
            { id: "sample", label: "Sample Layout" },
            { id: "loading", label: "Loading" },
            { id: "empty", label: "Empty" },
            { id: "error", label: "Error" },
            { id: "permission", label: "Permission Required" },
          ] as const
        ).map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setPreviewMode(mode.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer",
              previewMode === mode.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {previewMode === "loading" && <LoadingSkeleton rows={4} />}

      {previewMode === "empty" && (
        <EmptyState
          title="No pharmacy inventory recorded yet"
          description="Add your first medicine SKU to start tracking stock levels and receiving network transfer requests."
          actionLabel="Go to Inventory"
          onAction={() => setPreviewMode("sample")}
        />
      )}

      {previewMode === "error" && (
        <ErrorState
          title="Unable to load pharmacy metrics"
          description="The backend dashboard endpoint did not respond. Please check your connection or retry."
          actionLabel="Retry View"
          onAction={() => setPreviewMode("sample")}
        />
      )}

      {previewMode === "permission" && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Pharmacy Staff Authorization Required
            </h3>
            <p className="text-sm text-slate-600 max-w-md">
              Sign in with an approved pharmacy manager account to view live
              store metrics and modify inventory.
            </p>
            <Link
              href="/pharmacy/login"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              <span>Go to Partner Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {previewMode === "sample" && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {kpi.value}
                    </p>
                    <p className="text-[11px] text-slate-400">Sample count</p>
                  </div>
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl border flex items-center justify-center shrink-0",
                      kpi.tone
                    )}
                  >
                    {kpi.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Inventory Summary Chart (CSS-based, zero extra dependencies) */}
            <Card className="lg:col-span-7">
              <CardHeader>
                <SectionHeader
                  title="Inventory Stock Distribution (Sample)"
                  description="Visual breakdown of sample catalog items by availability state."
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    label: "In Stock",
                    count: availableCount,
                    color: "bg-emerald-500",
                    pct: Math.round((availableCount / totalCount) * 100),
                  },
                  {
                    label: "Low Stock",
                    count: lowStockCount,
                    color: "bg-amber-500",
                    pct: Math.round((lowStockCount / totalCount) * 100),
                  },
                  {
                    label: "Out of Stock",
                    count: outOfStockCount,
                    color: "bg-rose-500",
                    pct: Math.round((outOfStockCount / totalCount) * 100),
                  },
                ].map((bar) => (
                  <div key={bar.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700">{bar.label}</span>
                      <span className="text-slate-500">
                        {bar.count} SKUs ({bar.pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", bar.color)}
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle className="text-base">
                  Recent Inventory Activity
                </CardTitle>
                <CardDescription>Sample audit feed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {SAMPLE_RECENT_ACTIVITY.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">
                        {item.action}
                      </p>
                      <span className="text-[11px] text-slate-400">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{item.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
