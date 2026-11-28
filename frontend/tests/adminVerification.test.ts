import test from "node:test";
import assert from "node:assert/strict";
import {
  filterVerificationRecords,
  getVerificationStatusMeta,
  isAuthorizedAdminEmail,
  isAuthorizedAdminSession,
  mapAdminPharmacyRecord,
  paginateVerificationRecords,
  validateRejectionReason,
} from "../src/lib/adminVerificationUtils.ts";
import {
  getAdminPharmacyVerificationDetails,
  listAdminPharmacies,
  loginAdmin,
  submitPharmacyVerificationDecision,
} from "../src/services/adminVerificationService.ts";
import type { PharmacySession } from "../src/types/pharmacy.ts";
import type { AdminPharmacyVerificationRecord } from "../src/types/adminVerification.ts";

const ADMIN_SESSION: PharmacySession = {
  accessToken: "admin-jwt-123",
  userId: "admin-1",
  email: "admin@medifind.example.com",
  displayName: "admin",
  role: "network_admin",
  pharmacyId: "",
  pharmacyName: "Network Admin",
  isPreviewSession: false,
};

const OWNER_SESSION: PharmacySession = {
  ...ADMIN_SESSION,
  role: "pharmacy_admin",
  pharmacyId: "pharm-1",
};

const SAMPLE_RECORDS: AdminPharmacyVerificationRecord[] = [
  {
    id: "p-1",
    name: "CarePlus Pharmacy",
    ownerName: "A. Sharma",
    contactPhone: "+91 755 255 1111",
    contactEmail: "careplus@example.com",
    area: "MP Nagar",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pincode: "462011",
    registeredAddress: "Plot 14",
    licenseNumber: "MP-BPL-20B-10294",
    licenseReviewNotes: null,
    registeredAt: "2026-11-28T08:00:00Z",
    verificationStatus: "PENDING",
    history: [],
  },
  {
    id: "p-2",
    name: "Arogya Medicos",
    ownerName: "R. Verma",
    contactPhone: "+91 755 255 2222",
    contactEmail: "arogya@example.com",
    area: "Arera Colony",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pincode: "462016",
    registeredAddress: "Shop 4",
    licenseNumber: "MP-BPL-21B-88912",
    licenseReviewNotes: null,
    registeredAt: "2026-11-27T08:00:00Z",
    verificationStatus: "VERIFIED",
    history: [],
  },
];

test("isAuthorizedAdminSession allows only non-preview network_admin sessions and ignores email strings", () => {
  assert.equal(isAuthorizedAdminSession(null), false);
  assert.equal(isAuthorizedAdminSession(OWNER_SESSION), false);
  assert.equal(
    isAuthorizedAdminSession({
      ...OWNER_SESSION,
      email: "super.admin@medifind.example.com",
    }),
    false
  );
  assert.equal(
    isAuthorizedAdminSession({ ...ADMIN_SESSION, isPreviewSession: true }),
    false
  );
  assert.equal(isAuthorizedAdminSession(ADMIN_SESSION), true);
});

test("filterVerificationRecords, paginateVerificationRecords, and validateRejectionReason work accurately", () => {
  const pendingOnly = filterVerificationRecords(SAMPLE_RECORDS, {
    status: "PENDING",
  });
  assert.equal(pendingOnly.length, 1);
  assert.equal(pendingOnly[0]?.id, "p-1");

  const searchMatch = filterVerificationRecords(SAMPLE_RECORDS, {
    query: "arogya",
  });
  assert.equal(searchMatch.length, 1);
  assert.equal(searchMatch[0]?.id, "p-2");

  const paged = paginateVerificationRecords(SAMPLE_RECORDS, 2, 1);
  assert.equal(paged.totalPages, 2);
  assert.equal(paged.currentPage, 2);
  assert.equal(paged.pageItems[0]?.id, "p-2");

  assert.ok(validateRejectionReason("no"));
  assert.equal(validateRejectionReason("Invalid drug licence format"), null);
  assert.equal(getVerificationStatusMeta("VERIFIED").variant, "success");
  assert.equal(getVerificationStatusMeta("REJECTED").variant, "error");
});

test("adminVerificationService blocks unauthorized sessions and handles 404/401/403/409/500", async () => {
  await assert.rejects(
    () => listAdminPharmacies(null),
    (err: { status?: number }) => err.status === 401
  );
  await assert.rejects(
    () => listAdminPharmacies(OWNER_SESSION),
    (err: { status?: number }) => err.status === 403
  );
  await assert.rejects(
    () =>
      submitPharmacyVerificationDecision(OWNER_SESSION, "p-1", {
        decision: "VERIFIED",
      }),
    (err: { status?: number }) => err.status === 403
  );

  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";

  try {
    // 404 -> unavailable state
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });

    const unavailable = await listAdminPharmacies(ADMIN_SESSION);
    assert.equal(unavailable.source, "unavailable");
    assert.equal(unavailable.data, null);

    // 409 Conflict on PATCH
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "CONFLICT", message: "Already verified" },
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () =>
        submitPharmacyVerificationDecision(ADMIN_SESSION, "p-1", {
          decision: "VERIFIED",
        }),
      (err: { status?: number; code?: string }) =>
        err.status === 409 && err.code === "CONFLICT"
    );

    // 500 on detail
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Server error" },
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => getAdminPharmacyVerificationDetails(ADMIN_SESSION, "p-1"),
      (err: { status?: number }) => err.status === 500
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (prevApi === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = prevApi;
  }
});

test("isAuthorizedAdminEmail restricts to configured admin email and loginAdmin verifies via Supabase + backend", async () => {
  assert.equal(isAuthorizedAdminEmail("admin676@gmail.com"), true);
  assert.equal(isAuthorizedAdminEmail("  ADMIN676@GMAIL.COM "), true);
  assert.equal(isAuthorizedAdminEmail("other@gmail.com"), false);

  await assert.rejects(
    () => loginAdmin("other@gmail.com", "Password123!"),
    (err: { status?: number; code?: string }) =>
      err.status === 403 && err.code === "UNAUTHORIZED_ADMIN_EMAIL"
  );

  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  const prevSupaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevSupaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";

  try {
    // 1. Successful admin login + backend 200 verification
    let authHeaderSent: string | null = null;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/auth/v1/token")) {
        return new Response(
          JSON.stringify({
            access_token: "admin-supa-jwt",
            user: { id: "admin-uuid-1", email: "admin676@gmail.com" },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/admin/pharmacies/pending")) {
        authHeaderSent = new Headers(init?.headers).get("Authorization");
        return new Response(
          JSON.stringify({
            success: true,
            data: { summary: {}, items: [] },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    };

    const session = await loginAdmin("admin676@gmail.com", "Password123!");
    assert.equal(session.role, "network_admin");
    assert.equal(session.accessToken, "admin-supa-jwt");
    assert.equal(authHeaderSent, "Bearer admin-supa-jwt");

    // 2. Backend returns 403 -> clear permission error
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/auth/v1/token")) {
        return new Response(
          JSON.stringify({
            access_token: "non-admin-jwt",
            user: { id: "user-1", email: "admin676@gmail.com" },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "FORBIDDEN", message: "Forbidden" },
        }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    };

    await assert.rejects(
      () => loginAdmin("admin676@gmail.com", "Password123!"),
      (err: { status?: number; message?: string }) =>
        err.status === 403 &&
        err.message === "Your account does not have administrator permissions."
    );
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

test("admin verification mappers normalize missing history, null location, and { pharmacy, history } details", async () => {
  const mappedMissingHistory = mapAdminPharmacyRecord({
    id: "pharm-100",
    name: "CarePlus Pharmacy",
    phone: "+91 755 255 1111",
    email: null,
    licenseNumber: "MP-BPL-20B-10294",
    verificationStatus: "PENDING",
    location: null,
    createdAt: "2026-11-28T08:00:00Z",
  });

  assert.deepEqual(mappedMissingHistory.history, []);
  assert.equal(mappedMissingHistory.history.length, 0);
  assert.equal(mappedMissingHistory.registeredAddress, "Address unavailable");
  assert.equal(mappedMissingHistory.contactPhone, "+91 755 255 1111");

  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";

  try {
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/v1/admin/pharmacies/pharm-100/verification")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              pharmacy: {
                id: "pharm-100",
                name: "CarePlus Pharmacy",
                phone: "+91 755 255 1111",
                email: "owner@careplus.example.com",
                licenseNumber: "MP-BPL-20B-10294",
                verificationStatus: "PENDING",
                location: {
                  address: "Plot 14, MP Nagar",
                  area: "MP Nagar",
                  city: "Bhopal",
                  state: "Madhya Pradesh",
                  pincode: "462011",
                },
                createdAt: "2026-11-28T08:00:00Z",
              },
              history: [
                {
                  id: 1,
                  previousStatus: null,
                  newStatus: "PENDING",
                  reason: null,
                  adminUserId: "admin-1",
                  createdAt: "2026-11-28T08:00:00Z",
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "pharm-100",
                name: "CarePlus Pharmacy",
                phone: "+91 755 255 1111",
                verificationStatus: "PENDING",
                createdAt: "2026-11-28T08:00:00Z",
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const listRes = await listAdminPharmacies(ADMIN_SESSION);
    assert.equal(listRes.source, "live");
    assert.equal(listRes.data?.items.length, 1);
    assert.deepEqual(listRes.data?.items[0]?.history, []);

    const detailRes = await getAdminPharmacyVerificationDetails(
      ADMIN_SESSION,
      "pharm-100"
    );
    assert.equal(detailRes.data?.registeredAddress, "Plot 14, MP Nagar");
    assert.equal(detailRes.data?.history.length, 1);
    assert.equal(detailRes.data?.history[0]?.newStatus, "PENDING");
  } finally {
    globalThis.fetch = originalFetch;
    if (prevApi === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = prevApi;
  }
});
