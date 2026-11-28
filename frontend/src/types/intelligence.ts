export type DemandPeriodGrouping = "day" | "week";

export type UnmetDemandCategory =
  | "NO_MEDICINE_MATCH"
  | "NO_ELIGIBLE_STOCK"
  | "PARTIAL_AVAILABILITY";

export interface DemandOverviewSummary {
  popularSearchCount: number;
  unmetSignalCount: number;
  localSupplyIndex: number;
  demandChangePercent: number | null;
  reportingPeriodLabel: string;
  dataFreshnessAt: string;
  sampleSufficient: boolean;
  minimumThresholdNote: string | null;
  topSearchedMedicines: Array<{
    medicineId: string;
    medicineName: string;
    searchSignals: number;
    availableStoreCount: number;
  }>;
  demandVsSupply: Array<{
    label: string;
    demandSignals: number;
    localSupplyUnits: number;
  }>;
  recentTrends: Array<{
    periodLabel: string;
    searchSignals: number;
    unmetSignals: number;
  }>;
  areaSummary: Array<{
    area: string;
    searchSignals: number;
    unmetSignals: number;
  }>;
}

export interface MedicineDemandTrendPoint {
  periodLabel: string;
  searchSignals: number;
  matchedCount: number;
  partialCount: number;
  unmetCount: number;
  localSupplyStores: number;
}

export interface MedicineDemandSeries {
  medicineId: string;
  medicineName: string;
  area: string;
  grouping: DemandPeriodGrouping;
  sampleSufficient: boolean;
  minimumThresholdNote: string | null;
  dataFreshnessAt: string;
  points: MedicineDemandTrendPoint[];
}

export interface UnmetDemandSignal {
  id: string;
  medicineName: string;
  area: string;
  category: UnmetDemandCategory;
  aggregatedDemandIndicator: number;
  reportingPeriod: string;
  dataFreshnessAt: string;
  eligibleLocalSupplyCount: number | null;
  sampleSufficient: boolean;
}

export interface AreaDemandInsight {
  area: string;
  city: string;
  pincode: string;
  searchSignals: number;
  unmetSignals: number;
  supplyIndicatorCount: number;
  popularMedicines: string[];
  hasReliableGeoMapping: boolean;
  sampleSufficient: boolean;
  dataFreshnessAt: string;
}
