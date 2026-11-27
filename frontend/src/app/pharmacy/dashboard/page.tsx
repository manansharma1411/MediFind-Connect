"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  XCircle,
  Clock,
  PlusCircle,
  SlidersHorizontal,
  Bell,
  ArrowRight,
} from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
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
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getPharmacyDashboard } from "@/services/pharmacyService";
import type { PharmacyDashboardData } from "@/types/pharmacy";
import type { ApiError } from "@/types/api";
import { cn } from "@/lib/cn";

export default function PharmacyDashboardPage() {
  const { session, logout } = usePharmacyAuth();
  const [data, setData] = useState<PharmacyDashboardData | null>(null);
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
        const res = await getPharmacyDashboard(session, controller.signal);
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
        setError(apiErr.message || "Failed to load pharmacy dashboard.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const totalDist = data
    ? Math.max(
        1,
        data.statusDistribution.inStock +
          data.statusDistribution.lowStock +
          data.statusDistribution.outOfStock +
          data.statusDistribution.expired
      )
    : 1;

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Overview" },
        ]}
        title="Pharmacy Operations Overview"
        description="Real-time inventory health, low-stock and expiry warnings, and quick stock actions."
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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/pharmacy/inventory/add"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Medicine</span>
            </Link>
            <Link
              href="/pharmacy/inventory/adjust"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white text-slate-700 border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-teal-600" />
              <span>Adjust Stock</span>
            </Link>
          </div>
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="Unable to load dashboard"
          description={error}
        />
      ) : !data ? (
        <EmptyState
          title="Dashboard data unavailable"
          description="Connect Person B's GET /api/v1/pharmacies/:id/dashboard endpoint to view live pharmacy KPIs."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: "Total Inventory Items",
                value: data.totalItems,
                icon: <Package className="w-5 h-5 text-teal-600" />,
                tone: "bg-teal-50 border-teal-100",
              },
              {
                label: "Low-Stock Medicines",
                value: data.lowStockCount,
                icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
                tone: "bg-amber-50 border-amber-100",
              },
              {
                label: "Out-of-Stock Medicines",
                value: data.outOfStockCount,
                icon: <XCircle className="w-5 h-5 text-rose-600" />,
                tone: "bg-rose-50 border-rose-100",
              },
              {
                label: "Expiring / Expired",
                value: data.expiringCount,
                icon: <Clock className="w-5 h-5 text-sky-600" />,
                tone: "bg-sky-50 border-sky-100",
              },
            ].map((card) => (
              <Card key={card.label}>
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      {card.label}
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl border flex items-center justify-center shrink-0",
                      card.tone
                    )}
                  >
                    {card.icon}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Inventory Status Distribution */}
            <Card className="lg:col-span-6">
              <CardHeader>
                <SectionHeader
                  title="Inventory Status Distribution"
                  description="Breakdown across stock and expiry states"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    label: "In Stock",
                    count: data.statusDistribution.inStock,
                    color: "bg-emerald-500",
                  },
                  {
                    label: "Low Stock",
                    count: data.statusDistribution.lowStock,
                    color: "bg-amber-500",
                  },
                  {
                    label: "Out of Stock",
                    count: data.statusDistribution.outOfStock,
                    color: "bg-rose-500",
                  },
                  {
                    label: "Expired (Not for Sale)",
                    count: data.statusDistribution.expired,
                    color: "bg-slate-600",
                  },
                ].map((row) => {
                  const pct = Math.round((row.count / totalDist) * 100);
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700">{row.label}</span>
                        <span className="text-slate-500">
                          {row.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", row.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Recent Inventory Activity */}
            <Card className="lg:col-span-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Recent Inventory Activity
                  </CardTitle>
                  <CardDescription>Latest stock movements</CardDescription>
                </div>
                <Link
                  href="/pharmacy/history"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                >
                  <span>Full History</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentActivity.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No recent inventory movements recorded.
                  </p>
                ) : (
                  data.recentActivity.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {act.medicineName}
                        </p>
                        <p className="text-slate-500">
                          {act.reason.replace(/_/g, " ")} • {act.actorName}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "font-mono font-bold shrink-0",
                          act.quantityChanged >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        )}
                      >
                        {act.quantityChanged >= 0
                          ? `+${act.quantityChanged}`
                          : act.quantityChanged}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Low-Stock & Expiry Warnings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Low-Stock Medicines</CardTitle>
                  <CardDescription>
                    Items at or below minimum threshold
                  </CardDescription>
                </div>
                <Link
                  href="/pharmacy/alerts"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>All Alerts</span>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.lowStockItems.length === 0 ? (
                  <p className="text-xs text-slate-500">No low-stock items.</p>
                ) : (
                  data.lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {item.brandName} ({item.medicineName})
                        </p>
                        <p className="text-amber-900">
                          {item.quantityAvailable} left • Threshold:{" "}
                          {item.reorderThreshold}
                        </p>
                      </div>
                      <Link
                        href={`/pharmacy/inventory/adjust?itemId=${encodeURIComponent(
                          item.id
                        )}`}
                        className="font-semibold text-teal-700 hover:text-teal-800 shrink-0"
                      >
                        Restock →
                      </Link>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expiry Warnings</CardTitle>
                <CardDescription>
                  Near-expiry and expired batches
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.expiringItems.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No expiring batches detected.
                  </p>
                ) : (
                  data.expiringItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {item.brandName} • Batch {item.batchNumber ?? "N/A"}
                        </p>
                        <p className="text-rose-900">
                          Expiry: <strong>{item.expiryDate}</strong>
                        </p>
                      </div>
                      <Link
                        href={`/pharmacy/inventory?highlight=${encodeURIComponent(
                          item.id
                        )}`}
                        className="font-semibold text-teal-700 hover:text-teal-800 shrink-0"
                      >
                        Inspect →
                      </Link>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
