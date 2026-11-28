import type {
  AiOverviewSummary,
  DemandForecastData,
  ShortageRadarItem,
  SmartRestockItem,
  SupplyDemandMatchItem,
} from "../types/aiIntelligence.ts";

export const PREVIEW_SHORTAGE_RADAR: ShortageRadarItem[] = [
  {
    id: "preview-shortage-1",
    medicineId: "med-paracetamol-650",
    medicineName: "Paracetamol 650mg Tablet",
    riskCategory: "HIGH",
    riskScore: 0.78,
    pharmacyOrArea: "MP Nagar Zone-I, Bhopal",
    supportingIndicators: [
      "Search demand signals +62% vs 14-day baseline",
      "Only 2 nearby participating pharmacies report eligible stock",
    ],
    forecastPeriod: "Next 7 days",
    confidenceLevel: "MODERATE",
    sampleSufficient: true,
    explanation:
      "Elevated risk flag driven by rising neighborhood search signals alongside tightening nearby eligible stock.",
    explainability: {
      whatWasIdentified: "High near-term shortage risk signal for Paracetamol 650mg.",
      whyIdentified:
        "Anonymized search frequency rose 62% over the trailing 14-day baseline while nearby participating store stock narrowed.",
      supportingMetrics: [
        { label: "Search Signal Change", value: "+62%" },
        { label: "Nearby Participating Stores", value: "2" },
        { label: "Risk Score", value: "0.78 / 1.00" },
      ],
      dataPeriod: "Last 14 days",
      dataFreshnessAt: "2026-11-28T08:30:00Z",
      confidenceLevel: "MODERATE",
      sampleSufficient: true,
      limitations:
        "This is a probabilistic risk indicator based on search demand and participating pharmacy stock, not a guaranteed shortage.",
    },
  },
  {
    id: "preview-shortage-2",
    medicineId: "med-azithromycin-500",
    medicineName: "Azithromycin 500mg Tablet",
    riskCategory: "MODERATE",
    riskScore: 0.52,
    pharmacyOrArea: "Arera Colony, Bhopal",
    supportingIndicators: [
      "Moderate unmet availability searches in last 7 days",
      "4 nearby pharmacies report adequate stock",
    ],
    forecastPeriod: "Next 7 days",
    confidenceLevel: "MODERATE",
    sampleSufficient: true,
    explanation:
      "Moderate localized demand pressure; nearby partner stores still hold eligible stock.",
    explainability: {
      whatWasIdentified: "Moderate demand pressure for Azithromycin 500mg.",
      whyIdentified:
        "Localized unmet search events increased modestly during evening hours.",
      supportingMetrics: [
        { label: "Nearby Participating Stores", value: "4" },
        { label: "Risk Score", value: "0.52 / 1.00" },
      ],
      dataPeriod: "Last 7 days",
      dataFreshnessAt: "2026-11-28T08:30:00Z",
      confidenceLevel: "MODERATE",
      sampleSufficient: true,
      limitations:
        "Reflects anonymized search signals only; does not confirm clinical prescribing volume.",
    },
  },
  {
    id: "preview-shortage-3",
    medicineId: "med-metformin-500",
    medicineName: "Metformin 500mg SR Tablet",
    riskCategory: "INSUFFICIENT_DATA",
    riskScore: null,
    pharmacyOrArea: "Kolar Road, Bhopal",
    supportingIndicators: [
      "Sample count below minimum k-anonymity threshold",
    ],
    forecastPeriod: "Next 7 days",
    confidenceLevel: "INSUFFICIENT",
    sampleSufficient: false,
    explanation:
      "Insufficient historical signals in this area to compute a reliable risk score.",
    explainability: null,
  },
];

export const PREVIEW_SMART_RESTOCK: SmartRestockItem[] = [
  {
    id: "preview-restock-1",
    medicineId: "med-paracetamol-650",
    medicineName: "Paracetamol 650mg Tablet",
    currentEligibleStock: 18,
    suggestedRestockQuantity: 60,
    estimatedCoverageDays: 9,
    recommendationReason:
      "Current non-expired stock is below local search demand pace in MP Nagar.",
    supportingData: [
      "18 eligible units remaining (non-expired)",
      "Elevated anonymized search demand in MP Nagar",
    ],
    demandBasis: "SEARCH_DEMAND",
    confidenceLevel: "MODERATE",
    sampleSufficient: true,
    generatedAt: "2026-11-28T08:30:00Z",
    explainability: {
      whatWasIdentified: "Suggested restock review for Paracetamol 650mg (+60 units).",
      whyIdentified:
        "Eligible stock (18 units) may cover fewer than 4 days at current neighborhood search-demand pace.",
      supportingMetrics: [
        { label: "Current Eligible Stock", value: "18 units" },
        { label: "Suggested Quantity", value: "60 units" },
        { label: "Estimated Coverage", value: "~9 days" },
      ],
      dataPeriod: "Trailing 14 days",
      dataFreshnessAt: "2026-11-28T08:30:00Z",
      confidenceLevel: "MODERATE",
      sampleSufficient: true,
      limitations:
        "Based on anonymized search demand rather than confirmed POS sales. Review manually before ordering.",
    },
  },
];

export const PREVIEW_DEMAND_FORECAST: DemandForecastData = {
  medicineId: "med-paracetamol-650",
  medicineName: "Paracetamol 650mg Tablet",
  area: "MP Nagar",
  horizonDays: 7,
  sampleSufficient: true,
  insufficientHistoryMessage: null,
  dataPeriod: "14-day history + 7-day forecast",
  dataFreshnessAt: "2026-11-28T08:30:00Z",
  modelName: "Seasonal Moving Baseline (Preview)",
  baselineDescription: "Trailing 14-day anonymized search signal moving baseline",
  evaluatedAccuracyPct: null,
  explanation:
    "Future values represent projected anonymized search-demand bands with upper/lower uncertainty bounds, not confirmed sales.",
  historicalPoints: [
    { dateLabel: "Nov 22", observedDemand: 24 },
    { dateLabel: "Nov 23", observedDemand: 28 },
    { dateLabel: "Nov 24", observedDemand: 26 },
    { dateLabel: "Nov 25", observedDemand: 31 },
    { dateLabel: "Nov 26", observedDemand: 35 },
    { dateLabel: "Nov 27", observedDemand: 38 },
    { dateLabel: "Nov 28", observedDemand: 40 },
  ],
  forecastPoints: [
    { dateLabel: "Nov 29", predictedDemand: 42, lowerBound: 34, upperBound: 50 },
    { dateLabel: "Nov 30", predictedDemand: 44, lowerBound: 35, upperBound: 53 },
    { dateLabel: "Dec 01", predictedDemand: 43, lowerBound: 33, upperBound: 54 },
    { dateLabel: "Dec 02", predictedDemand: 45, lowerBound: 34, upperBound: 57 },
  ],
  explainability: {
    whatWasIdentified: "7-day upward search demand projection for Paracetamol 650mg.",
    whyIdentified:
      "Observed search signal volume climbed steadily from 24 to 40 signals/day over the last 7 days.",
    supportingMetrics: [
      { label: "Observed Window", value: "7 days" },
      { label: "Forecast Horizon", value: "7 days" },
    ],
    dataPeriod: "Nov 22 – Dec 02",
    dataFreshnessAt: "2026-11-28T08:30:00Z",
    confidenceLevel: "MODERATE",
    sampleSufficient: true,
    limitations:
      "No evaluated backtest accuracy percentage is published in preview mode. Search demand does not equal confirmed dispensing volume.",
  },
};

export const PREVIEW_SUPPLY_DEMAND_MATCHES: SupplyDemandMatchItem[] = [
  {
    id: "preview-match-1",
    medicineId: "med-paracetamol-650",
    medicineName: "Paracetamol 650mg Tablet",
    demandArea: "MP Nagar Zone-I",
    supplyingPharmacyId: "demo-pharm-2",
    supplyingPharmacyName: "Arogya Medicos (Arera Colony)",
    distanceKm: 3.4,
    transferEligibleAvailability: "AVAILABLE",
    matchExplanation:
      "Supplying partner in Arera Colony holds transfer-eligible stock within 3.4 km of elevated MP Nagar demand.",
    dataFreshnessAt: "2026-11-28T08:30:00Z",
    sampleSufficient: true,
    explainability: {
      whatWasIdentified: "Potential inter-pharmacy transfer match for Paracetamol 650mg.",
      whyIdentified:
        "MP Nagar shows elevated unmet search signals while Arogya Medicos reports transfer-eligible stock.",
      supportingMetrics: [
        { label: "Distance", value: "3.4 km" },
        { label: "Availability", value: "AVAILABLE" },
      ],
      dataPeriod: "Current snapshot",
      dataFreshnessAt: "2026-11-28T08:30:00Z",
      confidenceLevel: "MODERATE",
      sampleSufficient: true,
      limitations:
        "Does not expose private batch numbers or unit costs. Transfer still requires manual request and partner approval.",
    },
  },
];

export const PREVIEW_AI_OVERVIEW: AiOverviewSummary = {
  highRiskMedicineCount: 1,
  restockRecommendationCount: 1,
  forecastHighlights: [
    {
      medicineName: "Paracetamol 650mg Tablet",
      area: "MP Nagar",
      summary: "Projected upward search demand over the next 7 days (uncertainty band 33–57).",
    },
  ],
  supplyDemandOpportunityCount: 1,
  latestUpdates: [
    {
      id: "upd-1",
      category: "SHORTAGE",
      title: "Paracetamol 650mg flagged HIGH risk in MP Nagar Zone-I (not a guaranteed shortage)",
      timestamp: "2026-11-28T08:30:00Z",
    },
    {
      id: "upd-2",
      category: "RESTOCK",
      title: "Smart restock review suggested for Paracetamol 650mg (based on search demand)",
      timestamp: "2026-11-28T08:30:00Z",
    },
  ],
  dataFreshnessAt: "2026-11-28T08:30:00Z",
  sampleSufficient: true,
  insufficiencyReason: null,
};
