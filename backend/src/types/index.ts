export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  message: string;
  app: string;
  version: string;
  environment: string;
  timestamp: string;
}

export interface ReadinessCheckResponse {
  status: 'ready' | 'degraded';
  database: {
    configured: boolean;
    connected: boolean;
    latencyMs?: number;
    message: string;
  };
  timestamp: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
