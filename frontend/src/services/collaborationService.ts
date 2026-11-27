import { apiClient } from "./apiClient.ts";
import type { ApiError, ApiResponse } from "../types/api.ts";
import type { PharmacySession } from "../types/pharmacy.ts";
import type {
  TransferHistoryEntry,
  TransferRequest,
  TransferStatus,
} from "../types/collaboration.ts";
import {
  PREVIEW_TRANSFER_HISTORY,
  PREVIEW_TRANSFER_REQUESTS,
} from "../mock-data/collaborationPreview.ts";

export interface CollaborationResult<T> {
  data: T | null;
  source: "live" | "preview" | "unavailable";
  notice?: string;
}

function isEndpointUnavailable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const apiErr = err as Partial<ApiError>;
  return (
    apiErr.status === 404 ||
    apiErr.status === 501 ||
    apiErr.code === "API_NOT_CONFIGURED" ||
    apiErr.code === "NETWORK_ERROR"
  );
}

function isCancelled(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as Partial<ApiError>).code === "REQUEST_CANCELLED"
  );
}

function authHeaders(session: PharmacySession): HeadersInit {
  return {
    Authorization: `Bearer ${session.accessToken}`,
  };
}

function previewMutationError(actionLabel: string): ApiError {
  return {
    status: 501,
    code: "PREVIEW_READ_ONLY",
    message: `Preview Session is read-only. Connect Person B's collaboration endpoints to ${actionLabel}.`,
  };
}

export async function listTransfers(
  session: PharmacySession,
  params: {
    direction?: "incoming" | "outgoing" | "all";
    status?: TransferStatus;
  } = {},
  signal?: AbortSignal
): Promise<CollaborationResult<TransferRequest[]>> {
  const { direction = "all", status } = params;

  if (session.isPreviewSession) {
    const filtered = PREVIEW_TRANSFER_REQUESTS.filter((tr) => {
      if (direction === "incoming") {
        return tr.fulfillingPharmacyId === session.pharmacyId;
      }
      if (direction === "outgoing") {
        return tr.requestingPharmacyId === session.pharmacyId;
      }
      return true;
    }).filter((tr) => !status || tr.status === status);

    return {
      data: filtered,
      source: "preview",
      notice:
        "Preview Session active. Showing isolated sample transfer records.",
    };
  }

  const qs = new URLSearchParams();
  qs.set("direction", direction);
  if (status) qs.set("status", status);

  try {
    const res = await apiClient.get<ApiResponse<TransferRequest[]>>(
      `/api/v1/transfers?${qs.toString()}`,
      { headers: authHeaders(session), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) {
      throw err;
    }
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/transfers is awaiting Person B implementation.",
    };
  }
}

export async function getTransferDetails(
  session: PharmacySession,
  transferId: string,
  signal?: AbortSignal
): Promise<
  CollaborationResult<{
    transfer: TransferRequest | null;
    history: TransferHistoryEntry[];
  }>
> {
  if (session.isPreviewSession) {
    const transfer =
      PREVIEW_TRANSFER_REQUESTS.find((t) => t.id === transferId) ?? null;
    const history = PREVIEW_TRANSFER_HISTORY[transferId] ?? [];
    return {
      data: { transfer, history },
      source: "preview",
      notice: "Preview Session active. Transfer timeline uses sample data.",
    };
  }

  try {
    const [listRes, histRes] = await Promise.all([
      apiClient.get<ApiResponse<TransferRequest[]>>(
        `/api/v1/transfers?direction=all`,
        { headers: authHeaders(session), signal }
      ),
      apiClient.get<ApiResponse<TransferHistoryEntry[]>>(
        `/api/v1/transfers/${encodeURIComponent(transferId)}/history`,
        { headers: authHeaders(session), signal }
      ),
    ]);
    const transfer =
      listRes.data.find((t) => t.id === transferId) ?? null;
    return {
      data: { transfer, history: histRes.data },
      source: "live",
    };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) {
      throw err;
    }
    return {
      data: null,
      source: "unavailable",
      notice:
        "Collaboration transfer detail/history endpoints are awaiting Person B implementation.",
    };
  }
}

export interface CreateTransferPayload {
  fulfillingPharmacyId: string;
  medicineId: string;
  quantityRequested: number;
  notes: string;
}

export async function createTransferRequest(
  session: PharmacySession,
  payload: CreateTransferPayload,
  signal?: AbortSignal
): Promise<TransferRequest> {
  if (session.isPreviewSession) {
    throw previewMutationError("create transfer requests");
  }

  const res = await apiClient.post<ApiResponse<TransferRequest>>(
    "/api/v1/transfers",
    payload,
    { headers: authHeaders(session), signal }
  );
  return res.data;
}

export async function approveTransfer(
  session: PharmacySession,
  transferId: string,
  quantityApproved?: number,
  signal?: AbortSignal
): Promise<TransferRequest> {
  if (session.isPreviewSession) {
    throw previewMutationError("approve transfer requests");
  }

  const res = await apiClient.patch<ApiResponse<TransferRequest>>(
    `/api/v1/transfers/${encodeURIComponent(transferId)}/approve`,
    quantityApproved ? { quantityApproved } : undefined,
    { headers: authHeaders(session), signal }
  );
  return res.data;
}

export async function rejectTransfer(
  session: PharmacySession,
  transferId: string,
  reason: string,
  signal?: AbortSignal
): Promise<TransferRequest> {
  if (session.isPreviewSession) {
    throw previewMutationError("reject transfer requests");
  }

  const res = await apiClient.patch<ApiResponse<TransferRequest>>(
    `/api/v1/transfers/${encodeURIComponent(transferId)}/reject`,
    { reason },
    { headers: authHeaders(session), signal }
  );
  return res.data;
}

export async function dispatchTransfer(
  session: PharmacySession,
  transferId: string,
  dispatchReference?: string,
  signal?: AbortSignal
): Promise<TransferRequest> {
  if (session.isPreviewSession) {
    throw previewMutationError("dispatch transfers");
  }

  const res = await apiClient.patch<ApiResponse<TransferRequest>>(
    `/api/v1/transfers/${encodeURIComponent(transferId)}/dispatch`,
    dispatchReference ? { dispatchReference } : undefined,
    { headers: authHeaders(session), signal }
  );
  return res.data;
}

export async function receiveTransfer(
  session: PharmacySession,
  transferId: string,
  payload: { receivedQuantity?: number; discrepancyNote?: string },
  signal?: AbortSignal
): Promise<TransferRequest> {
  if (session.isPreviewSession) {
    throw previewMutationError("confirm transfer receipt");
  }

  const res = await apiClient.patch<ApiResponse<TransferRequest>>(
    `/api/v1/transfers/${encodeURIComponent(transferId)}/receive`,
    payload,
    { headers: authHeaders(session), signal }
  );
  return res.data;
}

export async function cancelTransfer(
  session: PharmacySession,
  transferId: string,
  reason: string,
  signal?: AbortSignal
): Promise<TransferRequest> {
  if (session.isPreviewSession) {
    throw previewMutationError("cancel transfers");
  }

  const res = await apiClient.patch<ApiResponse<TransferRequest>>(
    `/api/v1/transfers/${encodeURIComponent(transferId)}/cancel`,
    { reason },
    { headers: authHeaders(session), signal }
  );
  return res.data;
}
