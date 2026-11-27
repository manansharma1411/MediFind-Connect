import { apiClient } from "./apiClient.ts";
import type { ApiResponse, ApiError } from "../types/api.ts";
import type {
  Medicine,
  MedicineAvailability,
  MedicineSearchResult,
  PaginatedData,
  PublicPharmacy,
} from "../types/medicine.ts";
import {
  DEMO_MEDICINES,
  DEMO_PHARMACIES,
  getDemoAvailabilityForMedicine,
} from "../mock-data/discoveryDemo.ts";
import { calculateDistanceKm } from "../lib/medicineUtils.ts";

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

function isCancelledError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  return (err as Partial<ApiError>).code === "REQUEST_CANCELLED";
}

export interface SearchMedicinesParams {
  q?: string;
  form?: string;
  page?: number;
  limit?: number;
}

/**
 * Queries GET /api/v1/medicines.
 * Falls back to isolated demo data ONLY when the planned endpoint is not yet live.
 */
export async function searchMedicines(
  params: SearchMedicinesParams,
  signal?: AbortSignal
): Promise<MedicineSearchResult> {
  const { q = "", form, page = 1, limit = 10 } = params;
  const searchParams = new URLSearchParams();
  if (q.trim()) searchParams.set("q", q.trim());
  if (form && form !== "all") searchParams.set("form", form);
  searchParams.set("page", String(page));
  searchParams.set("limit", String(limit));

  try {
    const res = await apiClient.get<
      ApiResponse<
        PaginatedData<Medicine> & {
          didYouMean?: string | null;
          suggestions?: string[];
        }
      >
    >(`/api/v1/medicines?${searchParams.toString()}`, { signal });

    return {
      items: res.data.items,
      pagination: res.data.pagination,
      didYouMean: res.data.didYouMean ?? null,
      suggestions: res.data.suggestions ?? [],
      source: "live",
    };
  } catch (err) {
    if (isCancelledError(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }

    const queryLower = q.trim().toLowerCase();
    const matched = DEMO_MEDICINES.filter((med) => {
      const matchesForm = !form || form === "all" || med.form === form;
      if (!matchesForm) return false;
      if (!queryLower) return true;
      return (
        med.name.toLowerCase().includes(queryLower) ||
        med.genericName.toLowerCase().includes(queryLower) ||
        (med.primaryBrand?.toLowerCase().includes(queryLower) ?? false) ||
        med.brands.some((b) => b.brandName.toLowerCase().includes(queryLower))
      );
    });

    const start = (page - 1) * limit;
    const paged = matched.slice(start, start + limit);

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total: matched.length,
        totalPages: Math.max(1, Math.ceil(matched.length / limit)),
      },
      didYouMean: null,
      suggestions: matched.slice(0, 5).map((m) => m.primaryBrand ?? m.name),
      source: "demo",
      notice:
        "Backend endpoint GET /api/v1/medicines is currently planned. Showing isolated demo data.",
    };
  }
}

export async function getMedicineById(
  id: string,
  signal?: AbortSignal
): Promise<{ medicine: Medicine | null; source: "live" | "demo" }> {
  try {
    const res = await apiClient.get<ApiResponse<Medicine>>(
      `/api/v1/medicines/${encodeURIComponent(id)}`,
      { signal }
    );
    return { medicine: res.data, source: "live" };
  } catch (err) {
    if (isCancelledError(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    const found = DEMO_MEDICINES.find((m) => m.id === id) ?? null;
    return { medicine: found, source: "demo" };
  }
}

export interface MedicineAvailabilityPayload {
  medicine?: Medicine | null;
  pharmacies: MedicineAvailability[];
}

export interface MedicinePricesPayload {
  medicine?: Medicine | null;
  comparisons: MedicineAvailability[];
}

export async function getMedicineAvailability(
  id: string,
  coords?: { lat: number; lng: number } | null,
  radiusKm = 10,
  signal?: AbortSignal
): Promise<{
  medicine: Medicine | null;
  pharmacies: MedicineAvailability[];
  source: "live" | "demo";
}> {
  const qs = new URLSearchParams();
  if (coords) {
    qs.set("lat", String(coords.lat));
    qs.set("lng", String(coords.lng));
    qs.set("radiusKm", String(radiusKm));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<MedicineAvailabilityPayload>>(
      `/api/v1/medicines/${encodeURIComponent(id)}/availability${suffix}`,
      { signal }
    );
    return {
      medicine: res.data.medicine ?? null,
      pharmacies: res.data.pharmacies,
      source: "live",
    };
  } catch (err) {
    if (isCancelledError(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    const found = DEMO_MEDICINES.find((m) => m.id === id) ?? null;
    return {
      medicine: found,
      pharmacies: getDemoAvailabilityForMedicine(id, coords),
      source: "demo",
    };
  }
}

export async function getMedicinePrices(
  id: string,
  coords?: { lat: number; lng: number } | null,
  signal?: AbortSignal
): Promise<{
  medicine: Medicine | null;
  comparisons: MedicineAvailability[];
  source: "live" | "demo";
}> {
  const qs = new URLSearchParams();
  if (coords) {
    qs.set("lat", String(coords.lat));
    qs.set("lng", String(coords.lng));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const res = await apiClient.get<ApiResponse<MedicinePricesPayload>>(
      `/api/v1/medicines/${encodeURIComponent(id)}/prices${suffix}`,
      { signal }
    );
    return {
      medicine: res.data.medicine ?? null,
      comparisons: res.data.comparisons,
      source: "live",
    };
  } catch (err) {
    if (isCancelledError(err) || !isPlannedEndpointUnavailable(err)) {
      throw err;
    }
    const found = DEMO_MEDICINES.find((m) => m.id === id) ?? null;
    return {
      medicine: found,
      comparisons: getDemoAvailabilityForMedicine(id, coords),
      source: "demo",
    };
  }
}

/**
 * Public GET /api/v1/pharmacies is marked [PLANNED] in docs/api-contracts/openapi.yaml
 * (and currently rejects unauthenticated requests with 401 on the deployed backend).
 * Flip to true once Person B deploys the public unauthenticated directory endpoint.
 */
const PUBLIC_PHARMACY_DIRECTORY_LIVE = false;

export async function listPublicPharmacies(
  params: {
    area?: string;
    is24x7?: boolean;
    coords?: { lat: number; lng: number } | null;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal
): Promise<{
  items: PublicPharmacy[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  source: "live" | "demo";
}> {
  const { area, is24x7, coords, page = 1, limit = 20 } = params;
  const qs = new URLSearchParams();
  if (area && area !== "all") qs.set("area", area);
  if (typeof is24x7 === "boolean") qs.set("is24x7", String(is24x7));
  qs.set("page", String(page));
  qs.set("limit", String(limit));

  if (PUBLIC_PHARMACY_DIRECTORY_LIVE) {
    try {
      const res = await apiClient.get<ApiResponse<PaginatedData<PublicPharmacy>>>(
        `/api/v1/pharmacies?${qs.toString()}`,
        { signal }
      );
      return {
        items: res.data.items,
        pagination: res.data.pagination,
        source: "live",
      };
    } catch (err) {
      if (isCancelledError(err) || !isPlannedEndpointUnavailable(err)) {
        throw err;
      }
    }
  } else if (signal?.aborted) {
    const abortErr: ApiError = {
      status: 0,
      code: "REQUEST_CANCELLED",
      message: "Request was cancelled.",
    };
    throw abortErr;
  }

  const filtered = DEMO_PHARMACIES.filter((p) => {
    if (area && area !== "all" && p.location.area !== area) return false;
    if (is24x7 && !p.is24x7) return false;
    return true;
  }).map((p) => ({
    ...p,
    location: {
      ...p.location,
      distanceKm: coords
        ? calculateDistanceKm(
            coords.lat,
            coords.lng,
            p.location.lat,
            p.location.lng
          )
        : undefined,
    },
  }));

  return {
    items: filtered,
    pagination: {
      page: 1,
      limit,
      total: filtered.length,
      totalPages: 1,
    },
    source: "demo",
  };
}
