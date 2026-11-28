import type {
  AiConfidenceLevel,
  DemandForecastData,
  ExplainableMetadata,
  PaginationMeta,
  ShortageRadarItem,
  ShortageRiskCategory,
  SmartRestockItem,
  SupplyDemandMatchItem,
} from "../types/aiIntelligence.ts";

export interface BackendExplainability {
  summary?: string | null;
  confidence?: string | null;
  whatWasIdentified?: string | null;
  whyIdentified?: string | null;
  influencingMetrics?: Array<{
    label?: string | null;
    value?: string | number | null;
  }> | null;
  reportingPeriod?: string | null;
  dataFreshness?: {
    latestDataDate?: string | null;
  } | null;
  limitations?: string[] | string | null;
}

export interface BackendPaginatedResponse<T> {
  items?: T[] | null;
  pagination?: PaginationMeta | null;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export function extractPaginatedItems<T>(
  raw: BackendPaginatedResponse<T> | T[] | null | undefined
): { items: T[]; pagination?: PaginationMeta } {
  if (!raw) return { items: [] };
  if (Array.isArray(raw)) return { items: raw };

  const items = Array.isArray(raw.items) ? raw.items : [];
  const pagination: PaginationMeta | undefined = raw.pagination
    ? { ...raw.pagination }
    : typeof raw.total === "number" || typeof raw.page === "number"
    ? {
        page: raw.page,
        pageSize: raw.pageSize,
        total: raw.total,
        totalPages: raw.totalPages,
      }
    : undefined;

  return { items, pagination };
}

export function normalizeRiskCategory(
  value: string | null | undefined
): ShortageRiskCategory {
  switch (String(value ?? "").toUpperCase()) {
    case "LOW":
      return "LOW";
    case "MODERATE":
      return "MODERATE";
    case "HIGH":
      return "HIGH";
    case "INSUFFICIENT_DATA":
    default:
      return "INSUFFICIENT_DATA";
  }
}

export function normalizeConfidenceLevel(
  value: string | null | undefined
): AiConfidenceLevel {
  switch (String(value ?? "").toUpperCase()) {
    case "HIGH":
      return "HIGH";
    case "MODERATE":
      return "MODERATE";
    case "LOW":
      return "LOW";
    case "INSUFFICIENT":
    default:
      return "INSUFFICIENT";
  }
}

export function normalizeDemandBasis(
  value: string | null | undefined
): SmartRestockItem["demandBasis"] {
  switch (String(value ?? "").toUpperCase()) {
    case "SALES_AND_DEMAND_BASED":
    case "CONSUMPTION_AND_DEMAND":
      return "CONSUMPTION_AND_DEMAND";
    case "DEMAND_SIGNAL_BASED":
    case "SEARCH_DEMAND":
      return "SEARCH_DEMAND";
    default:
      return "UNKNOWN";
  }
}

export function normalizeTransferAvailability(
  value: string | null | undefined
): SupplyDemandMatchItem["transferEligibleAvailability"] {
  switch (String(value ?? "").toUpperCase()) {
    case "ELIGIBLE_HIGH":
    case "AVAILABLE":
      return "AVAILABLE";
    case "ELIGIBLE_LIMITED":
    case "LIMITED":
      return "LIMITED";
    default:
      return "UNCONFIRMED";
  }
}

export function formatFreshnessDate(iso: string | null | undefined): string {
  if (!iso) return "Freshness unavailable";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleString();
}

export function mapExplainabilityFromBackend(
  exp: BackendExplainability | null | undefined,
  sampleSufficient: boolean
): ExplainableMetadata | null {
  if (!exp) return null;

  const limitations = Array.isArray(exp.limitations)
    ? exp.limitations.filter(Boolean).join(" ")
    : exp.limitations ?? "";

  const supportingMetrics = Array.isArray(exp.influencingMetrics)
    ? exp.influencingMetrics
        .filter((m) => m && m.label)
        .map((m) => ({
          label: String(m.label),
          value: m.value !== null && m.value !== undefined ? String(m.value) : "—",
        }))
    : [];

  return {
    whatWasIdentified: exp.whatWasIdentified ?? exp.summary ?? "",
    whyIdentified: exp.whyIdentified ?? "",
    supportingMetrics,
    dataPeriod: exp.reportingPeriod ?? "",
    dataFreshnessAt: exp.dataFreshness?.latestDataDate ?? "",
    confidenceLevel: normalizeConfidenceLevel(exp.confidence),
    sampleSufficient,
    limitations,
  };
}

export interface BackendShortageItem {
  medicineId: string;
  medicineName?: string | null;
  riskCategory?: string | null;
  riskScore?: number | null;
  area?: string | null;
  city?: string | null;
  supportingIndicators?: string[] | null;
  forecastPeriod?: string | null;
  explanation?: BackendExplainability | null;
}

export function mapShortageItem(item: BackendShortageItem): ShortageRadarItem {
  const riskCategory = normalizeRiskCategory(item.riskCategory);
  const sampleSufficient = riskCategory !== "INSUFFICIENT_DATA";
  const confidenceLevel = normalizeConfidenceLevel(item.explanation?.confidence);
  const pharmacyOrArea =
    [item.area, item.city].filter((v) => Boolean(v && v.trim())).join(", ") ||
    "Area not specified";

  const supportingIndicators = Array.isArray(item.supportingIndicators)
    ? item.supportingIndicators
    : Array.isArray(item.explanation?.influencingMetrics)
    ? item.explanation!.influencingMetrics!
        .filter((m) => m && m.label)
        .map((m) => `${m.label}: ${m.value ?? "—"}`)
    : [];

  return {
    id: item.medicineId,
    medicineId: item.medicineId,
    medicineName: item.medicineName ?? "Unknown Medicine",
    riskCategory,
    riskScore: typeof item.riskScore === "number" ? item.riskScore : null,
    pharmacyOrArea,
    supportingIndicators,
    forecastPeriod:
      item.forecastPeriod ?? item.explanation?.reportingPeriod ?? "—",
    confidenceLevel,
    sampleSufficient,
    explanation: item.explanation?.summary ?? "",
    explainability: mapExplainabilityFromBackend(
      item.explanation,
      sampleSufficient
    ),
  };
}

export interface BackendRestockItem {
  medicineId: string;
  medicineName?: string | null;
  currentEligibleStock?: number | null;
  suggestedRestockQuantity?: number | null;
  estimatedCoverageDays?: number | null;
  demandBasis?: string | null;
  supportingData?: string[] | null;
  generatedAt?: string | null;
  explanation?: BackendExplainability | null;
}

export function mapRestockItem(item: BackendRestockItem): SmartRestockItem {
  const confidenceLevel = normalizeConfidenceLevel(item.explanation?.confidence);
  const sampleSufficient = confidenceLevel !== "INSUFFICIENT";

  const supportingData = Array.isArray(item.supportingData)
    ? item.supportingData
    : Array.isArray(item.explanation?.influencingMetrics)
    ? item.explanation!.influencingMetrics!
        .filter((m) => m && m.label)
        .map((m) => `${m.label}: ${m.value ?? "—"}`)
    : [];

  return {
    id: item.medicineId,
    medicineId: item.medicineId,
    medicineName: item.medicineName ?? "Unknown Medicine",
    currentEligibleStock:
      typeof item.currentEligibleStock === "number"
        ? item.currentEligibleStock
        : null,
    suggestedRestockQuantity:
      typeof item.suggestedRestockQuantity === "number"
        ? item.suggestedRestockQuantity
        : null,
    estimatedCoverageDays:
      typeof item.estimatedCoverageDays === "number"
        ? item.estimatedCoverageDays
        : null,
    recommendationReason: item.explanation?.summary ?? "",
    supportingData,
    demandBasis: normalizeDemandBasis(item.demandBasis),
    confidenceLevel,
    sampleSufficient,
    generatedAt:
      item.generatedAt ??
      item.explanation?.dataFreshness?.latestDataDate ??
      "",
    explainability: mapExplainabilityFromBackend(
      item.explanation,
      sampleSufficient
    ),
  };
}

export interface BackendForecastResponse {
  medicineId: string;
  medicineName?: string | null;
  area?: string | null;
  horizonPeriods?: number | null;
  status?: string | null;
  insufficientHistoryMessage?: string | null;
  modelName?: string | null;
  baselineDescription?: string | null;
  evaluatedAccuracyPct?: number | null;
  historicalObservations?: Array<{
    periodStart?: string | null;
    dateLabel?: string | null;
    observedDemandSignals?: number | null;
    observedDemand?: number | null;
  }> | null;
  historicalPoints?: Array<{
    periodStart?: string | null;
    dateLabel?: string | null;
    observedDemandSignals?: number | null;
    observedDemand?: number | null;
  }> | null;
  predictions?: Array<{
    periodStart?: string | null;
    predictedDemandSignals?: number | null;
    lowerBound?: number | null;
    upperBound?: number | null;
  }> | null;
  explanation?: BackendExplainability | null;
}

export function mapForecastResponse(
  raw: BackendForecastResponse
): DemandForecastData {
  const sampleSufficient = raw.status === "READY";
  const rawHistory = raw.historicalObservations ?? raw.historicalPoints ?? [];
  const rawPredictions = raw.predictions ?? [];

  const historicalPoints = rawHistory.map((h) => ({
    dateLabel: h.periodStart ?? h.dateLabel ?? "",
    observedDemand:
      typeof h.observedDemandSignals === "number"
        ? h.observedDemandSignals
        : typeof h.observedDemand === "number"
        ? h.observedDemand
        : 0,
  }));

  const forecastPoints = rawPredictions.map((p) => ({
    dateLabel: p.periodStart ?? "",
    predictedDemand:
      typeof p.predictedDemandSignals === "number"
        ? p.predictedDemandSignals
        : 0,
    lowerBound: typeof p.lowerBound === "number" ? p.lowerBound : null,
    upperBound: typeof p.upperBound === "number" ? p.upperBound : null,
  }));

  return {
    medicineId: raw.medicineId,
    medicineName: raw.medicineName ?? "Unknown Medicine",
    area: raw.area ?? "All Areas",
    horizonDays: typeof raw.horizonPeriods === "number" ? raw.horizonPeriods : 0,
    sampleSufficient,
    insufficientHistoryMessage:
      raw.insufficientHistoryMessage ??
      (!sampleSufficient ? raw.explanation?.summary ?? null : null),
    dataPeriod: raw.explanation?.reportingPeriod ?? "",
    dataFreshnessAt: raw.explanation?.dataFreshness?.latestDataDate ?? "",
    modelName: raw.modelName ?? "Search-Demand Baseline",
    baselineDescription: raw.baselineDescription ?? "",
    evaluatedAccuracyPct:
      typeof raw.evaluatedAccuracyPct === "number"
        ? raw.evaluatedAccuracyPct
        : null,
    explanation: raw.explanation?.summary ?? "",
    historicalPoints,
    forecastPoints,
    explainability: mapExplainabilityFromBackend(
      raw.explanation,
      sampleSufficient
    ),
  };
}

export interface BackendMatchItem {
  medicineId: string;
  medicineName?: string | null;
  requestingArea?: string | null;
  supplyingPharmacyId: string;
  supplyingPharmacyName?: string | null;
  distanceKm?: number | null;
  transferEligibleAvailability?: string | null;
  explanation?: BackendExplainability | null;
}

export function mapMatchItem(m: BackendMatchItem): SupplyDemandMatchItem {
  const confidenceLevel = normalizeConfidenceLevel(m.explanation?.confidence);
  const sampleSufficient = confidenceLevel !== "INSUFFICIENT";

  return {
    id: `${m.medicineId}-${m.supplyingPharmacyId}`,
    medicineId: m.medicineId,
    medicineName: m.medicineName ?? "Unknown Medicine",
    demandArea: m.requestingArea ?? "",
    supplyingPharmacyId: m.supplyingPharmacyId,
    supplyingPharmacyName: m.supplyingPharmacyName ?? "Partner Pharmacy",
    distanceKm: typeof m.distanceKm === "number" ? m.distanceKm : null,
    transferEligibleAvailability: normalizeTransferAvailability(
      m.transferEligibleAvailability
    ),
    matchExplanation: m.explanation?.summary ?? "",
    dataFreshnessAt: m.explanation?.dataFreshness?.latestDataDate ?? "",
    sampleSufficient,
    explainability: mapExplainabilityFromBackend(
      m.explanation,
      sampleSufficient
    ),
  };
}

export function getShortageRiskMeta(category: ShortageRiskCategory): {
  label: string;
  badgeVariant: "success" | "warning" | "error" | "neutral";
} {
  switch (category) {
    case "HIGH":
      return { label: "High Risk", badgeVariant: "error" };
    case "MODERATE":
      return { label: "Moderate Risk", badgeVariant: "warning" };
    case "LOW":
      return { label: "Low Risk", badgeVariant: "success" };
    case "INSUFFICIENT_DATA":
    default:
      return { label: "Insufficient Data", badgeVariant: "neutral" };
  }
}

export function getConfidenceBadgeMeta(level: AiConfidenceLevel): {
  label: string;
  variant: "success" | "info" | "warning" | "neutral";
} {
  switch (level) {
    case "HIGH":
      return { label: "High Confidence", variant: "success" };
    case "MODERATE":
      return { label: "Moderate Confidence", variant: "info" };
    case "LOW":
      return { label: "Low Confidence", variant: "warning" };
    case "INSUFFICIENT":
    default:
      return { label: "Insufficient Sample", variant: "neutral" };
  }
}

export function getDemandBasisLabel(
  basis: "SEARCH_DEMAND" | "CONSUMPTION_AND_DEMAND" | "UNKNOWN"
): string {
  if (basis === "CONSUMPTION_AND_DEMAND") {
    return "Based on consumption & search demand";
  }
  if (basis === "SEARCH_DEMAND") {
    return "Based on anonymized search demand (POS sales unavailable)";
  }
  return "Demand basis unavailable";
}

export function getForecastChartMaxDomain(forecast: DemandForecastData): number {
  const values: number[] = [];
  for (const h of forecast.historicalPoints) {
    values.push(h.observedDemand);
  }
  for (const f of forecast.forecastPoints) {
    values.push(f.predictedDemand);
    if (typeof f.upperBound === "number") values.push(f.upperBound);
  }
  const maxVal = values.length > 0 ? Math.max(...values) : 10;
  return maxVal <= 0 ? 10 : Math.ceil(maxVal * 1.15);
}

export function buildTransferRequestHref(params: {
  medicineId: string;
  supplyingPharmacyId: string;
}): string {
  const qs = new URLSearchParams({
    medicineId: params.medicineId,
    targetPharmacyId: params.supplyingPharmacyId,
  });
  return `/collaboration/request?${qs.toString()}`;
}
