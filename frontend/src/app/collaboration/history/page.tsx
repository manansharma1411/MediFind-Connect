"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { TransferStatusBadge } from "@/components/collaboration/TransferStatusBadge";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { listTransfers } from "@/services/collaborationService";
import { filterTransfers, type TransferHistoryFilter } from "@/lib/collaborationUtils";
import type { TransferRequest } from "@/types/collaboration";
import type { ApiError } from "@/types/api";

const PAGE_SIZE = 10;

export default function TransferHistoryPage() {
  const { session, logout } = usePharmacyAuth();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TransferHistoryFilter>({
    query: "",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [page, setPage] = useState(1);

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
        setError(apiErr.message || "Failed to load transfer history.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const filtered = useMemo(
    () => filterTransfers(transfers, filters),
    [transfers, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Collaboration", href: "/collaboration" },
          { label: "Transfer History" },
        ]}
        title="Transfer History"
        description="Search and audit all requested, approved, rejected, dispatched, received, and cancelled stock transfers."
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <SearchInput
              value={filters.query}
              onChange={(e) => {
                setFilters((f) => ({ ...f, query: e.target.value }));
                setPage(1);
              }}
              onClear={() => {
                setFilters((f) => ({ ...f, query: "" }));
                setPage(1);
              }}
              placeholder="Search code, medicine, or pharmacy..."
              aria-label="Search transfer history"
            />
          </div>

          <div className="lg:col-span-3">
            <Select
              aria-label="Filter by transfer status"
              value={filters.status}
              onChange={(e) => {
                setFilters((f) => ({
                  ...f,
                  status: e.target.value as TransferHistoryFilter["status"],
                }));
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "REQUESTED", label: "Requested" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "DISPATCHED", label: "Dispatched" },
                { value: "RECEIVED", label: "Received" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </div>

          <div className="lg:col-span-2">
            <Input
              label="From Date"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                setPage(1);
              }}
            />
          </div>

          <div className="lg:col-span-3">
            <Input
              label="To Date"
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateTo: e.target.value }));
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load history" description={error} />
      ) : source === "unavailable" ? (
        <EmptyState
          title="Transfer history endpoint unavailable"
          description="GET /api/v1/transfers is awaiting Person B implementation."
        />
      ) : paged.length === 0 ? (
        <EmptyState
          title="No matching transfers"
          description="Try clearing your search, status, or date filters."
          actionLabel="Reset Filters"
          onAction={() => {
            setFilters({ query: "", status: "all", dateFrom: "", dateTo: "" });
            setPage(1);
          }}
        />
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <TableHead>
              <tr>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Medicine</TableHeaderCell>
                <TableHeaderCell>From → To</TableHeaderCell>
                <TableHeaderCell>Qty</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell className="text-right">Details</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {paged.map((tr) => (
                <TableRow key={tr.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-800">
                    {tr.transferCode}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {tr.medicineName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {tr.fulfillingPharmacyName} → {tr.requestingPharmacyName}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">
                    {tr.quantityRequested}
                  </TableCell>
                  <TableCell>
                    <TransferStatusBadge status={tr.status} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(tr.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/collaboration/transfers/${encodeURIComponent(
                        tr.id
                      )}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </TableContainer>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </PharmacyPortalLayout>
  );
}
