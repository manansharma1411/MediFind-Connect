export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface HealthCheckData {
  status: "ok" | "degraded" | "unreachable";
  app?: string;
  service?: string;
  version?: string;
  environment?: string;
  timestamp?: string;
}

export type HealthCheckResponse = HealthCheckData;
