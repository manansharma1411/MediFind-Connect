import test from "node:test";
import assert from "node:assert/strict";
import {
  filterUnmetSignals,
  formatDemandChangePct,
  getChartMaxDomain,
  shouldSuppressForPrivacy,
  validateDateRange,
} from "../src/lib/intelligenceUtils.ts";
import {
  getAreaDemandInsights,
  getDemandOverview,
  getMedicineDemandTrends,
  getUnmetDemandSignals,
} from "../src/services/demandIntelligenceService.ts";
import type { PharmacySession } from "../src/types/pharmacy.ts";
import type { UnmetDemandSignal } from "../src/types/intelligence.ts";

test("intelligenceUtils enforces privacy thresholds, zero-based domains, and date validation", () => {
  assert.equal(shouldSuppressForPrivacy(9, 10), true);
  assert.equal(shouldSuppressForPrivacy(10, 10), false);

  assert.equal(getChartMaxDomain([]), 10);
  assert.ok(getChartMaxDomain([20, 50]) >= 50);

  assert.equal(formatDemandChangePct(null), "Insufficient baseline");
  assert.equal(formatDemandChangePct(12.34), "+12.3%");
  assert.equal(formatDemandChangePct(-5.5), "-5.5%");

  assert.ok(validateDateRange("2026-11-28", "2026-11-20"));
  assert.equal(validateDateRange("2026-11-20", "2026-11-28"), null);
});

test("filterUnmetSignals filters by area and unmet category", () => {
  const sample: UnmetDemandSignal[] = [
    {
      id: "1",
      medicineName: "Med A",
      area: "MP Nagar Zone-I",
      category: "NO_ELIGIBLE_STOCK",
      aggregatedDemandIndicator: 15,
      reportingPeriod: "7d",
      dataFreshnessAt: "2026-11-28T00:00:00.000Z",
      eligibleLocalSupplyCount: 0,
      sampleSufficient: true,
    },
    {
      id: "2",
      medicineName: "Med B",
      area: "Arera Colony",
      category: "PARTIAL_AVAILABILITY",
      aggregatedDemandIndicator: 11,
      reportingPeriod: "7d",
      dataFreshnessAt: "2026-11-28T00:00:00.000Z",
      eligibleLocalSupplyCount: 1,
      sampleSufficient: true,
    },
  ];

  const byArea = filterUnmetSignals(sample, {
    area: "MP Nagar Zone-I",
    category: "all",
  });
  assert.deepEqual(
    byArea.map((s) => s.id),
    ["1"]
  );

  const byCat = filterUnmetSignals(sample, {
    area: "all",
    category: "PARTIAL_AVAILABILITY",
  });
  assert.deepEqual(
    byCat.map((s) => s.id),
    ["2"]
  );
});

test("demandIntelligenceService handles preview mode, 404 unavailable, and 403 forbidden", async () => {
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

  const overview = await getDemandOverview(previewSession);
  assert.equal(overview.source, "preview");
  assert.ok(overview.data);

  const trends = await getMedicineDemandTrends(previewSession, {
    medicineId: "demo-med-1",
    grouping: "week",
  });
  assert.equal(trends.source, "preview");
  assert.equal(trends.data?.grouping, "week");

  const unmet = await getUnmetDemandSignals(previewSession);
  assert.equal(unmet.source, "preview");
  assert.ok((unmet.data?.length ?? 0) >= 1);

  const areas = await getAreaDemandInsights(previewSession, {
    pincode: "462011",
  });
  assert.equal(areas.source, "preview");
  assert.equal(areas.data?.length, 1);

  // Verify live 403 Forbidden propagation
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
          error: { code: "FORBIDDEN", message: "Pharmacy access required" },
        }),
        { status: 403, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => getDemandOverview(liveSession),
      (err: { status?: number; code?: string }) =>
        err.status === 403 && err.code === "FORBIDDEN"
    );

    // Verify 404 returns source: "unavailable" without inventing data
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "RESOURCE_NOT_FOUND", message: "Not implemented" },
        }),
        { status: 404, headers: { "content-type": "application/json" } }
      );

    const unavailableRes = await getDemandOverview(liveSession);
    assert.equal(unavailableRes.source, "unavailable");
    assert.equal(unavailableRes.data, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = prevBase;
    }
  }
});
