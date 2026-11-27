"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, Clock, XCircle } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getPharmacyAlerts } from "@/services/pharmacyService";
import type { PharmacyAlertItem, PharmacyAlertType } from "@/types/pharmacy";
import type { ApiError } from "@/types/api";

function renderAlertBadge(type: PharmacyAlertType) {
  switch (type) {
    case "LOW_STOCK":
      return <Badge variant="warning">Low Stock</Badge>;
    case "OUT_OF_STOCK":
      return <Badge variant="error">Out of Stock</Badge>;
    case "NEAR_EXPIRY":
      return <Badge variant="warning">Near Expiry</Badge>;
    case "EXPIRED":
      return <Badge variant="error">Expired</Badge>;
  }
}

function renderAlertIcon(type: PharmacyAlertType) {
  switch (type) {
    case "LOW_STOCK":
      return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    case "OUT_OF_STOCK":
    case "EXPIRED":
      return <XCircle className="w-5 h-5 text-rose-600" />;
    case "NEAR_EXPIRY":
      return <Clock className="w-5 h-5 text-amber-600" />;
  }
}

export default function PharmacyAlertsPage() {
  const { session, logout } = usePharmacyAuth();
  const [alerts, setAlerts] = useState<PharmacyAlertItem[]>([]);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | PharmacyAlertType>("all");

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getPharmacyAlerts(session, controller.signal);
        if (controller.signal.aborted) return;
        setAlerts(res.data ?? []);
        setSource(res.source);
        setNotice(res.notice);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Failed to load pharmacy alerts.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const filtered = useMemo(
    () =>
      activeTab === "all"
        ? alerts
        : alerts.filter((a) => a.type === activeTab),
    [alerts, activeTab]
  );

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Alerts" },
        ]}
        title="Inventory & Expiry Alerts"
        description="Actionable alerts for low stock, out-of-stock SKUs, near-expiry batches, and expired stock."
        badge={
          alerts.length > 0 ? (
            <Badge variant="warning" dot>
              {alerts.length} Active
            </Badge>
          ) : undefined
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      <Tabs
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as "all" | PharmacyAlertType)}
        tabs={[
          { id: "all", label: "All Alerts", count: alerts.length },
          {
            id: "LOW_STOCK",
            label: "Low Stock",
            count: alerts.filter((a) => a.type === "LOW_STOCK").length,
          },
          {
            id: "OUT_OF_STOCK",
            label: "Out of Stock",
            count: alerts.filter((a) => a.type === "OUT_OF_STOCK").length,
          },
          {
            id: "NEAR_EXPIRY",
            label: "Near Expiry",
            count: alerts.filter((a) => a.type === "NEAR_EXPIRY").length,
          },
          {
            id: "EXPIRED",
            label: "Expired",
            count: alerts.filter((a) => a.type === "EXPIRED").length,
          },
        ]}
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load alerts" description={error} />
      ) : source === "unavailable" ? (
        <EmptyState
          title="Alerts endpoint unavailable"
          description="GET /api/v1/pharmacies/:id/alerts is awaiting Person B implementation."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No alerts in this category"
          description="All monitored inventory items in this category are healthy."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <Card key={alert.id} interactive>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {renderAlertIcon(alert.type)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderAlertBadge(alert.type)}
                      <span className="font-bold text-sm text-slate-900">
                        {alert.medicineName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{alert.detail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <Link
                    href={`/pharmacy/inventory/adjust?itemId=${encodeURIComponent(
                      alert.inventoryItemId
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-semibold transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Open Inventory Item</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
