import test from "node:test";
import assert from "node:assert/strict";
import {
  filterVerificationRecords,
  getVerificationStatusMeta,
  isAuthorizedAdminSession,
  paginateVerificationRecords,
  validateRejectionReason,
} from "../src/lib/adminVerificationUtils.ts";
import {
  getAdminPharmacyVerificationDetails,
  listAdminPharmacies,
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

test("isAuthorizedAdminSession allows only non-preview network_admin sessions", () => {
  assert.equal(isAuthorizedAdminSession(null), false);
  assert.equal(isAuthorizedAdminSession(OWNER_SESSION), false);
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
