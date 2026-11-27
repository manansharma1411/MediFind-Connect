"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { TransferStatusBadge } from "@/components/collaboration/TransferStatusBadge";
import { TransferActionModal } from "@/components/collaboration/TransferActionModal";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import {
  approveTransfer,
  cancelTransfer,
  dispatchTransfer,
  listTransfers,
  rejectTransfer,
} from "@/services/collaborationService";
import {
  getPermittedActionsForTransfer,
  resolveTransferActorRole,
} from "@/lib/collaborationUtils";
import type { TransferAction, TransferRequest } from "@/types/collaboration";
import type { ApiError } from "@/types/api";

export default function IncomingRequestsPage() {
  const { session, logout } = usePharmacyAuth();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalState, setModalState] = useState<{
    transfer: TransferRequest | null;
    action: TransferAction | null;
  }>({ transfer: null, action: null });
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const refreshList = useCallback(async () => {
    if (!session) return;
    const controller = new AbortController();
    try {
      const res = await listTransfers(
        session,
        { direction: "incoming" },
        controller.signal
      );
      if (controller.signal.aborted) return;
      setTransfers(res.data ?? []);
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
      setError(apiErr.message || "Failed to load incoming requests.");
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [session, logout]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await listTransfers(
          session,
          { direction: "incoming" },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setTransfers(res.data ?? []);
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
        setError(apiErr.message || "Failed to load incoming requests.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const handleConfirmAction = async (payload: {
    action: TransferAction;
    reason?: string;
    dispatchReference?: string;
  }) => {
    if (!session || !modalState.transfer || isMutating) return;
    const tr = modalState.transfer;

    setIsMutating(true);
    setFeedback(null);

    try {
      if (payload.action === "approve") {
        await approveTransfer(session, tr.id);
      } else if (payload.action === "reject") {
        await rejectTransfer(session, tr.id, payload.reason ?? "");
      } else if (payload.action === "dispatch") {
        await dispatchTransfer(session, tr.id, payload.dispatchReference);
      } else if (payload.action === "cancel") {
        await cancelTransfer(session, tr.id, payload.reason ?? "");
      }

      setModalState({ transfer: null, action: null });
      setFeedback({
        variant: "success",
        title: "Transfer Updated",
        message: `${tr.transferCode} updated cleanly.`,
      });
      await refreshList();
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setModalState({ transfer: null, action: null });
      setFeedback({
        variant: "warning",
        title:
          apiErr.code === "INSUFFICIENT_STOCK"
            ? "Insufficient Stock"
            : apiErr.code === "INVALID_STATE_TRANSITION"
            ? "Invalid State Transition"
            : "Action Blocked",
        message: apiErr.message || "Unable to update transfer status.",
      });
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Collaboration", href: "/collaboration" },
          { label: "Incoming Requests" },
        ]}
        title="Incoming Transfer Requests"
        description="Review stock requisitions from partner pharmacies, approve or reject requests, and mark approved items as dispatched."
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      {feedback && (
        <Toast
          variant={feedback.variant}
          title={feedback.title}
          description={feedback.message}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load incoming requests" description={error} />
      ) : source === "unavailable" ? (
        <EmptyState
          title="Incoming transfers endpoint unavailable"
          description="GET /api/v1/transfers?direction=incoming is awaiting Person B implementation."
        />
      ) : transfers.length === 0 ? (
        <EmptyState
          title="No incoming transfer requests"
          description="Partner pharmacy stock requests directed to your store will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transfers.map((tr) => {
            const role = session
              ? resolveTransferActorRole(tr, session.pharmacyId, session.role)
              : null;
            const actions = getPermittedActionsForTransfer(tr.status, role);

            return (
              <Card key={tr.id} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-semibold text-slate-400">
                        {tr.transferCode} •{" "}
                        {new Date(tr.createdAt).toLocaleDateString()}
                      </span>
                      <CardTitle className="mt-1 text-base">
                        {tr.medicineName}
                      </CardTitle>
                      <CardDescription>
                        Requested by{" "}
                        <strong className="text-slate-700">
                          {tr.requestingPharmacyName}
                        </strong>
                      </CardDescription>
                    </div>
                    <TransferStatusBadge status={tr.status} />
                  </div>
                </CardHeader>

                <CardContent className="pt-0 text-xs space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex justify-between">
                    <span className="text-slate-500">Requested Quantity</span>
                    <strong className="font-mono text-teal-700">
                      {tr.quantityRequested} units
                    </strong>
                  </div>
                  {tr.notes && (
                    <p className="text-slate-600 line-clamp-2">{tr.notes}</p>
                  )}
                </CardContent>

                <CardFooter>
                  <div className="flex flex-wrap items-center gap-2">
                    {actions.includes("approve") && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          setModalState({ transfer: tr, action: "approve" })
                        }
                      >
                        Approve
                      </Button>
                    )}
                    {actions.includes("reject") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setModalState({ transfer: tr, action: "reject" })
                        }
                      >
                        Reject
                      </Button>
                    )}
                    {actions.includes("dispatch") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setModalState({ transfer: tr, action: "dispatch" })
                        }
                      >
                        Mark Dispatched
                      </Button>
                    )}
                  </div>

                  <Link
                    href={`/collaboration/transfers/${encodeURIComponent(tr.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <TransferActionModal
        transfer={modalState.transfer}
        action={modalState.action}
        isSubmitting={isMutating}
        onClose={() => setModalState({ transfer: null, action: null })}
        onConfirm={handleConfirmAction}
      />
    </PharmacyPortalLayout>
  );
}
