import { apiClient } from "./apiClient.ts";
import { isAuthorizedAdminSession } from "../lib/adminVerificationUtils.ts";
import type { ApiError, ApiResponse } from "../types/api.ts";
import type { PharmacySession } from "../types/pharmacy.ts";
import type {
  AdminPharmacyVerificationRecord,
  AdminVerificationListResponse,
  AdminVerificationStatus,
} from "../types/adminVerification.ts";

export interface AdminServiceResult<T> {
  data: T | null;
  source: "live" | "unavailable";
  notice?: string;
}

function assertAdminSession(session: PharmacySession | null): PharmacySession {
  if (!session) {
    const err: ApiError = {
      status: 401,
      code: "UNAUTHORIZED",
      message: "Administrator authentication is required.",
    };
    throw err;
  }
  if (!isAuthorizedAdminSession(session)) {
    const err: ApiError = {
      status: 403,
      code: "FORBIDDEN",
      message:
        "Administrator access (network_admin) is required. Pharmacy owners and standard users cannot access verification controls.",
    };
    throw err;
  }
  return session;
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

export async function listAdminPharmacies(
  session: PharmacySession | null,
  params: {
    status?: AdminVerificationStatus | "ALL";
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
  signal?: AbortSignal
): Promise<AdminServiceResult<AdminVerificationListResponse>> {
  const validSession = assertAdminSession(session);

  const qs = new URLSearchParams();
  if (params.status && params.status !== "ALL") qs.set("status", params.status);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<AdminVerificationListResponse>>(
      `/api/v1/admin/pharmacies/pending${suffix}`,
      { headers: authHeaders(validSession), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Admin verification endpoints (/api/v1/admin/pharmacies/pending) are awaiting Person B implementation.",
    };
  }
}

export async function getAdminPharmacyVerificationDetails(
  session: PharmacySession | null,
  pharmacyId: string,
  signal?: AbortSignal
): Promise<AdminServiceResult<AdminPharmacyVerificationRecord>> {
  const validSession = assertAdminSession(session);

  try {
    const res = await apiClient.get<
      ApiResponse<AdminPharmacyVerificationRecord>
    >(
      `/api/v1/admin/pharmacies/${encodeURIComponent(pharmacyId)}/verification`,
      { headers: authHeaders(validSession), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/admin/pharmacies/:id/verification is awaiting Person B implementation.",
    };
  }
}

export async function submitPharmacyVerificationDecision(
  session: PharmacySession | null,
  pharmacyId: string,
  input: {
    decision: "VERIFIED" | "REJECTED";
    reason?: string;
  },
  signal?: AbortSignal
): Promise<AdminPharmacyVerificationRecord> {
  const validSession = assertAdminSession(session);

  const res = await apiClient.patch<
    ApiResponse<AdminPharmacyVerificationRecord>
  >(
    `/api/v1/admin/pharmacies/${encodeURIComponent(pharmacyId)}/verification`,
    input,
    { headers: authHeaders(validSession), signal }
  );

  return res.data;
}
