import { apiClient } from "@/services/apiClient";
import type { HealthCheckResponse } from "@/types/api";

/**
 * Health-check integration stub for Person B's backend service.
 * Endpoint path will be finalized once Person B publishes the API contract.
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
    return await apiClient.get<HealthCheckResponse>("/health", { signal });
  } catch {
    return {
      status: "unreachable",
      service: "backend",
    };
  }
}
