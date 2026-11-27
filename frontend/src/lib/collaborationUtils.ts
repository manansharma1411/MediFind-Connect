import {
  PERMITTED_TRANSFER_TRANSITIONS,
  type TransferAction,
  type TransferActorRole,
  type TransferRequest,
  type TransferStatus,
} from "../types/collaboration.ts";
import type { PharmacyUserRole } from "../types/pharmacy.ts";

/**
 * Resolves the actor's role relative to a specific transfer request.
 */
export function resolveTransferActorRole(
  transfer: Pick<
    TransferRequest,
    "requestingPharmacyId" | "fulfillingPharmacyId"
  >,
  currentPharmacyId: string,
  userRole: PharmacyUserRole
): TransferActorRole | null {
  if (userRole === "network_admin") return "network_admin";
  if (transfer.fulfillingPharmacyId === currentPharmacyId) {
    return "fulfilling_pharmacy";
  }
  if (transfer.requestingPharmacyId === currentPharmacyId) {
    return "requesting_pharmacy";
  }
  return null;
}

const STATUS_TO_ACTION: Partial<Record<TransferStatus, TransferAction>> = {
  APPROVED: "approve",
  REJECTED: "reject",
  DISPATCHED: "dispatch",
  RECEIVED: "receive",
  CANCELLED: "cancel",
};

/**
 * Returns only the actions permitted by the canonical finite state machine
 * for the given status and actor role.
 */
export function getPermittedActionsForTransfer(
  status: TransferStatus,
  actorRole: TransferActorRole | null
): TransferAction[] {
  if (!actorRole) return [];
  const transitions = PERMITTED_TRANSFER_TRANSITIONS[status] ?? [];
  const actions: TransferAction[] = [];

  for (const t of transitions) {
    if (t.allowedActors.includes(actorRole)) {
      const action = STATUS_TO_ACTION[t.nextStatus];
      if (action) actions.push(action);
    }
  }
  return actions;
}

export interface CreateTransferFormInput {
  fulfillingPharmacyId: string;
  medicineId: string;
  quantityRequested: string;
  notes: string;
}

export type CreateTransferFormErrors = Partial<
  Record<keyof CreateTransferFormInput, string>
>;

export function validateCreateTransferForm(
  input: CreateTransferFormInput,
  requestingPharmacyId?: string
): CreateTransferFormErrors {
  const errors: CreateTransferFormErrors = {};

  if (!input.fulfillingPharmacyId.trim()) {
    errors.fulfillingPharmacyId = "Please select a supplying pharmacy.";
  } else if (
    requestingPharmacyId &&
    input.fulfillingPharmacyId.trim() === requestingPharmacyId
  ) {
    errors.fulfillingPharmacyId =
      "Cannot request a transfer from your own pharmacy.";
  }

  if (!input.medicineId.trim()) {
    errors.medicineId = "Please select a medicine.";
  }

  const qty = Number(input.quantityRequested);
  if (
    !input.quantityRequested.trim() ||
    !Number.isInteger(qty) ||
    qty <= 0
  ) {
    errors.quantityRequested =
      "Requested quantity must be a positive whole number.";
  }

  if (input.notes.trim().length < 5) {
    errors.notes = "Please provide a brief reason (at least 5 characters).";
  }

  return errors;
}

export function validateMandatoryReason(reason: string): string | null {
  if (reason.trim().length < 5) {
    return "Please provide a reason of at least 5 characters.";
  }
  return null;
}

export interface TransferHistoryFilter {
  query: string;
  status: "all" | TransferStatus;
  dateFrom: string;
  dateTo: string;
}

export function filterTransfers(
  items: TransferRequest[],
  filters: TransferHistoryFilter
): TransferRequest[] {
  const q = filters.query.trim().toLowerCase();
  const fromMs = filters.dateFrom ? Date.parse(filters.dateFrom) : null;
  const toMs = filters.dateTo
    ? Date.parse(filters.dateTo) + 24 * 60 * 60 * 1000 - 1
    : null;

  return items.filter((item) => {
    const matchesQuery =
      !q ||
      item.transferCode.toLowerCase().includes(q) ||
      item.medicineName.toLowerCase().includes(q) ||
      item.requestingPharmacyName.toLowerCase().includes(q) ||
      item.fulfillingPharmacyName.toLowerCase().includes(q);

    if (!matchesQuery) return false;

    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    const createdMs = Date.parse(item.createdAt);
    if (fromMs !== null && !Number.isNaN(fromMs) && createdMs < fromMs) {
      return false;
    }
    if (toMs !== null && !Number.isNaN(toMs) && createdMs > toMs) {
      return false;
    }

    return true;
  });
}
