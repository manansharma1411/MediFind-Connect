import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTransferRequestHref,
  extractPaginatedItems,
  formatFreshnessDate,
  getConfidenceBadgeMeta,
  getDemandBasisLabel,
  getForecastChartMaxDomain,
  getShortageRiskMeta,
  mapForecastResponse,
  mapMatchItem,
  mapRestockItem,
  mapShortageItem,
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
  assert.ok(
    getDemandBasisLabel("CONSUMPTION_AND_DEMAND").includes("consumption")
  );
  assert.equal(formatFreshnessDate(""), "Freshness unavailable");

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

test("extractPaginatedItems unwraps res.data.items and preserves pagination metadata", () => {
  const unwrapped = extractPaginatedItems({
    items: [{ id: 1 }, { id: 2 }],
    pagination: { page: 1, pageSize: 20, total: 42, totalPages: 3 },
  });
  assert.equal(unwrapped.items.length, 2);
  assert.equal(unwrapped.pagination?.total, 42);
  assert.equal(unwrapped.pagination?.totalPages, 3);

  const empty = extractPaginatedItems({ items: [] });
  assert.deepEqual(empty.items, []);
});

test("mapShortageItem maps backend schema, explainability, INSUFFICIENT_DATA, and null fields safely", () => {
  const high = mapShortageItem({
    medicineId: "med-1",
    medicineName: "Paracetamol 650mg",
    riskCategory: "HIGH",
    riskScore: 0.81,
    area: "MP Nagar",
    city: "Bhopal",
    explanation: {
      summary: "Elevated search demand relative to nearby stock.",
      confidence: "MODERATE",
      whatWasIdentified: "High risk signal",
      whyIdentified: "Demand rose 50%",
      influencingMetrics: [{ label: "Search Delta", value: "+50%" }],
      reportingPeriod: "Last 14 days",
      dataFreshness: { latestDataDate: "2026-11-28T08:00:00Z" },
      limitations: ["Search demand only.", "Not a guaranteed shortage."],
    },
  });

  assert.equal(high.id, "med-1");
  assert.equal(high.pharmacyOrArea, "MP Nagar, Bhopal");
  assert.equal(high.confidenceLevel, "MODERATE");
  assert.equal(high.sampleSufficient, true);
  assert.equal(high.explanation, "Elevated search demand relative to nearby stock.");
  assert.equal(high.explainability?.whatWasIdentified, "High risk signal");
  assert.equal(high.explainability?.whyIdentified, "Demand rose 50%");
  assert.deepEqual(high.explainability?.supportingMetrics, [
    { label: "Search Delta", value: "+50%" },
  ]);
  assert.equal(high.explainability?.dataPeriod, "Last 14 days");
  assert.equal(high.explainability?.dataFreshnessAt, "2026-11-28T08:00:00Z");
  assert.equal(
    high.explainability?.limitations,
    "Search demand only. Not a guaranteed shortage."
  );

  const insufficient = mapShortageItem({
    medicineId: "med-2",
    medicineName: null,
    riskCategory: "INSUFFICIENT_DATA",
    riskScore: null,
    area: null,
    city: null,
    explanation: null,
  });
  assert.equal(insufficient.sampleSufficient, false);
  assert.equal(insufficient.riskScore, null);
  assert.equal(insufficient.confidenceLevel, "INSUFFICIENT");
  assert.equal(insufficient.explainability, null);
  assert.equal(insufficient.pharmacyOrArea, "Area not specified");
});

test("mapRestockItem maps demandBasis, confidence, nullable quantities, and unknown enums", () => {
  const item = mapRestockItem({
    medicineId: "med-1",
    medicineName: "Paracetamol 650mg",
    currentEligibleStock: 12,
    suggestedRestockQuantity: 50,
    estimatedCoverageDays: 8,
    demandBasis: "DEMAND_SIGNAL_BASED",
    explanation: {
      summary: "Review restock quantity based on search demand.",
      confidence: "MODERATE",
      influencingMetrics: [{ label: "Eligible Stock", value: 12 }],
    },
  });
  assert.equal(item.id, "med-1");
  assert.equal(item.demandBasis, "SEARCH_DEMAND");
  assert.equal(item.recommendationReason, "Review restock quantity based on search demand.");
  assert.equal(item.confidenceLevel, "MODERATE");
  assert.equal(item.sampleSufficient, true);

  const salesItem = mapRestockItem({
    medicineId: "med-2",
    demandBasis: "SALES_AND_DEMAND_BASED",
    currentEligibleStock: null,
    suggestedRestockQuantity: null,
    explanation: { confidence: "UNEXPECTED_VALUE" },
  });
  assert.equal(salesItem.demandBasis, "CONSUMPTION_AND_DEMAND");
  assert.equal(salesItem.currentEligibleStock, null);
  assert.equal(salesItem.suggestedRestockQuantity, null);
  assert.equal(salesItem.confidenceLevel, "INSUFFICIENT");
  assert.equal(salesItem.sampleSufficient, false);
});

test("mapForecastResponse maps horizonPeriods, READY status, predictions, and bounds", () => {
  const ready = mapForecastResponse({
    medicineId: "med-1",
    medicineName: "Paracetamol 650mg",
    area: "MP Nagar",
    horizonPeriods: 7,
    status: "READY",
    historicalObservations: [
      { periodStart: "2026-11-27", observedDemandSignals: 30 },
    ],
    predictions: [
      {
        periodStart: "2026-11-29",
        predictedDemandSignals: 35,
        lowerBound: 28,
        upperBound: 42,
      },
    ],
    explanation: {
      summary: "Projected search demand band.",
      confidence: "MODERATE",
    },
  });

  assert.equal(ready.horizonDays, 7);
  assert.equal(ready.sampleSufficient, true);
  assert.equal(ready.historicalPoints[0]?.dateLabel, "2026-11-27");
  assert.equal(ready.historicalPoints[0]?.observedDemand, 30);
  assert.equal(ready.forecastPoints[0]?.dateLabel, "2026-11-29");
  assert.equal(ready.forecastPoints[0]?.predictedDemand, 35);
  assert.equal(ready.forecastPoints[0]?.lowerBound, 28);
  assert.equal(ready.forecastPoints[0]?.upperBound, 42);

  const notReady = mapForecastResponse({
    medicineId: "med-2",
    horizonPeriods: 14,
    status: "INSUFFICIENT_HISTORY",
    predictions: [],
    explanation: { summary: "Not enough history." },
  });
  assert.equal(notReady.sampleSufficient, false);
  assert.equal(notReady.insufficientHistoryMessage, "Not enough history.");
});

test("mapMatchItem maps composite id, requestingArea, transfer eligibility, and unknown enums", () => {
  const high = mapMatchItem({
    medicineId: "med-1",
    medicineName: "Paracetamol 650mg",
    requestingArea: "MP Nagar",
    supplyingPharmacyId: "pharm-9",
    supplyingPharmacyName: "Arogya Medicos",
    distanceKm: 2.5,
    transferEligibleAvailability: "ELIGIBLE_HIGH",
    explanation: {
      summary: "Nearby partner holds eligible stock.",
      confidence: "HIGH",
    },
  });
  assert.equal(high.id, "med-1-pharm-9");
  assert.equal(high.demandArea, "MP Nagar");
  assert.equal(high.transferEligibleAvailability, "AVAILABLE");
  assert.equal(high.matchExplanation, "Nearby partner holds eligible stock.");

  const limitedAndUnknown = mapMatchItem({
    medicineId: "med-2",
    supplyingPharmacyId: "pharm-10",
    transferEligibleAvailability: "ELIGIBLE_LIMITED",
    distanceKm: null,
  });
  assert.equal(limitedAndUnknown.transferEligibleAvailability, "LIMITED");
  assert.equal(limitedAndUnknown.distanceKm, null);

  const unknownEnum = mapMatchItem({
    medicineId: "med-3",
    supplyingPharmacyId: "pharm-11",
    transferEligibleAvailability: "UNKNOWN_STATUS",
  });
  assert.equal(unknownEnum.transferEligibleAvailability, "UNCONFIRMED");
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

test("aiIntelligenceService unwraps live paginated responses and handles 404/401/403 cleanly", async () => {
  const originalFetch = globalThis.fetch;
  const prevApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example.test";

  try {
    // 1. Live paginated responses (HTTP 200)
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/v1/intelligence/shortages")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  medicineId: "med-1",
                  medicineName: "Paracetamol",
                  riskCategory: "HIGH",
                  area: "MP Nagar",
                  city: "Bhopal",
                  explanation: { summary: "High risk", confidence: "MODERATE" },
                },
              ],
              pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/pharmacies/me/intelligence/restock")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { items: [], pagination: { total: 0 } },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/api/v1/intelligence/matches")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  medicineId: "med-1",
                  supplyingPharmacyId: "pharm-2",
                  requestingArea: "MP Nagar",
                  transferEligibleAvailability: "ELIGIBLE_HIGH",
                  explanation: { summary: "Match found", confidence: "HIGH" },
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    };

    const shortages = await getShortageRadar(LIVE_SESSION);
    assert.equal(shortages.source, "live");
    assert.equal(shortages.data?.length, 1);
    assert.equal(shortages.data?.[0]?.pharmacyOrArea, "MP Nagar, Bhopal");
    assert.equal(shortages.pagination?.total, 1);

    const restocks = await getSmartRestockRecommendations(LIVE_SESSION);
    assert.equal(restocks.source, "live");
    assert.deepEqual(restocks.data, []);

    const matches = await getSupplyDemandMatches(LIVE_SESSION);
    assert.equal(matches.source, "live");
    assert.equal(matches.data?.[0]?.id, "med-1-pharm-2");
    assert.equal(matches.data?.[0]?.transferEligibleAvailability, "AVAILABLE");

    // 2. 404 -> unavailable state
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });

    const unavailable = await getShortageRadar(LIVE_SESSION);
    assert.equal(unavailable.source, "unavailable");
    assert.equal(unavailable.data, null);

    // 3. 401 -> propagates error for auth guard logout
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

    // 4. 403 -> propagates forbidden error
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
