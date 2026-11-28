import { apiClient } from "./apiClient.ts";
import type { ApiError, ApiResponse } from "../types/api.ts";
import type { PharmacySession } from "../types/pharmacy.ts";
import type {
  AreaDemandInsight,
  DemandOverviewSummary,
  DemandPeriodGrouping,
  MedicineDemandSeries,
  UnmetDemandCategory,
  UnmetDemandSignal,
} from "../types/intelligence.ts";
import {
  PREVIEW_AREA_INSIGHTS,
  PREVIEW_DEMAND_OVERVIEW,
  PREVIEW_MEDICINE_TRENDS,
  PREVIEW_UNMET_SIGNALS,
} from "../mock-data/demandIntelligencePreview.ts";

export interface IntelligenceResult<T> {
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

export async function getDemandOverview(
  session: PharmacySession,
  params: { area?: string; dateFrom?: string; dateTo?: string } = {},
  signal?: AbortSignal
): Promise<IntelligenceResult<DemandOverviewSummary>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_DEMAND_OVERVIEW,
      source: "preview",
      notice:
        "Preview Session active. Metrics represent isolated sample search signals (never confirmed sales or patient PII).",
    };
  }

  const qs = new URLSearchParams();
  if (params.area && params.area !== "all") qs.set("area", params.area);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<DemandOverviewSummary>>(
      `/api/v1/intelligence/demand/overview${suffix}`,
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
        "Endpoint GET /api/v1/intelligence/demand/overview is awaiting Person B implementation.",
    };
  }
}

export async function getMedicineDemandTrends(
  session: PharmacySession,
  params: {
    medicineId: string;
    area?: string;
    grouping?: DemandPeriodGrouping;
    dateFrom?: string;
    dateTo?: string;
  },
  signal?: AbortSignal
): Promise<IntelligenceResult<MedicineDemandSeries>> {
  if (session.isPreviewSession) {
    return {
      data: {
        ...PREVIEW_MEDICINE_TRENDS,
        medicineId: params.medicineId || PREVIEW_MEDICINE_TRENDS.medicineId,
        area: params.area && params.area !== "all" ? params.area : "All Areas",
        grouping: params.grouping ?? "day",
      },
      source: "preview",
      notice:
        "Preview Session active. Trend series uses isolated sample search signals.",
    };
  }

  const qs = new URLSearchParams();
  if (params.area && params.area !== "all") qs.set("area", params.area);
  if (params.grouping) qs.set("grouping", params.grouping);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<MedicineDemandSeries>>(
      `/api/v1/intelligence/demand/medicines/${encodeURIComponent(
        params.medicineId
      )}${suffix}`,
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
        "Endpoint GET /api/v1/intelligence/demand/medicines/:medicineId is awaiting Person B implementation.",
    };
  }
}

export async function getUnmetDemandSignals(
  session: PharmacySession,
  params: {
    area?: string;
    category?: "all" | UnmetDemandCategory;
    dateFrom?: string;
    dateTo?: string;
  } = {},
  signal?: AbortSignal
): Promise<IntelligenceResult<UnmetDemandSignal[]>> {
  if (session.isPreviewSession) {
    return {
      data: PREVIEW_UNMET_SIGNALS,
      source: "preview",
      notice:
        "Preview Session active. Unmet signals are aggregated sample counts with zero patient PII.",
    };
  }

  const qs = new URLSearchParams();
  if (params.area && params.area !== "all") qs.set("area", params.area);
  if (params.category && params.category !== "all")
    qs.set("category", params.category);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<UnmetDemandSignal[]>>(
      `/api/v1/intelligence/demand/unmet${suffix}`,
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
        "Endpoint GET /api/v1/intelligence/demand/unmet is awaiting Person B implementation.",
    };
  }
}

export async function getAreaDemandInsights(
  session: PharmacySession,
  params: { area?: string; pincode?: string } = {},
  signal?: AbortSignal
): Promise<IntelligenceResult<AreaDemandInsight[]>> {
  if (session.isPreviewSession) {
    const filtered = PREVIEW_AREA_INSIGHTS.filter((a) => {
      if (params.area && params.area !== "all" && a.area !== params.area)
        return false;
      if (params.pincode && a.pincode !== params.pincode) return false;
      return true;
    });
    return {
      data: filtered,
      source: "preview",
      notice:
        "Preview Session active. Area insights use isolated sample aggregates.",
    };
  }

  const qs = new URLSearchParams();
  if (params.area && params.area !== "all") qs.set("area", params.area);
  if (params.pincode) qs.set("pincode", params.pincode);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<AreaDemandInsight[]>>(
      `/api/v1/intelligence/demand/areas${suffix}`,
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
        "Endpoint GET /api/v1/intelligence/demand/areas is awaiting Person B implementation.",
    };
  }
}
