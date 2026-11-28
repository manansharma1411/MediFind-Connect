"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
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
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { listAllAdminPharmacies } from "@/services/adminVerificationService";
import {
  getAdminDataStatusBadge,
  getVerificationStatusMeta,
} from "@/lib/adminVerificationUtils";
import type {
  AdminPharmacyVerificationRecord,
  AdminVerificationStatus,
} from "@/types/adminVerification";
import type { PaginationMeta } from "@/types/aiIntelligence";
import type { ApiError } from "@/types/api";

const PAGE_SIZE = 20;

export default function AdminPharmaciesPage() {
  const { session, logout } = usePharmacyAuth();
  const [items, setItems] = useState<AdminPharmacyVerificationRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminVerificationStatus | "ALL">("ALL");
  const [isActive, setIsActive] = useState<"all" | "true" | "false">("all");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "name" | "verificationStatus"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPharmacies = useCallback(
    async (signal?: AbortSignal) => {
      if (!session) return;
      try {
        const res = await listAllAdminPharmacies(
          session,
          {
            search,
            status,
            isActive,
            sortBy,
            sortOrder,
            page,
            limit: PAGE_SIZE,
          },
          signal
        );
        if (signal?.aborted) return;
        setItems(res.items);
        setPagination(res.pagination);
        setError(null);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(
          apiErr.message || "Unable to load pharmacies from the backend."
        );
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [session, search, status, isActive, sortBy, sortOrder, page, logout]
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadPharmacies(controller.signal));
    return () => controller.abort();
  }, [loadPharmacies]);

  const statusBadge = getAdminDataStatusBadge({
    isLoading,
    error,
    source: error ? "unavailable" : "live",
    itemCount: items.length,
  });

  const currentPage = pagination.page ?? page;
  const totalPages = Math.max(1, pagination.totalPages ?? 1);
  const totalRecords = pagination.total ?? items.length;

  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Pharmacies" },
        ]}
        title="Platform Pharmacy Management"
        description="View, filter, and audit all registered pharmacies across MediFind Connect."
        badge={
          <Badge variant={statusBadge.variant} dot>
            {statusBadge.label}
          </Badge>
        }
      />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
              placeholder="Search name, city, area, or licence..."
            />
          </div>
          <Select
            label="Verification Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AdminVerificationStatus | "ALL");
              setPage(1);
            }}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "VERIFIED", label: "Verified" },
              { value: "REJECTED", label: "Rejected" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
          />
          <Select
            label="Active State"
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value as "all" | "true" | "false");
              setPage(1);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "true", label: "Active Only" },
              { value: "false", label: "Inactive Only" },
            ]}
          />
          <Select
            label="Sort By"
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split(":") as [
                "createdAt" | "name" | "verificationStatus",
                "asc" | "desc",
              ];
              setSortBy(field);
              setSortOrder(order);
              setPage(1);
            }}
            options={[
              { value: "createdAt:desc", label: "Newest Registered" },
              { value: "createdAt:asc", label: "Oldest Registered" },
              { value: "name:asc", label: "Name (A–Z)" },
              { value: "name:desc", label: "Name (Z–A)" },
              { value: "verificationStatus:asc", label: "Status (A–Z)" },
            ]}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="API Unavailable"
          description={error}
          actionLabel="Retry"
          onAction={() => {
            setIsLoading(true);
            void loadPharmacies();
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No Records"
          description="No registered pharmacies match the current search and filters."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Registered Pharmacies ({totalRecords})
            </CardTitle>
            <CardDescription>
              Live pharmacy directory from GET /api/v1/admin/pharmacies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TableContainer>
              <TableHead>
                <tr>
                  <TableHeaderCell>Pharmacy</TableHeaderCell>
                  <TableHeaderCell>Contact</TableHeaderCell>
                  <TableHeaderCell>Location</TableHeaderCell>
                  <TableHeaderCell>Licence</TableHeaderCell>
                  <TableHeaderCell>Verification</TableHeaderCell>
                  <TableHeaderCell>Active</TableHeaderCell>
                  <TableHeaderCell>Registered</TableHeaderCell>
                  <TableHeaderCell>Review</TableHeaderCell>
                </tr>
              </TableHead>
              <tbody>
                {items.map((item) => {
                  const meta = getVerificationStatusMeta(
                    item.verificationStatus
                  );
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-semibold text-slate-900">
                          {item.name}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <p>{item.contactPhone}</p>
                        {item.contactEmail && <p>{item.contactEmail}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {item.area ? `${item.area}, ` : ""}
                        {item.city}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.licenseNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "success" : "neutral"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {item.registeredAt
                          ? new Date(item.registeredAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href="/admin/pharmacy-verification"
                          className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                        >
                          Manage
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </TableContainer>

            <div className="flex items-center justify-between text-xs text-slate-600 pt-2">
              <span>
                Page {currentPage} of {totalPages} ({totalRecords} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </SuperAdminLayout>
  );
}
