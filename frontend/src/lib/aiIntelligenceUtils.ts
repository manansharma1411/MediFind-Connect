import type {
  AiConfidenceLevel,
  DemandForecastData,
  ShortageRiskCategory,
} from "../types/aiIntelligence.ts";

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
  basis: "SEARCH_DEMAND" | "CONSUMPTION_AND_DEMAND"
): string {
  return basis === "SEARCH_DEMAND"
    ? "Based on anonymized search demand (POS sales unavailable)"
    : "Based on consumption & search demand";
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
