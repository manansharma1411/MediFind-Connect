import React from "react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { TransferStatus } from "@/types/collaboration";

const STATUS_STYLE: Record<
  TransferStatus,
  { label: string; variant: BadgeVariant }
> = {
  REQUESTED: { label: "Requested", variant: "neutral" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "error" },
  DISPATCHED: { label: "Dispatched", variant: "info" },
  RECEIVED: { label: "Received", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
};

export function TransferStatusBadge({
  status,
  className,
}: {
  status: TransferStatus;
  className?: string;
}) {
  const cfg = STATUS_STYLE[status];
  return (
    <Badge variant={cfg.variant} dot className={className}>
      {cfg.label}
    </Badge>
  );
}
