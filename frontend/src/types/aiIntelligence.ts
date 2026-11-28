export type ShortageRiskCategory =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "INSUFFICIENT_DATA";

export type AiConfidenceLevel = "INSUFFICIENT" | "LOW" | "MODERATE" | "HIGH";

export interface ExplainableMetadata {
  whatWasIdentified: string;
  whyIdentified: string;
  supportingMetrics: Array<{ label: string; value: string }>;
  dataPeriod: string;
  dataFreshnessAt: string;
  confidenceLevel: AiConfidenceLevel;
  sampleSufficient: boolean;
  limitations: string;
}

export interface ShortageRadarItem {
  id: string;
  medicineId: string;
  medicineName: string;
  riskCategory: ShortageRiskCategory;
  riskScore: number | null; // 0..1 when available
  pharmacyOrArea: string;
  supportingIndicators: string[];
  forecastPeriod: string;
  confidenceLevel: AiConfidenceLevel;
  sampleSufficient: boolean;
  explanation: string;
  explainability: ExplainableMetadata | null;
}

export interface SmartRestockItem {
  id: string;
  medicineId: string;
  medicineName: string;
  currentEligibleStock: number;
  suggestedRestockQuantity: number;
  estimatedCoverageDays: number | null;
  recommendationReason: string;
  supportingData: string[];
  demandBasis: "SEARCH_DEMAND" | "CONSUMPTION_AND_DEMAND";
  confidenceLevel: AiConfidenceLevel;
  sampleSufficient: boolean;
  generatedAt: string;
  explainability: ExplainableMetadata | null;
}

export interface ForecastObservationPoint {
  dateLabel: string;
  observedDemand: number;
}

export interface ForecastPredictionPoint {
  dateLabel: string;
  predictedDemand: number;
  lowerBound: number | null;
  upperBound: number | null;
}

export interface DemandForecastData {
  medicineId: string;
  medicineName: string;
  area: string;
  horizonDays: number;
  sampleSufficient: boolean;
  insufficientHistoryMessage: string | null;
  dataPeriod: string;
  dataFreshnessAt: string;
  modelName: string;
  baselineDescription: string;
  evaluatedAccuracyPct: number | null;
  explanation: string;
  historicalPoints: ForecastObservationPoint[];
  forecastPoints: ForecastPredictionPoint[];
  explainability: ExplainableMetadata | null;
}

export interface SupplyDemandMatchItem {
  id: string;
  medicineId: string;
  medicineName: string;
  demandArea: string;
  supplyingPharmacyId: string;
  supplyingPharmacyName: string;
  distanceKm: number | null;
  transferEligibleAvailability: "AVAILABLE" | "LIMITED" | "UNCONFIRMED";
  matchExplanation: string;
  dataFreshnessAt: string;
  sampleSufficient: boolean;
  explainability: ExplainableMetadata | null;
}

export interface AiOverviewSummary {
  highRiskMedicineCount: number | null;
  restockRecommendationCount: number | null;
  forecastHighlights: Array<{
    medicineName: string;
    area: string;
    summary: string;
  }>;
  supplyDemandOpportunityCount: number | null;
  latestUpdates: Array<{
    id: string;
    category: "SHORTAGE" | "RESTOCK" | "FORECAST" | "MATCHING";
    title: string;
    timestamp: string;
  }>;
  dataFreshnessAt: string | null;
  sampleSufficient: boolean;
  insufficiencyReason: string | null;
}
