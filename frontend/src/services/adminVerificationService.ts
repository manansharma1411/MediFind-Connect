import { apiClient } from "./apiClient.ts";
import { signInWithPassword } from "./supabaseAuthClient.ts";
import {
  isAuthorizedAdminEmail,
  isAuthorizedAdminSession,
  mapAdminPharmacyRecord,
  normalizeVerificationStatus,
  type BackendAdminHistoryEvent,
  type BackendAdminPharmacyRecord,
} from "../lib/adminVerificationUtils.ts";
import type { ApiError, ApiResponse } from "../types/api.ts";
import type { PharmacySession } from "../types/pharmacy.ts";
import type {
  AdminPharmacyVerificationRecord,
  AdminVerificationListResponse,
  AdminVerificationStatus,
} from "../types/adminVerification.ts";
import type { PaginationMeta } from "../types/aiIntelligence.ts";

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

export async function loginAdmin(
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<PharmacySession> {
  const trimmedEmail = email.trim();
  if (!isAuthorizedAdminEmail(trimmedEmail)) {
    const err: ApiError = {
      status: 403,
      code: "UNAUTHORIZED_ADMIN_EMAIL",
      message:
        "This email address is not authorized for Super Admin Portal access.",
    };
    throw err;
  }

  const auth = await signInWithPassword(trimmedEmail, password, signal);

  try {
    await apiClient.get<ApiResponse<AdminVerificationListResponse>>(
      "/api/v1/admin/pharmacies/pending?page=1&limit=1",
      {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        signal,
      }
    );
  } catch (err) {
    const apiErr = err as Partial<ApiError>;
    if (apiErr.status === 403) {
      const forbiddenErr: ApiError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Your account does not have administrator permissions.",
      };
      throw forbiddenErr;
    }
    if (apiErr.status === 401) {
      const unauthErr: ApiError = {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Your session is invalid or expired. Please sign in again.",
      };
      throw unauthErr;
    }
    throw err;
  }

  return {
    accessToken: auth.accessToken,
    userId: auth.userId,
    email: auth.email,
    displayName: "Platform Administrator",
    role: "network_admin",
    pharmacyId: "",
    pharmacyName: "MediFind Connect Super Admin",
    isPreviewSession: false,
  };
}

interface BackendAdminListPayload {
  items?: BackendAdminPharmacyRecord[] | null;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  } | null;
}

interface BackendAdminDetailsPayload {
  pharmacy?: BackendAdminPharmacyRecord | null;
  history?: BackendAdminHistoryEvent[] | null;
}

export interface VerifyPharmacyDecisionResult {
  pharmacyId: string;
  previousStatus: AdminVerificationStatus;
  verificationStatus: AdminVerificationStatus;
  isLicensedVerified: boolean;
  rejectionReason: string | null;
}

export interface AdminAllPharmaciesQuery {
  search?: string;
  status?: AdminVerificationStatus | "ALL";
  isActive?: "all" | "true" | "false";
  sortBy?: "createdAt" | "name" | "verificationStatus";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export async function listAllAdminPharmacies(
  session: PharmacySession | null,
  params: AdminAllPharmaciesQuery = {},
  signal?: AbortSignal
): Promise<{
  items: AdminPharmacyVerificationRecord[];
  pagination: PaginationMeta;
}> {
  const validSession = assertAdminSession(session);

  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status) qs.set("status", params.status);
  if (params.isActive) qs.set("isActive", params.isActive);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 20));

  const res = await apiClient.get<ApiResponse<BackendAdminListPayload>>(
    `/api/v1/admin/pharmacies?${qs.toString()}`,
    { headers: authHeaders(validSession), signal }
  );

  const rawItems = Array.isArray(res.data?.items) ? res.data.items : [];
  const rawPag = res.data?.pagination;

  return {
    items: rawItems.map((item) => mapAdminPharmacyRecord(item)),
    pagination: {
      page: rawPag?.page ?? params.page ?? 1,
      pageSize: rawPag?.limit ?? params.limit ?? 20,
      total: rawPag?.total ?? rawItems.length,
      totalPages: rawPag?.totalPages ?? (rawItems.length > 0 ? 1 : 0),
    },
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
  const limit = params.pageSize ?? 20;
  const page = params.page ?? 1;

  try {
    if (params.status === "ALL") {
      const [pendingRes, verifiedRes, rejectedRes] = await Promise.all([
        apiClient.get<ApiResponse<BackendAdminListPayload>>(
          `/api/v1/admin/pharmacies/pending?status=PENDING&page=${page}&limit=${limit}`,
          { headers: authHeaders(validSession), signal }
        ),
        apiClient.get<ApiResponse<BackendAdminListPayload>>(
          `/api/v1/admin/pharmacies/pending?status=VERIFIED&page=1&limit=${limit}`,
          { headers: authHeaders(validSession), signal }
        ),
        apiClient.get<ApiResponse<BackendAdminListPayload>>(
          `/api/v1/admin/pharmacies/pending?status=REJECTED&page=1&limit=${limit}`,
          { headers: authHeaders(validSession), signal }
        ),
      ]);

      const pendingCount = pendingRes.data?.pagination?.total ?? null;
      const verifiedCount = verifiedRes.data?.pagination?.total ?? null;
      const rejectedCount = rejectedRes.data?.pagination?.total ?? null;
      const totalRegisteredCount =
        pendingCount !== null && verifiedCount !== null && rejectedCount !== null
          ? pendingCount + verifiedCount + rejectedCount
          : null;

      const combinedItems = [
        ...(Array.isArray(pendingRes.data?.items) ? pendingRes.data.items : []),
        ...(Array.isArray(verifiedRes.data?.items) ? verifiedRes.data.items : []),
        ...(Array.isArray(rejectedRes.data?.items) ? rejectedRes.data.items : []),
      ].map((item) => mapAdminPharmacyRecord(item));

      return {
        data: {
          summary: {
            pendingCount,
            verifiedCount,
            rejectedCount,
            totalRegisteredCount,
          },
          items: combinedItems,
        },
        source: "live",
      };
    }

    const effectiveStatus = params.status ?? "PENDING";
    const qs = new URLSearchParams({
      status: effectiveStatus,
      page: String(page),
      limit: String(limit),
    });

    const res = await apiClient.get<ApiResponse<BackendAdminListPayload>>(
      `/api/v1/admin/pharmacies/pending?${qs.toString()}`,
      { headers: authHeaders(validSession), signal }
    );

    const rawItems = Array.isArray(res.data?.items) ? res.data.items : [];
    const total = res.data?.pagination?.total ?? rawItems.length;
    const pagination: PaginationMeta | undefined = res.data?.pagination
      ? {
          page: res.data.pagination.page,
          pageSize: res.data.pagination.limit,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
        }
      : undefined;

    return {
      data: {
        summary: {
          pendingCount: effectiveStatus === "PENDING" ? total : null,
          verifiedCount: effectiveStatus === "VERIFIED" ? total : null,
          rejectedCount: effectiveStatus === "REJECTED" ? total : null,
          totalRegisteredCount: null,
        },
        items: rawItems.map((item) => mapAdminPharmacyRecord(item)),
        pagination,
      },
      source: "live",
    };
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
      ApiResponse<BackendAdminDetailsPayload | BackendAdminPharmacyRecord>
    >(
      `/api/v1/admin/pharmacies/${encodeURIComponent(pharmacyId)}/verification`,
      { headers: authHeaders(validSession), signal }
    );

    if (!res.data) {
      return { data: null, source: "live" };
    }

    const payload = res.data as BackendAdminDetailsPayload &
      BackendAdminPharmacyRecord;
    const record = payload.pharmacy
      ? mapAdminPharmacyRecord(payload.pharmacy, payload.history)
      : mapAdminPharmacyRecord(payload, payload.history);

    return { data: record, source: "live" };
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
): Promise<VerifyPharmacyDecisionResult> {
  const validSession = assertAdminSession(session);

  const res = await apiClient.patch<
    ApiResponse<{
      pharmacyId?: string;
      previousStatus?: string;
      verificationStatus?: string;
      isLicensedVerified?: boolean;
      rejectionReason?: string | null;
    }>
  >(
    `/api/v1/admin/pharmacies/${encodeURIComponent(pharmacyId)}/verification`,
    {
      action: input.decision === "VERIFIED" ? "APPROVE" : "REJECT",
      ...(input.reason ? { reason: input.reason } : {}),
    },
    { headers: authHeaders(validSession), signal }
  );

  return {
    pharmacyId: res.data?.pharmacyId ?? pharmacyId,
    previousStatus: normalizeVerificationStatus(res.data?.previousStatus),
    verificationStatus: normalizeVerificationStatus(
      res.data?.verificationStatus ?? input.decision
    ),
    isLicensedVerified: Boolean(res.data?.isLicensedVerified),
    rejectionReason: res.data?.rejectionReason ?? input.reason ?? null,
  };
}
