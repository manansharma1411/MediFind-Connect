"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox, PlusCircle, Search, Send, Clock } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { TransferStatusBadge } from "@/components/collaboration/TransferStatusBadge";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { listTransfers } from "@/services/collaborationService";
import type { TransferRequest } from "@/types/collaboration";
import type { ApiError } from "@/types/api";

export default function CollaborationOverviewPage() {
  const { session, logout } = usePharmacyAuth();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
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
        const res = await listTransfers(
          session,
          { direction: "all" },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setTransfers(res.data ?? []);
        setSource(res.source);
        setNotice(res.notice);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Unable to load transfer overview.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Collaboration" },
        ]}
        title="Inter-Pharmacy Collaboration"
        description="Discover transfer-eligible stock at nearby partner pharmacies, coordinate approvals, and track dispatch and receipt."
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
          <div className="flex flex-wrap gap-2">
            <Link
              href="/collaboration/discover"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
            >
              <Search className="w-4 h-4" />
              <span>Discover Stock</span>
            </Link>
            <Link
              href="/collaboration/request"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white text-slate-700 border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              <PlusCircle className="w-4 h-4 text-teal-600" />
              <span>New Request</span>
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

      {/* Quick Collaboration Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Stock Discovery",
            desc: "Search partner pharmacies",
            href: "/collaboration/discover",
            icon: <Search className="w-4 h-4 text-teal-600" />,
          },
          {
            title: "Incoming Requests",
            desc: "Approve or reject requests",
            href: "/collaboration/incoming",
            icon: <Inbox className="w-4 h-4 text-teal-600" />,
          },
          {
            title: "Outgoing Requests",
            desc: "Track & confirm receipt",
            href: "/collaboration/outgoing",
            icon: <Send className="w-4 h-4 text-teal-600" />,
          },
          {
            title: "Transfer History",
            desc: "Search & audit past transfers",
            href: "/collaboration/history",
            icon: <Clock className="w-4 h-4 text-teal-600" />,
          },
        ].map((card) => (
          <Link key={card.href} href={card.href}>
            <Card interactive className="h-full">
              <CardHeader className="p-4">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-2">
                  {card.icon}
                </div>
                <CardTitle className="text-sm">{card.title}</CardTitle>
                <CardDescription className="text-xs">{card.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Transfers */}
      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load transfers" description={error} />
      ) : source === "unavailable" ? (
        <EmptyState
          title="Collaboration endpoints unavailable"
          description="GET /api/v1/transfers is awaiting Person B implementation. Transfers will appear once the backend is connected."
        />
      ) : transfers.length === 0 ? (
        <EmptyState
          title="No transfer requests yet"
          description="Use Stock Discovery to locate medicines at nearby partner pharmacies and submit a transfer request."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Active & Recent Transfers ({transfers.length})
            </CardTitle>
            <CardDescription>
              Select any transfer to view its full timeline and permitted
              actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {transfers.map((tr) => (
              <div
                key={tr.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {tr.transferCode}
                    </span>
                    <TransferStatusBadge status={tr.status} />
                  </div>
                  <p className="font-bold text-sm text-slate-900">
                    {tr.medicineName} ({tr.quantityRequested} units)
                  </p>
                  <p className="text-xs text-slate-600">
                    From <strong>{tr.fulfillingPharmacyName}</strong> → To{" "}
                    <strong>{tr.requestingPharmacyName}</strong>
                  </p>
                </div>

                <Link
                  href={`/collaboration/transfers/${encodeURIComponent(tr.id)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 shrink-0"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PharmacyPortalLayout>
  );
}
