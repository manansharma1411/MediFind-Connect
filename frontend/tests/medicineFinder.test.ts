import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDistanceKm,
  createDebouncer,
  filterAndSortAvailability,
  formatLastUpdated,
  isStaleTimestamp,
  mapStockStatusToBadge,
  sortPriceComparisons,
} from "../src/lib/medicineUtils.ts";
import {
  getMedicineAvailability,
  getMedicineById,
  getMedicinePrices,
  listPublicPharmacies,
  searchMedicines,
} from "../src/services/medicineService.ts";
import { apiClient } from "../src/services/apiClient.ts";
import type { MedicineAvailability } from "../src/types/medicine.ts";

test("createDebouncer coalesces rapid calls and supports cancellation", async () => {
  let count = 0;
  let lastArg = "";
  const debouncer = createDebouncer((val: string) => {
    count += 1;
    lastArg = val;
  }, 30);

  debouncer.call("p");
  debouncer.call("pa");
  debouncer.call("par");
  assert.equal(count, 0);

  await new Promise((r) => setTimeout(r, 55));
  assert.equal(count, 1);
  assert.equal(lastArg, "par");

  debouncer.call("cancel-me");
  debouncer.cancel();
  await new Promise((r) => setTimeout(r, 55));
  assert.equal(count, 1);
});

test("searchMedicines finds generic, brand, partial matches, and handles empty results", async () => {
  const brandRes = await searchMedicines({ q: "Dolo" });
  assert.equal(brandRes.source, "demo");
  assert.ok(brandRes.items.length >= 1);
  assert.equal(brandRes.items[0]?.primaryBrand, "Dolo 650");
  assert.ok(brandRes.suggestions.includes("Dolo 650"));

  const genericRes = await searchMedicines({ q: "Paracetamol" });
  assert.ok(genericRes.items.some((m) => m.genericName === "Paracetamol"));

  const emptyRes = await searchMedicines({ q: "nonexistent-xyz-999" });
  assert.equal(emptyRes.items.length, 0);
  assert.equal(emptyRes.pagination.total, 0);
  assert.equal(emptyRes.didYouMean, null);
});

test("getMedicineById, availability, and prices return canonical structures without batch counts", async () => {
  const { medicine } = await getMedicineById("demo-med-1");
  assert.ok(medicine);
  assert.equal(medicine.strength, "650 mg");
  assert.equal(medicine.packSize, "Strip of 15 Tablets");

  const { medicine: availMed, pharmacies: avail } =
    await getMedicineAvailability("demo-med-1", {
      lat: 23.2323,
      lng: 77.4332,
    });
  assert.ok(availMed);
  assert.ok(avail.length >= 2);
  for (const item of avail) {
    assert.equal("batchNumber" in item, false);
    assert.equal("quantityAvailable" in item, false);
    assert.equal(typeof item.sellingPrice, "number");
    assert.equal(typeof item.mrp, "number");
    assert.equal(typeof item.distanceKm, "number");
  }

  const { medicine: priceMed, comparisons: prices } = await getMedicinePrices(
    "demo-med-1"
  );
  assert.ok(priceMed);
  assert.equal(prices.length, avail.length);
});

test("filterAndSortAvailability supports Available now, Open now, 2 km, 5 km, and Lowest price", () => {
  const sample: MedicineAvailability[] = [
    {
      pharmacyId: "p1",
      pharmacyName: "Far Open Store",
      area: "A",
      distanceKm: 4.5,
      is24x7: true,
      isOpenNow: true,
      status: "IN_STOCK",
      sellingPrice: 25,
      mrp: 35,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      pharmacyId: "p2",
      pharmacyName: "Near Closed Store",
      area: "B",
      distanceKm: 1.2,
      is24x7: false,
      isOpenNow: false,
      status: "LOW_STOCK",
      sellingPrice: 30,
      mrp: 35,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      pharmacyId: "p3",
      pharmacyName: "Out of Stock Store",
      area: "C",
      distanceKm: 0.8,
      is24x7: true,
      isOpenNow: true,
      status: "OUT_OF_STOCK",
      sellingPrice: 20,
      mrp: 35,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date().toISOString(),
    },
  ];

  const availOnly = filterAndSortAvailability(sample, {
    availableNow: true,
    openNow: false,
    maxDistanceKm: null,
    sortBy: "distance",
  });
  assert.deepEqual(
    availOnly.map((i) => i.pharmacyId),
    ["p2", "p1"]
  );

  const openAndWithin5 = filterAndSortAvailability(sample, {
    availableNow: true,
    openNow: true,
    maxDistanceKm: 5,
    sortBy: "price",
  });
  assert.deepEqual(
    openAndWithin5.map((i) => i.pharmacyId),
    ["p1"]
  );

  const within2 = filterAndSortAvailability(sample, {
    availableNow: false,
    openNow: false,
    maxDistanceKm: 2,
    sortBy: "price",
  });
  assert.deepEqual(
    within2.map((i) => i.pharmacyId),
    ["p3", "p2"]
  );
});

test("sortPriceComparisons orders by lowest selling price then availability", () => {
  const sample: MedicineAvailability[] = [
    {
      pharmacyId: "p1",
      pharmacyName: "Expensive",
      area: "A",
      distanceKm: 1,
      is24x7: true,
      status: "IN_STOCK",
      sellingPrice: 40,
      mrp: 45,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      pharmacyId: "p2",
      pharmacyName: "Cheapest Out",
      area: "B",
      distanceKm: 2,
      is24x7: true,
      status: "OUT_OF_STOCK",
      sellingPrice: 28,
      mrp: 45,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      pharmacyId: "p3",
      pharmacyName: "Cheapest In Stock",
      area: "C",
      distanceKm: 3,
      is24x7: true,
      status: "IN_STOCK",
      sellingPrice: 28,
      mrp: 45,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date().toISOString(),
    },
  ];

  const sorted = sortPriceComparisons(sample);
  assert.deepEqual(
    sorted.map((s) => s.pharmacyId),
    ["p3", "p2", "p1"]
  );
});

test("calculateDistanceKm, mapStockStatusToBadge, and stale timestamp helpers work accurately", () => {
  const dist = calculateDistanceKm(23.2323, 77.4332, 23.2086, 77.4348);
  assert.ok(dist > 2 && dist < 3.5);

  assert.equal(mapStockStatusToBadge("IN_STOCK"), "in_stock");
  assert.equal(mapStockStatusToBadge("LOW_STOCK"), "low_stock");
  assert.equal(mapStockStatusToBadge("OUT_OF_STOCK"), "out_of_stock");

  const now = Date.now();
  const freshIso = new Date(now - 10 * 60 * 1000).toISOString();
  const staleIso = new Date(now - 30 * 60 * 60 * 1000).toISOString();

  assert.equal(isStaleTimestamp(freshIso, 24, now), false);
  assert.equal(isStaleTimestamp(staleIso, 24, now), true);
  assert.equal(formatLastUpdated(freshIso, now), "10 mins ago");
});

test("listPublicPharmacies filters by 24x7 and computes distance when coords provided", async () => {
  const res = await listPublicPharmacies({
    is24x7: true,
    coords: { lat: 23.2323, lng: 77.4332 },
  });
  assert.ok(res.items.length >= 1);
  assert.ok(res.items.every((p) => p.is24x7));
  assert.equal(typeof res.items[0]?.location.distanceKm, "number");
});

test("apiClient handles aborted/cancelled requests and 500 error responses cleanly", async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => searchMedicines({ q: "Dolo" }, controller.signal),
    (err: { code?: string }) => err.code === "REQUEST_CANCELLED"
  );

  // Verify non-404 API error (e.g. 500) is surfaced rather than masked
  const originalFetch = globalThis.fetch;
  const prevBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.test";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Backend failure" },
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );

  try {
    await assert.rejects(
      () => apiClient.get("/api/v1/medicines"),
      (err: { status?: number; code?: string }) =>
        err.status === 500 && err.code === "INTERNAL_SERVER_ERROR"
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

test("openNow filter respects explicit isOpenNow: false even when is24x7 is true", () => {
  const sample: MedicineAvailability[] = [
    {
      pharmacyId: "p-explicit-closed",
      pharmacyName: "Temporarily Closed 24x7",
      area: "A",
      distanceKm: 1.0,
      is24x7: true,
      isOpenNow: false,
      status: "IN_STOCK",
      sellingPrice: 30,
      mrp: 35,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      pharmacyId: "p-fallback-24x7",
      pharmacyName: "24x7 Without Explicit Flag",
      area: "B",
      distanceKm: 2.0,
      is24x7: true,
      isOpenNow: null,
      status: "IN_STOCK",
      sellingPrice: 32,
      mrp: 35,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date().toISOString(),
    },
  ];

  const openOnly = filterAndSortAvailability(sample, {
    availableNow: false,
    openNow: true,
    maxDistanceKm: null,
    sortBy: "distance",
  });
  assert.deepEqual(
    openOnly.map((i) => i.pharmacyId),
    ["p-fallback-24x7"]
  );
});

test("getMedicineAvailability and getMedicinePrices extract pharmacies/comparisons and pass lat/lng", async () => {
  const originalFetch = globalThis.fetch;
  const prevBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.test";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    requestedUrls.push(url);
    if (url.includes("/availability")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            medicine: { id: "med-1", name: "Test Med" },
            pharmacies: [{ pharmacyId: "ph-1", pharmacyName: "Store 1" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          medicine: { id: "med-1", name: "Test Med" },
          comparisons: [{ pharmacyId: "ph-1", sellingPrice: 25 }],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  try {
    const avail = await getMedicineAvailability("med-1", {
      lat: 23.25,
      lng: 77.41,
    });
    assert.equal(avail.source, "live");
    assert.equal(avail.medicine?.id, "med-1");
    assert.equal(avail.pharmacies.length, 1);
    assert.equal(avail.pharmacies[0]?.pharmacyId, "ph-1");

    const prices = await getMedicinePrices("med-1", {
      lat: 23.25,
      lng: 77.41,
    });
    assert.equal(prices.source, "live");
    assert.equal(prices.medicine?.id, "med-1");
    assert.equal(prices.comparisons.length, 1);
    assert.equal(prices.comparisons[0]?.sellingPrice, 25);

    assert.ok(
      requestedUrls.some(
        (u) => u.includes("/prices") && u.includes("lat=23.25") && u.includes("lng=77.41")
      )
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
