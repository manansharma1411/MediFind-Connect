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

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "unreachable";
  service?: string;
  version?: string;
  timestamp?: string;
}
