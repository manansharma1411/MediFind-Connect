import { apiClient } from "@/services/apiClient";
import type { ApiResponse, HealthCheckResponse } from "@/types/api";

/**
 * Health-check integration with Person B's backend (/api/health).
 * Supports both enveloped ({ success, data: { status } }) and flat responses.
 */
export async function checkBackendHealth(
  signal?: AbortSignal
): Promise<HealthCheckResponse> {
  if (!apiClient.isConfigured()) {
    return {
      status: "unreachable",
      service: "backend",
    };
  }

  try {
    const response = await apiClient.get<
      ApiResponse<HealthCheckResponse> | HealthCheckResponse
    >("/api/health", { signal });

    if ("data" in response && response.data) {
      return response.data;
    }

    return response as HealthCheckResponse;
  } catch {
    return {
      status: "unreachable",
      service: "backend",
    };
  }
}
