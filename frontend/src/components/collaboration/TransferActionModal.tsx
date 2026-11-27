"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { validateMandatoryReason } from "@/lib/collaborationUtils";
import type { TransferAction, TransferRequest } from "@/types/collaboration";

export interface TransferActionModalProps {
  transfer: TransferRequest | null;
  action: TransferAction | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    action: TransferAction;
    reason?: string;
    quantity?: number;
    dispatchReference?: string;
    discrepancyNote?: string;
  }) => void;
}

const ACTION_TITLES: Record<TransferAction, string> = {
  approve: "Confirm Transfer Approval",
  reject: "Confirm Transfer Rejection",
  dispatch: "Confirm Transfer Dispatch",
  receive: "Confirm Transfer Receipt",
  cancel: "Confirm Transfer Cancellation",
};

export function TransferActionModal({
  transfer,
  action,
  isSubmitting,
  onClose,
  onConfirm,
}: TransferActionModalProps) {
  const [reason, setReason] = useState("");
  const [dispatchReference, setDispatchReference] = useState("");
  const [receivedQty, setReceivedQty] = useState(
    transfer
      ? String(transfer.quantityApproved ?? transfer.quantityRequested)
      : ""
  );
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!transfer || !action) return null;

  const requiresReason = action === "reject" || action === "cancel";

  const handleSubmit = () => {
    setValidationError(null);

    if (requiresReason) {
      const err = validateMandatoryReason(reason);
      if (err) {
        setValidationError(err);
        return;
      }
    }

    if (action === "receive") {
      const qty = Number(receivedQty);
      if (receivedQty.trim() !== "" && (!Number.isInteger(qty) || qty < 0)) {
        setValidationError("Received quantity must be a non-negative integer.");
        return;
      }
      onConfirm({
        action,
        quantity: receivedQty.trim() !== "" ? qty : undefined,
        discrepancyNote: discrepancyNote.trim() || undefined,
      });
      return;
    }

    onConfirm({
      action,
      reason: requiresReason ? reason.trim() : undefined,
      dispatchReference:
        action === "dispatch" ? dispatchReference.trim() || undefined : undefined,
    });
  };

  return (
    <Modal
      isOpen={Boolean(transfer && action)}
      onClose={onClose}
      title={ACTION_TITLES[action]}
      description={`${transfer.transferCode} • ${transfer.medicineName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={action === "reject" || action === "cancel" ? "danger" : "primary"}
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            Confirm {action.charAt(0).toUpperCase() + action.slice(1)}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Sending Pharmacy</span>
            <strong className="text-slate-900">
              {transfer.fulfillingPharmacyName}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Receiving Pharmacy</span>
            <strong className="text-slate-900">
              {transfer.requestingPharmacyName}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Requested Quantity</span>
            <strong className="font-mono text-teal-700">
              {transfer.quantityRequested}
            </strong>
          </div>
        </div>

        {requiresReason && (
          <Input
            label={
              action === "reject"
                ? "Rejection Reason (Required)"
                : "Cancellation Reason (Required)"
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={validationError ?? undefined}
            placeholder="Enter at least 5 characters..."
          />
        )}

        {action === "dispatch" && (
          <Input
            label="Dispatch Reference / Runner Details (Optional)"
            value={dispatchReference}
            onChange={(e) => setDispatchReference(e.target.value)}
            placeholder="e.g. RUNNER-MP-04 or Waybill #"
          />
        )}

        {action === "receive" && (
          <div className="space-y-3">
            <Input
              label="Actual Received Quantity"
              type="number"
              min={0}
              step={1}
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
              error={validationError ?? undefined}
            />
            <Input
              label="Discrepancy Report / Notes (Optional)"
              value={discrepancyNote}
              onChange={(e) => setDiscrepancyNote(e.target.value)}
              placeholder="Note any damaged strips or short delivery..."
            />
          </div>
        )}

        {action === "approve" && (
          <p className="text-slate-600 leading-relaxed">
            Approving this request will reserve{" "}
            <strong>{transfer.quantityRequested} units</strong> from your
            available stock until dispatch.
          </p>
        )}
      </div>
    </Modal>
  );
}
