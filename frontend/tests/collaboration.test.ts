import test from "node:test";
import assert from "node:assert/strict";
import {
  filterTransfers,
  getPermittedActionsForTransfer,
  resolveTransferActorRole,
  validateCreateTransferForm,
  validateMandatoryReason,
} from "../src/lib/collaborationUtils.ts";
import {
  approveTransfer,
  createTransferRequest,
  getTransferDetails,
  listTransfers,
  rejectTransfer,
} from "../src/services/collaborationService.ts";
import type { TransferRequest } from "../src/types/collaboration.ts";
import type { PharmacySession } from "../src/types/pharmacy.ts";

const SAMPLE_TR: TransferRequest = {
  id: "tr-1",
  transferCode: "TR-2026-0001",
  requestingPharmacyId: "ph-req",
  requestingPharmacyName: "Requesting Store",
  fulfillingPharmacyId: "ph-send",
  fulfillingPharmacyName: "Sending Store",
  medicineId: "m-1",
  medicineName: "Paracetamol 650 mg",
  quantityRequested: 10,
  quantityApproved: null,
  status: "REQUESTED",
  unitTransferPrice: 30,
  totalTransferValue: 300,
  notes: "Urgent demand",
  createdAt: "2026-11-27T10:00:00.000Z",
  updatedAt: "2026-11-27T10:00:00.000Z",
};

test("resolveTransferActorRole and getPermittedActionsForTransfer enforce state machine", () => {
  const senderRole = resolveTransferActorRole(
    SAMPLE_TR,
    "ph-send",
    "pharmacy_admin"
  );
  const receiverRole = resolveTransferActorRole(
    SAMPLE_TR,
    "ph-req",
    "pharmacy_admin"
  );

  assert.equal(senderRole, "fulfilling_pharmacy");
  assert.equal(receiverRole, "requesting_pharmacy");

  assert.deepEqual(getPermittedActionsForTransfer("REQUESTED", senderRole), [
    "approve",
    "reject",
  ]);
  assert.deepEqual(getPermittedActionsForTransfer("REQUESTED", receiverRole), [
    "cancel",
  ]);

  assert.deepEqual(getPermittedActionsForTransfer("APPROVED", senderRole), [
    "dispatch",
    "cancel",
  ]);
  assert.deepEqual(getPermittedActionsForTransfer("APPROVED", receiverRole), [
    "cancel",
  ]);

  assert.deepEqual(getPermittedActionsForTransfer("DISPATCHED", receiverRole), [
    "receive",
  ]);
  assert.deepEqual(getPermittedActionsForTransfer("DISPATCHED", senderRole), [
    "cancel",
  ]);

  // Terminal states allow zero actions
  for (const terminal of ["REJECTED", "RECEIVED", "CANCELLED"] as const) {
    assert.deepEqual(getPermittedActionsForTransfer(terminal, senderRole), []);
    assert.deepEqual(getPermittedActionsForTransfer(terminal, receiverRole), []);
  }
});

test("validateCreateTransferForm and validateMandatoryReason validate inputs", () => {
  const invalid = validateCreateTransferForm(
    {
      fulfillingPharmacyId: "ph-req",
      medicineId: "",
      quantityRequested: "0",
      notes: "hi",
    },
    "ph-req"
  );
  assert.ok(invalid.fulfillingPharmacyId);
  assert.ok(invalid.medicineId);
  assert.ok(invalid.quantityRequested);
  assert.ok(invalid.notes);

  const valid = validateCreateTransferForm(
    {
      fulfillingPharmacyId: "ph-send",
      medicineId: "m-1",
      quantityRequested: "10",
      notes: "Urgent counter demand",
    },
    "ph-req"
  );
  assert.deepEqual(valid, {});

  assert.ok(validateMandatoryReason("no"));
  assert.equal(validateMandatoryReason("Insufficient stock"), null);
});

test("filterTransfers filters by query, status, and date range", () => {
  const list: TransferRequest[] = [
    SAMPLE_TR,
    {
      ...SAMPLE_TR,
      id: "tr-2",
      transferCode: "TR-2026-0002",
      status: "RECEIVED",
      medicineName: "Azithromycin 500 mg",
      createdAt: "2026-11-20T10:00:00.000Z",
    },
  ];

  const byStatus = filterTransfers(list, {
    query: "",
    status: "RECEIVED",
    dateFrom: "",
    dateTo: "",
  });
  assert.deepEqual(
    byStatus.map((t) => t.id),
    ["tr-2"]
  );

  const byDate = filterTransfers(list, {
    query: "",
    status: "all",
    dateFrom: "2026-11-25",
    dateTo: "2026-11-28",
  });
  assert.deepEqual(
    byDate.map((t) => t.id),
    ["tr-1"]
  );
});

test("collaborationService handles preview mode, 404 unavailable, and 409 invalid-state errors", async () => {
  const previewSession: PharmacySession = {
    accessToken: "preview",
    userId: "u1",
    email: "p@example.com",
    displayName: "Preview",
    role: "pharmacy_admin",
    pharmacyId: "demo-pharm-1",
    pharmacyName: "CarePlus",
    isPreviewSession: true,
  };

  const incoming = await listTransfers(previewSession, {
    direction: "incoming",
  });
  assert.equal(incoming.source, "preview");
  assert.ok((incoming.data?.length ?? 0) >= 1);

  const details = await getTransferDetails(previewSession, "tr-preview-1");
  assert.equal(details.source, "preview");
  assert.ok(details.data?.transfer);

  await assert.rejects(
    () =>
      createTransferRequest(previewSession, {
        fulfillingPharmacyId: "demo-pharm-2",
        medicineId: "demo-med-1",
        quantityRequested: 5,
        notes: "Test request",
      }),
    (err: { code?: string }) => err.code === "PREVIEW_READ_ONLY"
  );

  const liveSession: PharmacySession = {
    ...previewSession,
    isPreviewSession: false,
    accessToken: "jwt-token",
  };
  const originalFetch = globalThis.fetch;
  const prevBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.test";

  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_STATE_TRANSITION",
            message: "Cannot approve rejected transfer",
          },
        }),
        { status: 409, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => approveTransfer(liveSession, "tr-1"),
      (err: { status?: number; code?: string }) =>
        err.status === 409 && err.code === "INVALID_STATE_TRANSITION"
    );

    await assert.rejects(
      () => rejectTransfer(liveSession, "tr-1", "Out of stock"),
      (err: { status?: number; code?: string }) =>
        err.status === 409 && err.code === "INVALID_STATE_TRANSITION"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (prevBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = prevBase;
    }
  }
});
