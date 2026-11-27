"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getStockHistory } from "@/services/pharmacyService";
import type { StockMovementRecord } from "@/types/pharmacy";
import type { ApiError } from "@/types/api";
import { cn } from "@/lib/cn";

export default function PharmacyStockHistoryPage() {
  const { session, logout } = usePharmacyAuth();
  const [records, setRecords] = useState<StockMovementRecord[]>([]);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [movementFilter, setMovementFilter] = useState("all");

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getStockHistory(session, controller.signal);
        if (controller.signal.aborted) return;
        setRecords(res.data ?? []);
        setSource(res.source);
        setNotice(res.notice);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Failed to load stock history.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      const matchesQ =
        !q ||
        r.medicineName.toLowerCase().includes(q) ||
        r.actorName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q);
      const matchesType =
        movementFilter === "all" || r.movementType === movementFilter;
      return matchesQ && matchesType;
    });
  }, [records, query, movementFilter]);

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Stock History" },
        ]}
        title="Stock Movement History"
        description="Chronological audit log of inward restocks, sales, adjustments, and disposals."
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search by medicine, reason, or staff..."
            aria-label="Search stock history"
          />
          <div className="w-full sm:w-52 shrink-0">
            <Select
              aria-label="Filter by movement type"
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value)}
              options={[
                { value: "all", label: "All Movement Types" },
                { value: "INWARD", label: "Inward" },
                { value: "OUTWARD", label: "Outward" },
                { value: "ADJUSTMENT", label: "Adjustment" },
                { value: "DISPOSAL", label: "Disposal" },
              ]}
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
          title="Stock history endpoint unavailable"
          description="GET /api/v1/pharmacies/:id/inventory/history is awaiting Person B implementation."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching stock movements"
          description="Try clearing your search or movement type filter."
        />
      ) : (
        <TableContainer>
          <TableHead>
            <tr>
              <TableHeaderCell>Medicine</TableHeaderCell>
              <TableHeaderCell>Movement</TableHeaderCell>
              <TableHeaderCell>Changed</TableHeaderCell>
              <TableHeaderCell>Prev → New</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Timestamp</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {filtered.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell className="font-semibold text-slate-900">
                  {rec.medicineName}
                </TableCell>
                <TableCell>
                  <Badge variant="neutral">{rec.movementType}</Badge>
                </TableCell>
                <TableCell
                  className={cn(
                    "font-mono font-bold",
                    rec.quantityChanged >= 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                  )}
                >
                  {rec.quantityChanged >= 0
                    ? `+${rec.quantityChanged}`
                    : rec.quantityChanged}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-600">
                  {rec.previousQuantity} → {rec.newQuantity}
                </TableCell>
                <TableCell className="text-xs">
                  {rec.reason.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-xs text-slate-700">
                  {rec.actorName}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-500">
                  {new Date(rec.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </TableContainer>
      )}
    </PharmacyPortalLayout>
  );
}
