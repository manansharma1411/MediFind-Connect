"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { TransferStatusBadge } from "@/components/collaboration/TransferStatusBadge";
import { TransferActionModal } from "@/components/collaboration/TransferActionModal";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import {
  approveTransfer,
  cancelTransfer,
  dispatchTransfer,
  getTransferDetails,
  receiveTransfer,
  rejectTransfer,
} from "@/services/collaborationService";
import {
  getPermittedActionsForTransfer,
  resolveTransferActorRole,
} from "@/lib/collaborationUtils";
import type {
  TransferAction,
  TransferHistoryEntry,
  TransferRequest,
} from "@/types/collaboration";
import type { ApiError } from "@/types/api";

export function TransferDetailsClient() {
  const params = useParams<{ id: string }>();
  const transferId = params?.id ?? "";
  const { session, logout } = usePharmacyAuth();

  const [transfer, setTransfer] = useState<TransferRequest | null>(null);
  const [history, setHistory] = useState<TransferHistoryEntry[]>([]);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeAction, setActiveAction] = useState<TransferAction | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const loadDetails = useCallback(async () => {
    if (!session || !transferId) return;
    const controller = new AbortController();
    try {
      const res = await getTransferDetails(
        session,
        transferId,
        controller.signal
      );
      if (controller.signal.aborted) return;
      setTransfer(res.data?.transfer ?? null);
      setHistory(res.data?.history ?? []);
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
      setError(apiErr.message || "Unable to load transfer details.");
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [session, transferId, logout]);

  useEffect(() => {
    if (!session || !transferId) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getTransferDetails(
          session,
          transferId,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setTransfer(res.data?.transfer ?? null);
        setHistory(res.data?.history ?? []);
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
        setError(apiErr.message || "Unable to load transfer details.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [session, transferId, logout]);

  const handleConfirmAction = async (payload: {
    action: TransferAction;
    reason?: string;
    quantity?: number;
    dispatchReference?: string;
    discrepancyNote?: string;
  }) => {
    if (!session || !transfer || isMutating) return;
    setIsMutating(true);
    setFeedback(null);

    try {
      if (payload.action === "approve") {
        await approveTransfer(session, transfer.id);
      } else if (payload.action === "reject") {
        await rejectTransfer(session, transfer.id, payload.reason ?? "");
      } else if (payload.action === "dispatch") {
        await dispatchTransfer(
          session,
          transfer.id,
          payload.dispatchReference
        );
      } else if (payload.action === "receive") {
        await receiveTransfer(session, transfer.id, {
          receivedQuantity: payload.quantity,
          discrepancyNote: payload.discrepancyNote,
        });
      } else if (payload.action === "cancel") {
        await cancelTransfer(session, transfer.id, payload.reason ?? "");
      }

      setActiveAction(null);
      setFeedback({
        variant: "success",
        title: "Transfer Updated",
        message: "Transfer state updated and confirmed by backend.",
      });
      await loadDetails();
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setActiveAction(null);
      setFeedback({
        variant: "warning",
        title: "Action Blocked",
        message: apiErr.message || "Unable to update transfer state.",
      });
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoading) return <LoadingSkeleton rows={5} />;
  if (error)
    return <ErrorState title="Unable to load transfer" description={error} />;
  if (source === "unavailable") {
    return (
      <EmptyState
        title="Transfer detail endpoints unavailable"
        description="GET /api/v1/transfers and /history are awaiting Person B implementation."
      />
    );
  }
  if (!transfer) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Transfer not found"
          description="The requested transfer record could not be located."
        />
        <Link
          href="/collaboration"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Collaboration</span>
        </Link>
      </div>
    );
  }

  const actorRole = session
    ? resolveTransferActorRole(transfer, session.pharmacyId, session.role)
    : null;
  const permittedActions = getPermittedActionsForTransfer(
    transfer.status,
    actorRole
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Collaboration", href: "/collaboration" },
          { label: transfer.transferCode },
        ]}
        title={`Transfer ${transfer.transferCode}`}
        description={transfer.medicineName}
        badge={<TransferStatusBadge status={transfer.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {permittedActions.includes("approve") && (
              <Button size="sm" onClick={() => setActiveAction("approve")}>
                Approve
              </Button>
            )}
            {permittedActions.includes("reject") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveAction("reject")}
              >
                Reject
              </Button>
            )}
            {permittedActions.includes("dispatch") && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveAction("dispatch")}
              >
                Mark Dispatched
              </Button>
            )}
            {permittedActions.includes("receive") && (
              <Button size="sm" onClick={() => setActiveAction("receive")}>
                Confirm Receipt
              </Button>
            )}
            {permittedActions.includes("cancel") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveAction("cancel")}
              >
                Cancel Transfer
              </Button>
            )}
          </div>
        }
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Core Transfer Details */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">Transfer Summary</CardTitle>
            <CardDescription>ID: {transfer.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-500 block">Sending Pharmacy</span>
                <strong className="text-slate-900">
                  {transfer.fulfillingPharmacyName}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Receiving Pharmacy</span>
                <strong className="text-slate-900">
                  {transfer.requestingPharmacyName}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Requested Quantity</span>
                <strong className="font-mono text-slate-900">
                  {transfer.quantityRequested} units
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Approved Quantity</span>
                <strong className="font-mono text-teal-700">
                  {transfer.quantityApproved !== null
                    ? `${transfer.quantityApproved} units`
                    : "Pending approval"}
                </strong>
              </div>
            </div>

            {transfer.notes && (
              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <strong className="text-slate-800 block mb-1">
                  Request Reason / Notes
                </strong>
                <p className="text-slate-600">{transfer.notes}</p>
              </div>
            )}

            {/* Dispatch & Receipt Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="text-slate-800 block">
                  Dispatch Information
                </strong>
                <p className="text-slate-600">
                  Ref: {transfer.dispatchReference ?? "Not dispatched yet"}
                </p>
                {transfer.dispatchedAt && (
                  <p className="text-slate-500">
                    {new Date(transfer.dispatchedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="text-slate-800 block">
                  Receipt Information
                </strong>
                <p className="text-slate-600">
                  Received:{" "}
                  {typeof transfer.receivedQuantity === "number"
                    ? `${transfer.receivedQuantity} units`
                    : "Not received yet"}
                </p>
                {transfer.discrepancyNote && (
                  <p className="text-amber-800">
                    Discrepancy: {transfer.discrepancyNote}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chronological Timeline & Audit Events */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">
              Transfer Timeline & Audit Log
            </CardTitle>
            <CardDescription>
              Immutable state transitions visible to authorized participants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">
                No audit events recorded yet.
              </p>
            ) : (
              history.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      {evt.previousStatus
                        ? `${evt.previousStatus} → ${evt.newStatus}`
                        : evt.newStatus}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {evt.comment && (
                    <p className="text-slate-600">{evt.comment}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <TransferActionModal
        transfer={transfer}
        action={activeAction}
        isSubmitting={isMutating}
        onClose={() => setActiveAction(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
