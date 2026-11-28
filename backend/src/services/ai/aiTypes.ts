export const AI_ALGORITHM_VERSION = 'v1.0.0-deterministic';

export type ShortageRiskCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'INSUFFICIENT_DATA';
export type ConfidenceLevel = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';
export type RestockBasis = 'SALES_AND_DEMAND_BASED' | 'DEMAND_SIGNAL_BASED';
export type DemandAvailabilityStatus =
  | 'ZERO_DEMAND'
  | 'SUPPRESSED_BELOW_THRESHOLD'
  | 'SUFFICIENT';
export type SupplyAvailabilityStatus = 'NONE' | 'AVAILABLE' | 'SUPPRESSED';

export interface AiExplanation {
  summary: string;
  whatWasIdentified: string;
  whyIdentified: string;
  influencingMetrics: Record<string, number | string | boolean | null>;
  reportingPeriod: {
    fromDate: string;
    toDate: string;
  };
  dataFreshness: {
    latestDataDate: string | null;
    isStale: boolean;
    staleReason: string | null;
  };
  confidence: ConfidenceLevel;
  limitations: string[];
  explanationSource: 'DETERMINISTIC' | 'LLM_VERIFIED_WITH_DETERMINISTIC_GUARD';
}

export interface ShortageRadarItem {
  medicineId: string;
  medicineName: string;
  scope: 'AREA';
  area: string;
  city: string;
  riskCategory: ShortageRiskCategory;
  riskScore: number | null; // 0.00 - 1.00, null when INSUFFICIENT_DATA
  estimatedRiskPeriodDays: number | null;
  supportingIndicators: {
    demandAvailabilityStatus: DemandAvailabilityStatus;
    supplyAvailabilityStatus: SupplyAvailabilityStatus;
    recentDemandSignals: number | null;
    priorDemandSignals: number | null;
    demandGrowthRatePercent: number | null;
    unmetDemandSignals: number | null;
    unmetDemandRatio: number | null;
    eligibleSupplyAvailable: number | null;
    reservedStockExcluded: number | null;
    expiredBatchesExcluded: number | null;
    nearExpiryUnitsCount: number | null;
    participatingPharmaciesCount: number | null;
  };
  algorithmVersion: string;
  generatedAt: string;
  explanation: AiExplanation;
}

export interface SmartRestockItem {
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  currentEligibleStock: number;
  reservedStockExcluded: number;
  expiredStockExcluded: number;
  reorderThreshold: number;
  suggestedRestockQuantity: number;
  estimatedCoverageDays: number | null;
  basis: RestockBasis;
  supportingMetrics: {
    demandAvailabilityStatus: DemandAvailabilityStatus;
    observedSalesUnits30d: number | null;
    areaDailyDemandRate: number | null;
    nearExpiryUnits30d: number;
    leadTimeDaysUsed: number | null; // null unless actual data exists
  };
  reviewRequired: true; // Never auto-creates POs or mutates inventory
  algorithmVersion: string;
  generatedAt: string;
  explanation: AiExplanation;
}

export interface ForecastPoint {
  periodStart: string;
  predictedDemandSignals: number;
  lowerBound: number;
  upperBound: number;
}

export interface ForecastEvaluationMetrics {
  status: 'EVALUATED' | 'INSUFFICIENT_DATA';
  modelName: string;
  baselineName: string;
  mae: number | null;
  rmse: number | null;
  mapePercent: number | null; // null if any actual === 0
  baselineMae: number | null;
  baselineRmse: number | null;
  beatsBaselineOnMae: boolean | null;
  evaluatedPoints: number;
}

export interface DemandForecastResult {
  medicineId: string;
  medicineName: string | null;
  area: string;
  granularity: 'day' | 'week';
  horizonPeriods: number;
  status: 'READY' | 'INSUFFICIENT_DATA';
  historicalBucketsCount: number;
  baselineAverageSignals: number | null;
  predictions: ForecastPoint[];
  evaluation: ForecastEvaluationMetrics;
  algorithmVersion: string;
  generatedAt: string;
  explanation: AiExplanation;
}

export interface SupplyDemandMatchItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  requestingArea: string;
  areaDemandSignals: number;
  areaUnmetSignals: number | null;
  supplyingPharmacyId: string;
  supplyingPharmacyName: string;
  supplyingArea: string;
  supplyingCity: string;
  distanceKm: number | null;
  availabilityBand: 'ELIGIBLE_HIGH' | 'ELIGIBLE_LIMITED';
  sellingPrice: number;
  mrp: number;
  collaborationWorkflowEndpoint: '/api/v1/collaboration/transfers';
  autoCreated: false; // Never auto-creates or auto-approves transfers
  algorithmVersion: string;
  generatedAt: string;
  explanation: AiExplanation;
}
