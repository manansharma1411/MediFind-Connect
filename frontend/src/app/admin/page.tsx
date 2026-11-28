"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { listAdminPharmacies } from "@/services/adminVerificationService";
import type {
  AdminPharmacyVerificationRecord,
  AdminVerificationSummary,
} from "@/types/adminVerification";
import type { ApiError } from "@/types/api";

export default function SuperAdminOverviewPage() {
  const { session, logout } = usePharmacyAuth();
  const [summary, setSummary] = useState<AdminVerificationSummary | null>(null);
  const [recentRegistrations, setRecentRegistrations] = useState<
    AdminPharmacyVerificationRecord[]
  >([]);
  const [source, setSource] = useState<"live" | "unavailable">("unavailable");
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await listAdminPharmacies(session, {}, controller.signal);
        if (controller.signal.aborted) return;
        setSource(res.source);
        setNotice(res.notice);
        if (res.data) {
          setSummary(res.data.summary);
          setRecentRegistrations(res.data.items.slice(0, 5));
        }
        setError(null);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Unable to load platform admin overview.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Overview" },
        ]}
        title="Platform Control Overview"
        description="Centralized MediFind Connect governance across pharmacy verification, users, medicine catalog, and audit history."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live Admin API
            </Badge>
          ) : (
            <Badge variant="info">Awaiting Admin Backend</Badge>
          )
        }
      />

      {notice && (
        <DemoNoticeBanner
          title="Backend Admin APIs Required"
          description={notice}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Failed to load admin overview" description={error} />
      ) : (
        <div className="space-y-6">
          {/* Platform KPIs — real backend data only, never hardcoded */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Registered Pharmacies</CardDescription>
                <CardTitle className="text-2xl text-slate-900">
                  {summary?.totalRegisteredCount ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Verification Requests</CardDescription>
                <CardTitle className="text-2xl text-amber-700">
                  {summary?.pendingCount ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href="/admin/pharmacy-verification"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Review Verification Queue <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Verified Pharmacies</CardDescription>
                <CardTitle className="text-2xl text-emerald-700">
                  {summary?.verifiedCount ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rejected Pharmacies</CardDescription>
                <CardTitle className="text-2xl text-rose-700">
                  {summary?.rejectedCount ?? "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Registered Users</CardDescription>
                <CardTitle className="text-2xl text-slate-900">—</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-slate-500">
                Awaiting /api/v1/admin/users
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Medicine Listings</CardDescription>
                <CardTitle className="text-2xl text-slate-900">—</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-slate-500">
                Awaiting /api/v1/admin/medicines
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-teal-600" />
                  Recent Pharmacy Registrations
                </CardTitle>
                <CardDescription>
                  Latest stores submitted for verification review
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentRegistrations.length === 0 ? (
                  <EmptyState
                    title="No recent registrations loaded"
                    description="Recent pharmacy applications will appear once Person B's admin verification endpoints are active."
                  />
                ) : (
                  <ul className="space-y-2.5 text-sm">
                    {recentRegistrations.map((r) => (
                      <li
                        key={r.id}
                        className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{r.name}</p>
                          <p className="text-xs text-slate-500">
                            {r.area}, {r.city} ·{" "}
                            {new Date(r.registeredAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="warning">{r.verificationStatus}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Recent Admin Activity
                </CardTitle>
                <CardDescription>
                  Verification approvals, rejections, and audit events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="Admin activity feed unavailable"
                  description="Audit trail events will populate once Person B implements /api/v1/admin/audit-logs."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}
