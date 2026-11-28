import { apiClient } from "./apiClient.ts";
import type { ApiError, ApiResponse } from "../types/api.ts";
import type { PharmacySession } from "../types/pharmacy.ts";
import type {
  AiOverviewSummary,
  DemandForecastData,
  PaginationMeta,
  ShortageRadarItem,
  SmartRestockItem,
  SupplyDemandMatchItem,
} from "../types/aiIntelligence.ts";
import {
  extractPaginatedItems,
  mapForecastResponse,
  mapMatchItem,
  mapRestockItem,
  mapShortageItem,
  type BackendForecastResponse,
  type BackendMatchItem,
  type BackendPaginatedResponse,
  type BackendRestockItem,
  type BackendShortageItem,
} from "../lib/aiIntelligenceUtils.ts";
import {
  PREVIEW_AI_OVERVIEW,
  PREVIEW_DEMAND_FORECAST,
  PREVIEW_SHORTAGE_RADAR,
  PREVIEW_SMART_RESTOCK,
  PREVIEW_SUPPLY_DEMAND_MATCHES,
} from "../mock-data/aiIntelligencePreview.ts";

export interface AiServiceResult<T> {
  data: T | null;
  pagination?: PaginationMeta;
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

export async function getShortageRadar(
  session: PharmacySession,
  params: { area?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<AiServiceResult<ShortageRadarItem[]>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_SHORTAGE_RADAR,
      source: "preview",
      notice:
        "Preview Mode active. Showing isolated sample shortage risk signals (not live predictions).",
    };
  }

  const qs = new URLSearchParams();
  if (params.area && params.area !== "all") qs.set("area", params.area);
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<
      ApiResponse<
        BackendPaginatedResponse<BackendShortageItem> | BackendShortageItem[]
      >
    >(`/api/v1/intelligence/shortages${suffix}`, {
      headers: authHeaders(session),
      signal,
    });
    const { items, pagination } = extractPaginatedItems(res.data);
    return {
      data: items.map(mapShortageItem),
      pagination,
      source: "live",
    };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/intelligence/shortages is not yet available on the backend.",
    };
  }
}

export async function getShortageDetails(
  session: PharmacySession,
  medicineId: string,
  signal?: AbortSignal
): Promise<AiServiceResult<ShortageRadarItem>> {
  if (session.isPreviewSession) {
    const found =
      PREVIEW_SHORTAGE_RADAR.find((s) => s.medicineId === medicineId) ??
      PREVIEW_SHORTAGE_RADAR[0] ??
      null;
    return {
      data: found,
      source: "preview",
      notice: "Preview Mode active. Showing sample explainability details.",
    };
  }

  try {
    const res = await apiClient.get<ApiResponse<BackendShortageItem>>(
      `/api/v1/intelligence/shortages/${encodeURIComponent(medicineId)}`,
      { headers: authHeaders(session), signal }
    );
    return {
      data: res.data ? mapShortageItem(res.data) : null,
      source: "live",
    };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/intelligence/shortages/:medicineId is not yet available on the backend.",
    };
  }
}

export async function getSmartRestockRecommendations(
  session: PharmacySession,
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<AiServiceResult<SmartRestockItem[]>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_SMART_RESTOCK,
      source: "preview",
      notice:
        "Preview Mode active. Recommendations are read-only and based on sample anonymized search demand.",
    };
  }

  const qs = new URLSearchParams();
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<
      ApiResponse<
        BackendPaginatedResponse<BackendRestockItem> | BackendRestockItem[]
      >
    >(`/api/v1/pharmacies/me/intelligence/restock${suffix}`, {
      headers: authHeaders(session),
      signal,
    });
    const { items, pagination } = extractPaginatedItems(res.data);
    return {
      data: items.map(mapRestockItem),
      pagination,
      source: "live",
    };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/pharmacies/me/intelligence/restock is not yet available on the backend.",
    };
  }
}

export async function getSmartRestockDetails(
  session: PharmacySession,
  medicineId: string,
  signal?: AbortSignal
): Promise<AiServiceResult<SmartRestockItem>> {
  if (session.isPreviewSession) {
    const found =
      PREVIEW_SMART_RESTOCK.find((r) => r.medicineId === medicineId) ??
      PREVIEW_SMART_RESTOCK[0] ??
      null;
    return {
      data: found,
      source: "preview",
      notice: "Preview Mode active. Showing sample restock rationale.",
    };
  }

  try {
    const res = await apiClient.get<ApiResponse<BackendRestockItem>>(
      `/api/v1/pharmacies/me/intelligence/restock/${encodeURIComponent(medicineId)}`,
      { headers: authHeaders(session), signal }
    );
    return {
      data: res.data ? mapRestockItem(res.data) : null,
      source: "live",
    };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/pharmacies/me/intelligence/restock/:medicineId is not yet available on the backend.",
    };
  }
}

export async function getDemandForecast(
  session: PharmacySession,
  params: { medicineId: string; area?: string; horizonDays?: number },
  signal?: AbortSignal
): Promise<AiServiceResult<DemandForecastData>> {
  if (session.isPreviewSession) {
    return {
      data: {
        ...PREVIEW_DEMAND_FORECAST,
        medicineId: params.medicineId || PREVIEW_DEMAND_FORECAST.medicineId,
        area: params.area && params.area !== "all" ? params.area : "MP Nagar",
        horizonDays: params.horizonDays ?? 7,
      },
      source: "preview",
      notice:
        "Preview Mode active. Forecast chart uses isolated sample search observations.",
    };
  }

  const qs = new URLSearchParams();
  if (params.medicineId) qs.set("medicineId", params.medicineId);
  if (params.area && params.area !== "all") qs.set("area", params.area);
  if (params.horizonDays) qs.set("horizonPeriods", String(params.horizonDays));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<BackendForecastResponse>>(
      `/api/v1/intelligence/forecast${suffix}`,
      { headers: authHeaders(session), signal }
    );
    return {
      data: res.data ? mapForecastResponse(res.data) : null,
      source: "live",
    };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/intelligence/forecast is not yet available on the backend.",
    };
  }
}

export async function getSupplyDemandMatches(
  session: PharmacySession,
  params: { area?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
): Promise<AiServiceResult<SupplyDemandMatchItem[]>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_SUPPLY_DEMAND_MATCHES,
      source: "preview",
      notice:
        "Preview Mode active. Showing sample inter-pharmacy match suggestions (never auto-executes transfers).",
    };
  }

  const qs = new URLSearchParams();
  if (params.area && params.area !== "all") qs.set("area", params.area);
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.pageSize === "number") {
    qs.set("pageSize", String(params.pageSize));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<
      ApiResponse<
        BackendPaginatedResponse<BackendMatchItem> | BackendMatchItem[]
      >
    >(`/api/v1/intelligence/matches${suffix}`, {
      headers: authHeaders(session),
      signal,
    });
    const { items, pagination } = extractPaginatedItems(res.data);
    return {
      data: items.map(mapMatchItem),
      pagination,
      source: "live",
    };
  } catch (err) {
    if (isCancelled(err) || !isEndpointUnavailable(err)) throw err;
    return {
      data: null,
      source: "unavailable",
      notice:
        "Endpoint GET /api/v1/intelligence/matches is not yet available on the backend.",
    };
  }
}

export async function getAiOverview(
  session: PharmacySession,
  signal?: AbortSignal
): Promise<AiServiceResult<AiOverviewSummary>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_AI_OVERVIEW,
      source: "preview",
      notice:
        "Preview Mode active. AI Intelligence summary uses isolated sample data.",
    };
  }

  const [shortagesRes, restockRes, matchesRes] = await Promise.all([
    getShortageRadar(session, {}, signal),
    getSmartRestockRecommendations(session, {}, signal),
    getSupplyDemandMatches(session, {}, signal),
  ]);

  const anyLive =
    shortagesRes.source === "live" ||
    restockRes.source === "live" ||
    matchesRes.source === "live";

  if (!anyLive) {
    return {
      data: null,
      source: "unavailable",
      notice:
        "Phase 9 AI Intelligence endpoints (/api/v1/intelligence/shortages, /api/v1/pharmacies/me/intelligence/restock, /api/v1/intelligence/forecast, /api/v1/intelligence/matches) are awaiting Person B implementation.",
    };
  }

  const shortages = shortagesRes.data ?? [];
  const restocks = restockRes.data ?? [];
  const matches = matchesRes.data ?? [];

  const highRiskCount =
    shortagesRes.source === "live"
      ? shortages.filter((s) => s.riskCategory === "HIGH").length
      : null;

  const latestFreshness =
    shortages.find((s) => s.explainability?.dataFreshnessAt)?.explainability
      ?.dataFreshnessAt ??
    restocks.find((r) => r.generatedAt)?.generatedAt ??
    null;

  return {
    data: {
      highRiskMedicineCount: highRiskCount,
      restockRecommendationCount:
        restockRes.source === "live"
          ? restockRes.pagination?.total ?? restocks.length
          : null,
      forecastHighlights: [],
      supplyDemandOpportunityCount:
        matchesRes.source === "live"
          ? matchesRes.pagination?.total ?? matches.length
          : null,
      latestUpdates: [],
      dataFreshnessAt: latestFreshness,
      sampleSufficient: shortages.some((s) => s.sampleSufficient),
      insufficiencyReason:
        shortages.length === 0 && restocks.length === 0 && matches.length === 0
          ? "Insufficient verified backend data to populate AI highlights."
          : null,
    },
    source: "live",
  };
}
