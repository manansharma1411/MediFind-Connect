import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTransferRequestHref,
  getConfidenceBadgeMeta,
  getDemandBasisLabel,
  getForecastChartMaxDomain,
  getShortageRiskMeta,
} from "../src/lib/aiIntelligenceUtils.ts";
import {
  getAiOverview,
  getDemandForecast,
  getShortageRadar,
  getSmartRestockRecommendations,
  getSupplyDemandMatches,
} from "../src/services/aiIntelligenceService.ts";
import type { PharmacySession } from "../src/types/pharmacy.ts";
import { PREVIEW_DEMAND_FORECAST } from "../src/mock-data/aiIntelligencePreview.ts";

const LIVE_SESSION: PharmacySession = {
  accessToken: "jwt-token-test",
  userId: "user-1",
  email: "owner@store.example.com",
  displayName: "owner",
  role: "pharmacy_admin",
  pharmacyId: "pharm-1",
  pharmacyName: "CarePlus Pharmacy",
  isPreviewSession: false,
};

const PREVIEW_SESSION: PharmacySession = {
  ...LIVE_SESSION,
  isPreviewSession: true,
};

test("aiIntelligenceUtils maps risk categories, confidence, demand basis, chart domain, and transfer link", () => {
  assert.equal(getShortageRiskMeta("HIGH").badgeVariant, "error");
  assert.equal(getShortageRiskMeta("MODERATE").badgeVariant, "warning");
  assert.equal(getShortageRiskMeta("LOW").badgeVariant, "success");
  assert.equal(getShortageRiskMeta("INSUFFICIENT_DATA").badgeVariant, "neutral");

  assert.equal(getConfidenceBadgeMeta("INSUFFICIENT").variant, "neutral");
  assert.ok(
    getDemandBasisLabel("SEARCH_DEMAND").includes("anonymized search demand")
  );

  const maxY = getForecastChartMaxDomain(PREVIEW_DEMAND_FORECAST);
  assert.ok(maxY >= 57);

  const href = buildTransferRequestHref({
    medicineId: "med-1",
    supplyingPharmacyId: "pharm-2",
  });
  assert.equal(
    href,
    "/collaboration/request?medicineId=med-1&targetPharmacyId=pharm-2"
  );
});

test("aiIntelligenceService returns preview data in preview mode without network calls", async () => {
  const [overview, shortages, restock, forecast, matches] = await Promise.all([
    getAiOverview(PREVIEW_SESSION),
    getShortageRadar(PREVIEW_SESSION),
    getSmartRestockRecommendations(PREVIEW_SESSION),
    getDemandForecast(PREVIEW_SESSION, { medicineId: "med-1", horizonDays: 7 }),
    getSupplyDemandMatches(PREVIEW_SESSION),
  ]);

  assert.equal(overview.source, "preview");
  assert.equal(shortages.source, "preview");
  assert.equal(restock.source, "preview");
  assert.equal(forecast.source, "preview");
  assert.equal(matches.source, "preview");
  assert.equal(forecast.data?.evaluatedAccuracyPct, null);
});

test("aiIntelligenceService handles 404 unavailable, 401 unauthorized, and 403 forbidden cleanly", async () => {
  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";

  try {
    // 1. 404 -> unavailable state (never fabricates live data)
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });

    const unavailable = await getShortageRadar(LIVE_SESSION);
    assert.equal(unavailable.source, "unavailable");
    assert.equal(unavailable.data, null);

    // 2. 401 -> propagates error for auth guard logout
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Expired token" },
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => getDemandForecast(LIVE_SESSION, { medicineId: "med-1" }),
      (err: { status?: number }) => err.status === 401
    );

    // 3. 403 -> propagates forbidden error
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "FORBIDDEN", message: "Verification required" },
        }),
        { status: 403, headers: { "content-type": "application/json" } }
      );

    await assert.rejects(
      () => getSmartRestockRecommendations(LIVE_SESSION),
      (err: { status?: number }) => err.status === 403
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (prevApi === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = prevApi;
  }
});
