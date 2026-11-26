import type { ApiError } from "@/types/api";

/**
 * Centralized API Client for MediFind Connect.
 * Base URL is driven strictly by NEXT_PUBLIC_API_BASE_URL.
 */
class ApiClient {
  private get baseUrl(): string {
    const url = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!url) {
      return "";
    }
    return url.trim().replace(/\/+$/, "");
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  /**
   * Resolves the full request URL while preventing accidental duplicate `/api` prefixes
   * regardless of whether NEXT_PUBLIC_API_BASE_URL includes `/api` or not.
   */
  private resolveUrl(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;

    const baseEndsWithApi = /\/api$/i.test(this.baseUrl);
    const endpointStartsWithApi = /^\/api(\/|$)/i.test(normalizedEndpoint);

    if (baseEndsWithApi && endpointStartsWithApi) {
      return `${this.baseUrl}${normalizedEndpoint.replace(/^\/api/i, "")}`;
    }

    return `${this.baseUrl}${normalizedEndpoint}`;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.baseUrl) {
      const error: ApiError = {
        status: 0,
        code: "API_NOT_CONFIGURED",
        message:
          "NEXT_PUBLIC_API_BASE_URL is not configured. Check your environment setup.",
      };
      throw error;
    }

    const url = this.resolveUrl(endpoint);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");
      const payload = isJson ? await response.json() : null;

      if (!response.ok) {
        const apiError: ApiError = {
          status: response.status,
          code:
            payload?.error?.code ||
            payload?.code ||
            `HTTP_${response.status}`,
          message:
            payload?.error?.message ||
            payload?.message ||
            response.statusText ||
            "An unexpected API error occurred.",
          details: payload?.error?.details ?? payload?.details,
        };
        throw apiError;
      }

      return payload as T;
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        "code" in err
      ) {
        throw err;
      }

      const networkError: ApiError = {
        status: 0,
        code: "NETWORK_ERROR",
        message:
          err instanceof Error
            ? err.message
            : "Unable to reach the MediFind Connect backend service.",
      };
      throw networkError;
    }
  }

  public get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  public post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
