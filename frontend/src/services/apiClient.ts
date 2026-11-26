import type { ApiError } from "@/types/api";

export interface ApiRequestOptions extends RequestInit {
  /** Timeout in milliseconds (default 15000ms to accommodate Render cold starts) */
  timeoutMs?: number;
}

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
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { timeoutMs = 15000, signal: externalSignal, ...fetchOptions } = options;

    if (externalSignal?.aborted) {
      const abortError: ApiError = {
        status: 0,
        code: "REQUEST_CANCELLED",
        message: "Request was cancelled.",
      };
      throw abortError;
    }

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
      ...fetchOptions.headers,
    };

    const controller = new AbortController();
    let didTimeout = false;

    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        const abortError: ApiError = {
          status: 0,
          code: "REQUEST_CANCELLED",
          message: "Request was cancelled.",
        };
        throw abortError;
      }
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
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

      if (err instanceof Error && err.name === "AbortError") {
        const abortErr: ApiError = {
          status: 0,
          code: didTimeout ? "TIMEOUT_ERROR" : "REQUEST_CANCELLED",
          message: didTimeout
            ? `Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`
            : "Request was cancelled.",
        };
        throw abortErr;
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
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    }
  }

  public get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  public post<T>(
    endpoint: string,
    body?: unknown,
    options?: ApiRequestOptions
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
    options?: ApiRequestOptions
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
    options?: ApiRequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
