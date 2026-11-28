import type { ApiError } from "../types/api.ts";

export interface SupabaseAuthResult {
  accessToken: string | null;
  userId: string;
  email: string;
  requiresEmailConfirmation: boolean;
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    const err: ApiError = {
      status: 0,
      code: "SUPABASE_NOT_CONFIGURED",
      message:
        "Supabase Auth is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).",
    };
    throw err;
  }
  return { url, anonKey };
}

function mapSupabaseError(
  status: number,
  payload: Record<string, unknown> | null
): ApiError {
  const rawCode = String(
    payload?.error_code ?? payload?.code ?? payload?.error ?? ""
  ).toLowerCase();
  const rawMsg = String(
    payload?.msg ??
      payload?.message ??
      payload?.error_description ??
      "Authentication request failed."
  );

  if (
    rawCode.includes("user_already_exists") ||
    rawMsg.toLowerCase().includes("already registered")
  ) {
    return {
      status,
      code: "EMAIL_ALREADY_EXISTS",
      message:
        "An account with this email already exists. Sign in on the Login page instead.",
    };
  }

  return {
    status,
    code: rawCode ? rawCode.toUpperCase() : `AUTH_${status}`,
    message: rawMsg,
  };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<SupabaseAuthResult> {
  const { url, anonKey } = getSupabaseConfig();

  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
    signal,
  });

  const payload = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!res.ok) {
    throw mapSupabaseError(res.status, payload);
  }

  const accessToken =
    typeof payload?.access_token === "string"
      ? payload.access_token
      : typeof (payload?.session as Record<string, unknown> | undefined)
          ?.access_token === "string"
      ? ((payload?.session as Record<string, unknown>).access_token as string)
      : null;

  const userObj = (payload?.user as Record<string, unknown> | undefined) ?? payload;
  const userId = typeof userObj?.id === "string" ? userObj.id : "";
  const userEmail =
    typeof userObj?.email === "string" ? userObj.email : email;

  return {
    accessToken,
    userId,
    email: userEmail,
    requiresEmailConfirmation: !accessToken,
  };
}

export async function signInWithPassword(
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<{ accessToken: string; userId: string; email: string }> {
  const { url, anonKey } = getSupabaseConfig();

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
    signal,
  });

  const payload = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!res.ok) {
    throw mapSupabaseError(res.status, payload);
  }

  const accessToken =
    typeof payload?.access_token === "string" ? payload.access_token : "";
  const userObj = payload?.user as Record<string, unknown> | undefined;
  const userId = typeof userObj?.id === "string" ? userObj.id : "";
  const userEmail =
    typeof userObj?.email === "string" ? userObj.email : email;

  if (!accessToken) {
    const err: ApiError = {
      status: 401,
      code: "MISSING_ACCESS_TOKEN",
      message: "Supabase Auth did not return a session access token.",
    };
    throw err;
  }

  return { accessToken, userId, email: userEmail };
}
