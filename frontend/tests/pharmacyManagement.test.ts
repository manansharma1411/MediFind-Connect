import test from "node:test";
import assert from "node:assert/strict";
import {
  computeStockAdjustmentPreview,
  filterAndSortInventory,
  getEffectiveInventoryStatus,
  isMedicineExpired,
  isNearExpiry,
  validateAddMedicineForm,
} from "../src/lib/pharmacyUtils.ts";
import {
  getPharmacyAlerts,
  getPharmacyDashboard,
  getPharmacyInventory,
  getPharmacyProfile,
  getStockHistory,
  patchPharmacyInventory,
} from "../src/services/pharmacyService.ts";
import type {
  PharmacyInventoryItem,
  PharmacySession,
} from "../src/types/pharmacy.ts";

const NOW_MS = Date.parse("2026-11-27T12:00:00.000Z");

const SAMPLE_ITEMS: PharmacyInventoryItem[] = [
  {
    id: "i1",
    pharmacyId: "ph-1",
    medicineId: "m1",
    medicineName: "Paracetamol 650 mg",
    brandName: "Dolo 650",
    strength: "650 mg",
    form: "Tablet",
    packSize: "Strip of 15",
    batchNumber: "B1",
    expiryDate: "2027-06-01",
    quantityAvailable: 40,
    quantityReserved: 0,
    mrp: 35,
    sellingPrice: 30,
    reorderThreshold: 10,
    status: "IN_STOCK",
    updatedAt: "2026-11-27T10:00:00.000Z",
  },
  {
    id: "i2",
    pharmacyId: "ph-1",
    medicineId: "m2",
    medicineName: "Amoxicillin 625 mg",
    brandName: "Augmentin 625",
    strength: "625 mg",
    form: "Tablet",
    packSize: "Strip of 10",
    batchNumber: "B2",
    expiryDate: "2026-12-10",
    quantityAvailable: 5,
    quantityReserved: 0,
    mrp: 205,
    sellingPrice: 190,
    reorderThreshold: 8,
    status: "LOW_STOCK",
    updatedAt: "2026-11-27T10:00:00.000Z",
  },
  {
    id: "i3",
    pharmacyId: "ph-1",
    medicineId: "m3",
    medicineName: "Pantoprazole SR",
    brandName: "Pan-D",
    strength: "40 mg",
    form: "Capsule",
    packSize: "Strip of 15",
    batchNumber: "B3",
    expiryDate: "2026-10-01",
    quantityAvailable: 15,
    quantityReserved: 0,
    mrp: 210,
    sellingPrice: 195,
    reorderThreshold: 5,
    status: "IN_STOCK",
    updatedAt: "2026-11-27T10:00:00.000Z",
  },
];

test("expired stock is never classified as IN_STOCK", () => {
  assert.equal(isMedicineExpired("2026-10-01", NOW_MS), true);
  assert.equal(isMedicineExpired("2027-06-01", NOW_MS), false);
  assert.equal(isNearExpiry("2026-12-10", 30, NOW_MS), true);
  assert.equal(isNearExpiry("2026-10-01", 30, NOW_MS), false);

  assert.equal(
    getEffectiveInventoryStatus(SAMPLE_ITEMS[2], NOW_MS),
    "EXPIRED"
  );
  assert.equal(
    getEffectiveInventoryStatus(SAMPLE_ITEMS[1], NOW_MS),
    "LOW_STOCK"
  );
  assert.equal(
    getEffectiveInventoryStatus(SAMPLE_ITEMS[0], NOW_MS),
    "IN_STOCK"
  );
});

test("filterAndSortInventory filters by search, status, expiry, and sorts", () => {
  const expiredOnly = filterAndSortInventory(
    SAMPLE_ITEMS,
    {
      query: "",
      statusFilter: "EXPIRED",
      expiryFilter: "all",
      sortBy: "name",
    },
    NOW_MS
  );
  assert.deepEqual(
    expiredOnly.map((i) => i.id),
    ["i3"]
  );

  const nearExpiry = filterAndSortInventory(
    SAMPLE_ITEMS,
    {
      query: "Augmentin",
      statusFilter: "all",
      expiryFilter: "near_expiry",
      sortBy: "quantity",
    },
    NOW_MS
  );
  assert.deepEqual(
    nearExpiry.map((i) => i.id),
    ["i2"]
  );
});

test("validateAddMedicineForm validates required fields and rejects expired or negative values", () => {
  const invalid = validateAddMedicineForm(
    {
      medicineId: "",
      batchNumber: "",
      quantity: "0",
      sellingPrice: "-5",
      expiryDate: "2026-01-01",
      reorderThreshold: "-1",
    },
    NOW_MS
  );
  assert.ok(invalid.medicineId);
  assert.ok(invalid.quantity);
  assert.ok(invalid.sellingPrice);
  assert.ok(invalid.expiryDate);
  assert.ok(invalid.reorderThreshold);

  const valid = validateAddMedicineForm(
    {
      medicineId: "demo-med-1",
      batchNumber: "B-100",
      quantity: "25",
      sellingPrice: "29.5",
      expiryDate: "2027-05-01",
      reorderThreshold: "5",
    },
    NOW_MS
  );
  assert.deepEqual(valid, {});
});

test("computeStockAdjustmentPreview computes add/remove/correct and blocks negative stock", () => {
  const add = computeStockAdjustmentPreview(10, "add", "5");
  assert.equal(add.isValid, true);
  assert.equal(add.deltaQuantity, 5);
  assert.equal(add.resultingQuantity, 15);

  const badRemove = computeStockAdjustmentPreview(4, "remove", "10");
  assert.equal(badRemove.isValid, false);
  assert.ok(badRemove.error);

  const correct = computeStockAdjustmentPreview(10, "correct", "7");
  assert.equal(correct.isValid, true);
  assert.equal(correct.deltaQuantity, -3);
  assert.equal(correct.resultingQuantity, 7);
});

test("pharmacyService enforces preview read-only and propagates 401/409 errors cleanly", async () => {
  const previewSession: PharmacySession = {
    accessToken: "preview",
    userId: "u1",
    email: "p@example.com",
    displayName: "Preview",
    role: "pharmacy_admin",
    pharmacyId: "demo-pharm-1",
    pharmacyName: "Preview Store",
    isPreviewSession: true,
  };

  const dash = await getPharmacyDashboard(previewSession);
  assert.equal(dash.source, "preview");
  assert.ok(dash.data);

  const inv = await getPharmacyInventory(previewSession);
  assert.equal(inv.source, "preview");
  assert.ok((inv.data?.length ?? 0) > 0);

  const hist = await getStockHistory(previewSession);
  assert.equal(hist.source, "preview");

  const alerts = await getPharmacyAlerts(previewSession);
  assert.equal(alerts.source, "preview");

  const prof = await getPharmacyProfile(previewSession);
  assert.equal(prof.source, "preview");

  await assert.rejects(
    () =>
      patchPharmacyInventory(previewSession, {
        medicineId: "m1",
        deltaQuantity: 5,
        reason: "STOCK_AUDIT",
      }),
    (err: { code?: string }) => err.code === "PREVIEW_READ_ONLY"
  );

  // Verify live 409 INSUFFICIENT_STOCK propagation
  const liveSession: PharmacySession = {
    ...previewSession,
    isPreviewSession: false,
    accessToken: "jwt-token",
  };
  const originalFetch = globalThis.fetch;
  const prevBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.test";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        error: { code: "INSUFFICIENT_STOCK", message: "Negative stock blocked" },
      }),
      { status: 409, headers: { "content-type": "application/json" } }
    );

  try {
    await assert.rejects(
      () =>
        patchPharmacyInventory(liveSession, {
          medicineId: "m1",
          deltaQuantity: -50,
          reason: "SALE",
        }),
      (err: { status?: number; code?: string }) =>
        err.status === 409 && err.code === "INSUFFICIENT_STOCK"
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
