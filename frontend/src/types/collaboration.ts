import type { StockStatus } from "./medicine.ts";

export type TransferStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "DISPATCHED"
  | "RECEIVED"
  | "CANCELLED";

export type TransferActorRole =
  | "requesting_pharmacy"
  | "fulfilling_pharmacy"
  | "network_admin";

export type TransferAction =
  | "approve"
  | "reject"
  | "dispatch"
  | "receive"
  | "cancel";

export const PERMITTED_TRANSFER_TRANSITIONS: Record<
  TransferStatus,
  ReadonlyArray<{
    nextStatus: TransferStatus;
    allowedActors: ReadonlyArray<TransferActorRole>;
    stockEffect: string;
  }>
> = {
  REQUESTED: [
    {
      nextStatus: "APPROVED",
      allowedActors: ["fulfilling_pharmacy"],
      stockEffect:
        "Moves quantityApproved from quantityAvailable to quantityReserved at fulfilling pharmacy.",
    },
    {
      nextStatus: "REJECTED",
      allowedActors: ["fulfilling_pharmacy"],
      stockEffect: "None (Terminal state).",
    },
    {
      nextStatus: "CANCELLED",
      allowedActors: ["requesting_pharmacy", "network_admin"],
      stockEffect: "None; request withdrawn before approval (Terminal state).",
    },
  ],
  APPROVED: [
    {
      nextStatus: "DISPATCHED",
      allowedActors: ["fulfilling_pharmacy"],
      stockEffect:
        "Deducts quantityApproved from quantityReserved at fulfilling pharmacy.",
    },
    {
      nextStatus: "CANCELLED",
      allowedActors: [
        "requesting_pharmacy",
        "fulfilling_pharmacy",
        "network_admin",
      ],
      stockEffect:
        "Releases quantityApproved from quantityReserved back to quantityAvailable at fulfilling pharmacy (Terminal state).",
    },
  ],
  DISPATCHED: [
    {
      nextStatus: "RECEIVED",
      allowedActors: ["requesting_pharmacy"],
      stockEffect:
        "Credits quantityApproved to quantityAvailable at requesting pharmacy (Terminal state).",
    },
    {
      nextStatus: "CANCELLED",
      allowedActors: ["fulfilling_pharmacy", "network_admin"],
      stockEffect:
        "In-transit cancellation (damaged/recalled); requires mandatory audit reason (Terminal state).",
    },
  ],
  REJECTED: [],
  RECEIVED: [],
  CANCELLED: [],
};

export interface TransferRequest {
  id: string;
  transferCode: string;
  requestingPharmacyId: string;
  requestingPharmacyName: string;
  fulfillingPharmacyId: string;
  fulfillingPharmacyName: string;
  medicineId: string;
  medicineName: string;
  quantityRequested: number;
  quantityApproved: number | null;
  status: TransferStatus;
  unitTransferPrice: number;
  totalTransferValue: number;
  notes: string | null;
  dispatchReference?: string | null;
  dispatchedAt?: string | null;
  receivedQuantity?: number | null;
  discrepancyNote?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransferHistoryEntry {
  id: number;
  transferId: string;
  previousStatus: TransferStatus | null;
  newStatus: TransferStatus;
  actorId: string | null;
  comment: string | null;
  createdAt: string;
}

export interface CollaborationStockCandidate {
  pharmacyId: string;
  pharmacyName: string;
  area: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  form: string;
  distanceKm: number | null;
  status: StockStatus;
  sellingPrice: number;
  lastUpdatedAt: string;
}
