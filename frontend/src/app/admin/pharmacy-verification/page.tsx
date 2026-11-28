"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, ShieldCheck, XCircle } from "lucide-react";
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
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
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
import {
  getAdminPharmacyVerificationDetails,
  listAdminPharmacies,
  submitPharmacyVerificationDecision,
} from "@/services/adminVerificationService";
import {
  filterVerificationRecords,
  getVerificationStatusMeta,
  paginateVerificationRecords,
  validateRejectionReason,
} from "@/lib/adminVerificationUtils";
import type {
  AdminPharmacyVerificationRecord,
  AdminVerificationStatus,
  AdminVerificationSummary,
} from "@/types/adminVerification";
import type { ApiError } from "@/types/api";

const PAGE_SIZE = 10;

export default function AdminPharmacyVerificationPage() {
  return (
    <SuperAdminLayout>
      <AdminPharmacyVerificationContent />
    </SuperAdminLayout>
  );
}

function AdminPharmacyVerificationContent() {
  const { session, logout } = usePharmacyAuth();
  const [summary, setSummary] = useState<AdminVerificationSummary | null>(null);
  const [records, setRecords] = useState<AdminPharmacyVerificationRecord[]>([]);
  const [selected, setSelected] =
    useState<AdminPharmacyVerificationRecord | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    AdminVerificationStatus | "ALL"
  >("ALL");
  const [page, setPage] = useState(1);

  const [source, setSource] = useState<"live" | "unavailable">("unavailable");
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approveTarget, setApproveTarget] =
    useState<AdminPharmacyVerificationRecord | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<AdminPharmacyVerificationRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const [toast, setToast] = useState<{
    variant: "success" | "warning" | "info";
    title: string;
    description: string;
  } | null>(null);

  const loadDashboard = useCallback(
    async (signal?: AbortSignal) => {
      if (!session) return;
      try {
        const res = await listAdminPharmacies(
          session,
          { status: "ALL" },
          signal
        );
        if (signal?.aborted) return;
        setError(null);
        setSource(res.source);
        setNotice(res.notice);
        if (res.data) {
          const safeItems = Array.isArray(res.data.items) ? res.data.items : [];
          setSummary(res.data.summary ?? null);
          setRecords(safeItems);
          setSelected((prev) =>
            prev
              ? safeItems.find((i) => i.id === prev.id) ?? safeItems[0] ?? null
              : safeItems[0] ?? null
          );
        } else {
          setSummary(null);
          setRecords([]);
          setSelected(null);
        }
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(
          apiErr.message || "Unable to load pharmacy verification records."
        );
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [session, logout]
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadDashboard(controller.signal));
    return () => controller.abort();
  }, [loadDashboard]);

  const filtered = useMemo(
    () =>
      filterVerificationRecords(records, {
        query: search,
        status: statusFilter,
      }),
    [records, search, statusFilter]
  );

  const { pageItems, totalPages, currentPage } = useMemo(
    () => paginateVerificationRecords(filtered, page, PAGE_SIZE),
    [filtered, page]
  );

  const handleSelectRecord = async (record: AdminPharmacyVerificationRecord) => {
    setSelected(record);
    try {
      const detail = await getAdminPharmacyVerificationDetails(
        session,
        record.id
      );
      if (detail.data) setSelected(detail.data);
    } catch {
      // Keep list record if detail endpoint is unavailable
    }
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget || isMutating) return;
    setIsMutating(true);
    try {
      await submitPharmacyVerificationDecision(session, approveTarget.id, {
        decision: "VERIFIED",
      });
      setToast({
        variant: "success",
        title: "Pharmacy Verified",
        description: `${approveTarget.name} has been verified.`,
      });
      setApproveTarget(null);
      await loadDashboard();
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setToast({
        variant: "warning",
        title: "Approval Failed",
        description: apiErr.message || "Unable to approve pharmacy.",
      });
    } finally {
      setIsMutating(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget || isMutating) return;
    const reasonErr = validateRejectionReason(rejectionReason);
    setRejectionError(reasonErr);
    if (reasonErr) return;

    setIsMutating(true);
    try {
      await submitPharmacyVerificationDecision(session, rejectTarget.id, {
        decision: "REJECTED",
        reason: rejectionReason.trim(),
      });
      setToast({
        variant: "success",
        title: "Pharmacy Rejected",
        description: `${rejectTarget.name} has been marked as rejected.`,
      });
      setRejectTarget(null);
      setRejectionReason("");
      setRejectionError(null);
      await loadDashboard();
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setToast({
        variant: "warning",
        title: "Rejection Failed",
        description: apiErr.message || "Unable to reject pharmacy.",
      });
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Pharmacy Verification" },
        ]}
        title="Pharmacy Verification Dashboard"
        description="Review submitted pharmacy registrations, inspect drug licence credentials, and approve or reject partner applications."
        badge={
          source === "live" ? (
            <Badge variant="success" dot>
              Live Admin API
            </Badge>
          ) : (
            <Badge variant="info">Awaiting Admin Endpoints</Badge>
          )
        }
      />

      {notice && (
        <DemoNoticeBanner
          title="Admin Verification Backend Status"
          description={notice}
        />
      )}

      {toast && (
        <Toast
          variant={toast.variant}
          title={toast.title}
          description={toast.description}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Verification</CardDescription>
            <CardTitle className="text-2xl text-amber-700">
              {summary?.pendingCount ?? "—"}
            </CardTitle>
          </CardHeader>
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
            <CardDescription>Total Registered Pharmacies</CardDescription>
            <CardTitle className="text-2xl text-slate-900">
              {summary?.totalRegisteredCount ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by pharmacy name, city, area, or contact..."
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              label="Verification Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as AdminVerificationStatus | "ALL"
                );
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
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="Unable to load verification queue"
          description={error}
          actionLabel="Retry"
          onAction={() => loadDashboard()}
        />
      ) : pageItems.length === 0 ? (
        <EmptyState
          title="No pharmacy verification records found"
          description={
            source === "unavailable"
              ? "Admin verification endpoints are not yet implemented by Person B."
              : "No pharmacy applications match the current search or status filter."
          }
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Registered Pharmacy Applications
              </CardTitle>
              <CardDescription>
                Select an application to inspect submitted drug licence details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TableContainer>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Pharmacy</TableHeaderCell>
                    <TableHeaderCell>Owner / Contact</TableHeaderCell>
                    <TableHeaderCell>City & Area</TableHeaderCell>
                    <TableHeaderCell>Registered</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </tr>
                </TableHead>
                <tbody>
                  {pageItems.map((item) => {
                    const meta = getVerificationStatusMeta(
                      item.verificationStatus
                    );
                    const isSelected = selected?.id === item.id;
                    return (
                      <TableRow
                        key={item.id}
                        className={isSelected ? "bg-teal-50/40" : undefined}
                      >
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {item.name}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          <p className="font-medium text-slate-800">
                            {item.ownerName ?? "Owner"}
                          </p>
                          <p>{item.contactEmail ?? item.contactPhone}</p>
                        </TableCell>
                        <TableCell>
                          {item.area}, {item.city}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(item.registeredAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectRecord(item)}
                            >
                              Inspect
                            </Button>
                            {item.verificationStatus === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => setApproveTarget(item)}
                                  leftIcon={
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setRejectTarget(item);
                                    setRejectionReason("");
                                    setRejectionError(null);
                                  }}
                                  leftIcon={<XCircle className="w-3.5 h-3.5" />}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </TableContainer>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-2">
                <span>
                  Page {currentPage} of {totalPages} ({filtered.length} records)
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

          {selected && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-teal-600" />
                      Verification Details — {selected.name}
                    </CardTitle>
                    <CardDescription>
                      Submitted drug licence and registration audit information
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      getVerificationStatusMeta(selected.verificationStatus)
                        .variant
                    }
                  >
                    {
                      getVerificationStatusMeta(selected.verificationStatus)
                        .label
                    }
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Registered Address
                    </p>
                    <p className="text-slate-800">
                      {selected.registeredAddress}, {selected.area},{" "}
                      {selected.city}, {selected.state} — {selected.pincode}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Contact & Owner
                    </p>
                    <p className="text-slate-800">
                      {selected.ownerName ?? "Owner"} · {selected.contactPhone}{" "}
                      {selected.contactEmail
                        ? `· ${selected.contactEmail}`
                        : ""}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Submitted Drug Licence Number
                    </p>
                    <p className="font-mono font-bold text-slate-900">
                      {selected.licenseNumber ?? "Not provided"}
                    </p>
                    {selected.licenseReviewNotes && (
                      <p className="text-xs text-slate-600">
                        {selected.licenseReviewNotes}
                      </p>
                    )}
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Registration Timestamp
                    </p>
                    <p className="text-slate-800">
                      {new Date(selected.registeredAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {(selected.history ?? []).length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      Verification History
                    </p>
                    <ul className="space-y-2">
                      {(selected.history ?? []).map((h) => (
                        <li
                          key={h.id}
                          className="p-3 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {h.previousStatus ?? "NEW"} → {h.newStatus}
                            </span>
                            {h.reason && (
                              <span className="text-slate-600 ml-2">
                                ({h.reason})
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500">
                            {new Date(h.reviewedAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Approval Confirmation Modal */}
      <Modal
        isOpen={Boolean(approveTarget)}
        onClose={() => !isMutating && setApproveTarget(null)}
        title="Confirm Pharmacy Verification"
        description="Verify drug licence details before approving this pharmacy for live portal collaboration."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              disabled={isMutating}
              onClick={() => setApproveTarget(null)}
            >
              Cancel
            </Button>
            <Button isLoading={isMutating} onClick={handleConfirmApprove}>
              Confirm Approval
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Approve <strong>{approveTarget?.name}</strong> (Licence:{" "}
          <span className="font-mono">
            {approveTarget?.licenseNumber ?? "N/A"}
          </span>
          )?
        </p>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => !isMutating && setRejectTarget(null)}
        title="Reject Pharmacy Application"
        description="A documented reason is required when rejecting a pharmacy verification request."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              disabled={isMutating}
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isMutating}
              onClick={handleConfirmReject}
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label
            htmlFor="rejection-reason"
            className="block text-sm font-semibold text-slate-700"
          >
            Rejection Reason
          </label>
          <textarea
            id="rejection-reason"
            rows={3}
            value={rejectionReason}
            onChange={(e) => {
              setRejectionReason(e.target.value);
              if (rejectionError) setRejectionError(null);
            }}
            placeholder="e.g. Drug licence number could not be matched with state registry."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {rejectionError && (
            <p className="text-xs font-medium text-rose-600">
              {rejectionError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
