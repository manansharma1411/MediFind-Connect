import test from "node:test";
import assert from "node:assert/strict";
import {
  mapApiDetailsToRegistrationErrors,
  validatePharmacyRegistrationForm,
} from "../src/lib/pharmacyRegistrationUtils.ts";
import {
  loginPharmacy,
  registerPharmacy,
} from "../src/services/pharmacyService.ts";

test("validatePharmacyRegistrationForm validates licenseNumber, PIN code, coordinates, and credentials", () => {
  const invalid = validatePharmacyRegistrationForm(
    {
      name: "A",
      licenseNumber: "1",
      phone: "123",
      email: "bad-email",
      password: "123",
      address: "Main",
      area: "A",
      city: "B",
      state: "C",
      pincode: "012345",
      lat: "120",
      lng: "-200",
      tier: "standard",
      is24x7: false,
    },
    { requireAccountCredentials: true }
  );

  assert.ok(invalid.name);
  assert.ok(invalid.licenseNumber);
  assert.ok(invalid.phone);
  assert.ok(invalid.address);
  assert.ok(invalid.pincode);
  assert.ok(invalid.lat);
  assert.ok(invalid.lng);
  assert.ok(invalid.email);
  assert.ok(invalid.password);

  const valid = validatePharmacyRegistrationForm(
    {
      name: "CarePlus Pharmacy",
      licenseNumber: "MP-BPL-20B-10294",
      phone: "+91 755 255 4321",
      email: "manager@careplus.example.com",
      password: "securePassword123",
      address: "Plot 14, Zone-I, MP Nagar",
      area: "MP Nagar Zone-I",
      city: "Bhopal",
      state: "Madhya Pradesh",
      pincode: "462011",
      lat: "",
      lng: "",
      tier: "standard",
      is24x7: true,
    },
    { requireAccountCredentials: true }
  );
  assert.deepEqual(valid, {});
});

test("mapApiDetailsToRegistrationErrors maps flat and nested validation errors", () => {
  const mapped = mapApiDetailsToRegistrationErrors({
    status: 400,
    code: "VALIDATION_ERROR",
    details: [
      { path: "location.pincode", message: "Must be a valid 6-digit Indian PIN code" },
      { path: "licenseNumber", message: "Valid drug license number is required" },
      { path: "name", message: "Too short" },
    ],
  });
  assert.equal(mapped.pincode, "Must be a valid 6-digit Indian PIN code");
  assert.equal(mapped.licenseNumber, "Valid drug license number is required");
  assert.equal(mapped.name, "Too short");
});

test("registerPharmacy makes exactly one POST /api/v1/pharmacies/register request without calling Supabase signUp or sending Authorization", async () => {
  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  const prevSupaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevSupaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";

  const calls: Array<{
    url: string;
    method: string | undefined;
    authHeader: string | null;
    body: Record<string, unknown>;
  }> = [];

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers = new Headers(init?.headers);
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {};
    calls.push({
      url,
      method: init?.method,
      authHeader: headers.get("Authorization"),
      body,
    });

    if (url === "https://backend.example.test/api/v1/pharmacies/register") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Pharmacy registration submitted successfully. Verification is pending.",
          data: {
            pharmacyId: "pharm-uuid-99",
            status: "PENDING_VERIFICATION",
            verificationStatus: "PENDING",
            isLicensedVerified: false,
            name: "CarePlus Pharmacy",
            area: "MP Nagar",
            city: "Bhopal",
            pincode: "462011",
            is24x7: true,
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(null, { status: 404 });
  };

  try {
    const result = await registerPharmacy({
      payload: {
        name: "CarePlus Pharmacy",
        phone: "+91 755 255 4321",
        email: "owner@store.example.com",
        password: "Password123!",
        licenseNumber: "MP-BPL-20B-10294",
        is24x7: true,
        tier: "standard",
        address: "Plot 14, MP Nagar",
        area: "MP Nagar",
        city: "Bhopal",
        state: "Madhya Pradesh",
        pincode: "462011",
        lat: 23.2323,
        lng: 77.4332,
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://backend.example.test/api/v1/pharmacies/register"
    );
    assert.equal(calls[0]?.method, "POST");
    assert.equal(calls[0]?.authHeader, null);
    assert.equal(calls[0]?.body.email, "owner@store.example.com");
    assert.equal(calls[0]?.body.password, "Password123!");
    assert.equal(calls[0]?.body.pincode, "462011");

    assert.equal(result.pharmacyId, "pharm-uuid-99");
    assert.equal(result.status, "PENDING_VERIFICATION");
    assert.equal(result.verificationStatus, "PENDING");
    assert.equal(result.isLicensedVerified, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevApi === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = prevApi;
    if (prevSupaUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupaUrl;
    if (prevSupaKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevSupaKey;
  }
});

test("registerPharmacy handles duplicate email, duplicate license (409 CONFLICT), validation errors, and 500 errors", async () => {
  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";

  const basePayload = {
    name: "CarePlus",
    phone: "1234567",
    email: "dup@store.example.com",
    password: "Password123!",
    licenseNumber: "LIC-1001",
    is24x7: false,
    tier: "standard" as const,
    address: "Plot 14, MP Nagar",
    area: "MP Nagar",
    city: "Bhopal",
    state: "MP",
    pincode: "462011",
  };

  try {
    // 1. Duplicate email (409 CONFLICT)
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "CONFLICT",
            message: "An account with this email is already registered.",
          },
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => registerPharmacy({ payload: basePayload }),
      (err: { status?: number; code?: string; message?: string }) =>
        err.status === 409 &&
        err.code === "CONFLICT" &&
        Boolean(err.message?.includes("email"))
    );

    // 2. Duplicate license (409 CONFLICT)
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "CONFLICT",
            message: "License number already registered to another pharmacy.",
          },
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => registerPharmacy({ payload: basePayload }),
      (err: { status?: number; code?: string; message?: string }) =>
        err.status === 409 &&
        err.code === "CONFLICT" &&
        Boolean(err.message?.includes("License"))
    );

    // 3. Server error (500)
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected server error.",
          },
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => registerPharmacy({ payload: basePayload }),
      (err: { status?: number; code?: string }) =>
        err.status === 500 && err.code === "INTERNAL_ERROR"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (prevApi === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = prevApi;
  }
});

test("loginPharmacy authenticates with Supabase Auth and fetches /api/v1/pharmacies/me", async () => {
  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  const prevSupaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevSupaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";

  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/auth/v1/token")) {
      return new Response(
        JSON.stringify({
          access_token: "login-jwt-456",
          user: { id: "user-uuid-2", email: "owner@store.example.com" },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (url === "https://backend.example.test/api/v1/pharmacies/me") {
      return new Response(
        JSON.stringify({
          success: true,
          data: { id: "pharm-uuid-99", name: "CarePlus Pharmacy" },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(null, { status: 404 });
  };

  try {
    const session = await loginPharmacy(
      "owner@store.example.com",
      "Password123!"
    );
    assert.equal(session.accessToken, "login-jwt-456");
    assert.equal(session.pharmacyId, "pharm-uuid-99");
    assert.equal(session.pharmacyName, "CarePlus Pharmacy");
    assert.equal(session.isPreviewSession, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevApi === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = prevApi;
    if (prevSupaUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupaUrl;
    if (prevSupaKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevSupaKey;
  }
});
