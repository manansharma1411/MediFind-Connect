import { apiClient } from "./apiClient.ts";
import type { ApiError, ApiResponse } from "../types/api.ts";
import type {
  PharmacyAlertItem,
  PharmacyDashboardData,
  PharmacyInventoryItem,
  PharmacyOperatingHours,
  PharmacyProfileData,
  PharmacySession,
  StockAdjustmentReason,
  StockMovementRecord,
} from "../types/pharmacy.ts";
import {
  PREVIEW_ALERTS,
  PREVIEW_DASHBOARD_DATA,
  PREVIEW_INVENTORY_ITEMS,
  PREVIEW_MOVEMENTS,
  PREVIEW_PHARMACY_PROFILE,
} from "../mock-data/pharmacyPortalDemo.ts";

export interface ServiceResult<T> {
  data: T | null;
  source: "live" | "preview" | "unavailable";
  notice?: string;
}

function isPlannedEndpointUnavailable(err: unknown): boolean {
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

export async function loginPharmacy(
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<PharmacySession> {
  const res = await apiClient.post<ApiResponse<PharmacySession>>(
    "/api/v1/auth/login",
    { email, password },
    { signal }
  );
  return res.data;
}

export interface RegisterPharmacyPayload {
  name: string;
  licenseNumber: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  is24x7: boolean;
}

export async function registerPharmacy(
  payload: RegisterPharmacyPayload,
  signal?: AbortSignal
): Promise<{ pharmacyId: string; status: string }> {
  const res = await apiClient.post<
    ApiResponse<{ pharmacyId: string; status: string }>
  >("/api/v1/pharmacies/register", payload, { signal });
  return res.data;
}

export async function getPharmacyDashboard(
  session: PharmacySession,
  signal?: AbortSignal
): Promise<ServiceResult<PharmacyDashboardData>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_DASHBOARD_DATA,
      source: "preview",
      notice:
        "Preview Session active. Metrics below are isolated sample data while backend dashboard endpoints are planned.",
    };
  }

  try {
    const res = await apiClient.get<ApiResponse<PharmacyDashboardData>>(
      `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}/dashboard`,
      { headers: authHeaders(session), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/pharmacies/:id/dashboard is not yet available on the backend.",
    };
  }
}

export async function getPharmacyInventory(
  session: PharmacySession,
  signal?: AbortSignal
): Promise<ServiceResult<PharmacyInventoryItem[]>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_INVENTORY_ITEMS,
      source: "preview",
      notice:
        "Preview Session active. Inventory rows are isolated sample data.",
    };
  }

  try {
    const res = await apiClient.get<ApiResponse<PharmacyInventoryItem[]>>(
      `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}/inventory`,
      { headers: authHeaders(session), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/pharmacies/:id/inventory is not yet available on the backend.",
    };
  }
}

export interface AdjustInventoryPayload {
  medicineId: string;
  deltaQuantity: number;
  reason: StockAdjustmentReason;
  batchNumber?: string;
  expiryDate?: string;
  sellingPrice?: number;
  reorderThreshold?: number;
  notes?: string;
}

export async function patchPharmacyInventory(
  session: PharmacySession,
  payload: AdjustInventoryPayload,
  signal?: AbortSignal
): Promise<{ updated: boolean; auditLogId?: string; message?: string }> {
  if (session.isPreviewSession) {
    const err: ApiError = {
      status: 501,
      code: "PREVIEW_READ_ONLY",
      message:
        "Preview Session is read-only. Connect Person B's PATCH /api/v1/pharmacies/:id/inventory endpoint to persist stock mutations.",
    };
    throw err;
  }

  const res = await apiClient.patch<
    ApiResponse<{ auditLogId?: string; message?: string }>
  >(
    `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}/inventory`,
    payload,
    { headers: authHeaders(session), signal }
  );
  return {
    updated: res.success,
    auditLogId: res.data?.auditLogId,
    message: res.message,
  };
}

export async function getStockHistory(
  session: PharmacySession,
  signal?: AbortSignal
): Promise<ServiceResult<StockMovementRecord[]>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_MOVEMENTS,
      source: "preview",
      notice: "Preview Session active. Showing sample stock movement history.",
    };
  }

  try {
    const res = await apiClient.get<ApiResponse<StockMovementRecord[]>>(
      `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}/inventory/history`,
      { headers: authHeaders(session), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/pharmacies/:id/inventory/history is awaiting Person B implementation.",
    };
  }
}

export async function getPharmacyAlerts(
  session: PharmacySession,
  signal?: AbortSignal
): Promise<ServiceResult<PharmacyAlertItem[]>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_ALERTS,
      source: "preview",
      notice: "Preview Session active. Showing sample inventory alerts.",
    };
  }

  try {
    const res = await apiClient.get<ApiResponse<PharmacyAlertItem[]>>(
      `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}/alerts`,
      { headers: authHeaders(session), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/pharmacies/:id/alerts is awaiting Person B implementation.",
    };
  }
}

export async function getPharmacyProfile(
  session: PharmacySession,
  signal?: AbortSignal
): Promise<ServiceResult<PharmacyProfileData>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_PHARMACY_PROFILE,
      source: "preview",
      notice:
        "Preview Session active. Profile and license fields shown are isolated sample values.",
    };
  }

  try {
    const res = await apiClient.get<ApiResponse<PharmacyProfileData>>(
      `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}`,
      { headers: authHeaders(session), signal }
    );
    return { data: res.data, source: "live" };
  } catch (err) {
    if (isCancelled(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/pharmacies/:id is awaiting Person B implementation.",
    };
  }
}

export async function updatePharmacyProfile(
  session: PharmacySession,
  payload: Partial<
    Pick<
      PharmacyProfileData,
      "name" | "phone" | "address" | "area" | "city" | "state" | "pincode"
    >
  >,
  signal?: AbortSignal
): Promise<PharmacyProfileData> {
  if (session.isPreviewSession) {
    const err: ApiError = {
      status: 501,
      code: "PREVIEW_READ_ONLY",
      message:
        "Preview Session is read-only. Profile updates require Person B's PATCH /api/v1/pharmacies/:id endpoint.",
    };
    throw err;
  }

  const res = await apiClient.patch<ApiResponse<PharmacyProfileData>>(
    `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}`,
    payload,
    { headers: authHeaders(session), signal }
  );
  return res.data;
}

export async function updateOperatingHours(
  session: PharmacySession,
  hours: PharmacyOperatingHours,
  signal?: AbortSignal
): Promise<PharmacyOperatingHours> {
  if (session.isPreviewSession) {
    const err: ApiError = {
      status: 501,
      code: "PREVIEW_READ_ONLY",
      message:
        "Preview Session is read-only. Operating hours updates require Person B's PATCH /api/v1/pharmacies/:id/hours endpoint.",
    };
    throw err;
  }

  const res = await apiClient.patch<ApiResponse<PharmacyOperatingHours>>(
    `/api/v1/pharmacies/${encodeURIComponent(session.pharmacyId)}/hours`,
    hours,
    { headers: authHeaders(session), signal }
  );
  return res.data;
}
