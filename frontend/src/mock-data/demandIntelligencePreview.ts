import type {
  AreaDemandInsight,
  DemandOverviewSummary,
  MedicineDemandSeries,
  UnmetDemandSignal,
} from "../types/intelligence.ts";

/**
 * Isolated sample data for UI Preview Mode ONLY.
 * All figures represent aggregated search signals (never confirmed sales or patient PII).
 */

export const PREVIEW_DEMAND_OVERVIEW: DemandOverviewSummary = {
  popularSearchCount: 148,
  unmetSignalCount: 27,
  localSupplyIndex: 76,
  demandChangePercent: 12.4,
  reportingPeriodLabel: "Last 7 Days (Preview)",
  dataFreshnessAt: "2026-11-28T07:30:00.000Z",
  sampleSufficient: true,
  minimumThresholdNote:
    "Aggregated at area level (minimum k=10 search signals enforced).",
  topSearchedMedicines: [
    {
      medicineId: "demo-med-1",
      medicineName: "Paracetamol 650 mg",
      searchSignals: 64,
      availableStoreCount: 4,
    },
    {
      medicineId: "demo-med-2",
      medicineName: "Amoxicillin + Clavulanic Acid 625 mg",
      searchSignals: 42,
      availableStoreCount: 2,
    },
    {
      medicineId: "demo-med-3",
      medicineName: "Pantoprazole + Domperidone SR",
      searchSignals: 25,
      availableStoreCount: 3,
    },
    {
      medicineId: "demo-med-4",
      medicineName: "Azithromycin 500 mg",
      searchSignals: 17,
      availableStoreCount: 1,
    },
  ],
  demandVsSupply: [
    { label: "Paracetamol 650", demandSignals: 64, localSupplyUnits: 92 },
    { label: "Augmentin 625", demandSignals: 42, localSupplyUnits: 18 },
    { label: "Pan-D", demandSignals: 25, localSupplyUnits: 38 },
    { label: "Azithral 500", demandSignals: 17, localSupplyUnits: 6 },
  ],
  recentTrends: [
    { periodLabel: "Mon", searchSignals: 18, unmetSignals: 3 },
    { periodLabel: "Tue", searchSignals: 21, unmetSignals: 4 },
    { periodLabel: "Wed", searchSignals: 19, unmetSignals: 3 },
    { periodLabel: "Thu", searchSignals: 24, unmetSignals: 5 },
    { periodLabel: "Fri", searchSignals: 26, unmetSignals: 6 },
    { periodLabel: "Sat", searchSignals: 22, unmetSignals: 4 },
    { periodLabel: "Sun", searchSignals: 18, unmetSignals: 2 },
  ],
  areaSummary: [
    { area: "MP Nagar Zone-I", searchSignals: 68, unmetSignals: 11 },
    { area: "Arera Colony", searchSignals: 49, unmetSignals: 9 },
    { area: "New Market", searchSignals: 31, unmetSignals: 7 },
  ],
};

export const PREVIEW_MEDICINE_TRENDS: MedicineDemandSeries = {
  medicineId: "demo-med-1",
  medicineName: "Paracetamol 650 mg (Preview)",
  area: "MP Nagar Zone-I",
  grouping: "day",
  sampleSufficient: true,
  minimumThresholdNote: null,
  dataFreshnessAt: "2026-11-28T07:30:00.000Z",
  points: [
    {
      periodLabel: "Nov 22",
      searchSignals: 12,
      matchedCount: 9,
      partialCount: 2,
      unmetCount: 1,
      localSupplyStores: 4,
    },
    {
      periodLabel: "Nov 23",
      searchSignals: 15,
      matchedCount: 11,
      partialCount: 3,
      unmetCount: 1,
      localSupplyStores: 4,
    },
    {
      periodLabel: "Nov 24",
      searchSignals: 14,
      matchedCount: 10,
      partialCount: 2,
      unmetCount: 2,
      localSupplyStores: 3,
    },
    {
      periodLabel: "Nov 25",
      searchSignals: 19,
      matchedCount: 12,
      partialCount: 4,
      unmetCount: 3,
      localSupplyStores: 3,
    },
    {
      periodLabel: "Nov 26",
      searchSignals: 16,
      matchedCount: 12,
      partialCount: 3,
      unmetCount: 1,
      localSupplyStores: 4,
    },
  ],
};

export const PREVIEW_UNMET_SIGNALS: UnmetDemandSignal[] = [
  {
    id: "unmet-1",
    medicineName: "Azithromycin 500 mg",
    area: "MP Nagar Zone-I",
    category: "NO_ELIGIBLE_STOCK",
    aggregatedDemandIndicator: 14,
    reportingPeriod: "Last 7 Days",
    dataFreshnessAt: "2026-11-28T07:30:00.000Z",
    eligibleLocalSupplyCount: 0,
    sampleSufficient: true,
  },
  {
    id: "unmet-2",
    medicineName: "Amoxicillin + Clavulanic Acid 625 mg",
    area: "Arera Colony",
    category: "PARTIAL_AVAILABILITY",
    aggregatedDemandIndicator: 12,
    reportingPeriod: "Last 7 Days",
    dataFreshnessAt: "2026-11-28T07:30:00.000Z",
    eligibleLocalSupplyCount: 1,
    sampleSufficient: true,
  },
  {
    id: "unmet-3",
    medicineName: "Unmapped Generic Formulation",
    area: "New Market",
    category: "NO_MEDICINE_MATCH",
    aggregatedDemandIndicator: 11,
    reportingPeriod: "Last 7 Days",
    dataFreshnessAt: "2026-11-28T07:30:00.000Z",
    eligibleLocalSupplyCount: null,
    sampleSufficient: true,
  },
];

export const PREVIEW_AREA_INSIGHTS: AreaDemandInsight[] = [
  {
    area: "MP Nagar Zone-I",
    city: "Bhopal",
    pincode: "462011",
    searchSignals: 68,
    unmetSignals: 11,
    supplyIndicatorCount: 4,
    popularMedicines: ["Paracetamol 650 mg", "Augmentin 625 Duo"],
    hasReliableGeoMapping: false,
    sampleSufficient: true,
    dataFreshnessAt: "2026-11-28T07:30:00.000Z",
  },
  {
    area: "Arera Colony",
    city: "Bhopal",
    pincode: "462016",
    searchSignals: 49,
    unmetSignals: 9,
    supplyIndicatorCount: 3,
    popularMedicines: ["Pan-D", "Paracetamol 650 mg"],
    hasReliableGeoMapping: false,
    sampleSufficient: true,
    dataFreshnessAt: "2026-11-28T07:30:00.000Z",
  },
];
