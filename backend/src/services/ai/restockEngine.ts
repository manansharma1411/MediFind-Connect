import {
  AI_ALGORITHM_VERSION,
  ConfidenceLevel,
  RestockBasis,
  SmartRestockItem,
} from './aiTypes.js';

export interface RestockInput {
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  currentEligibleStock: number;
  reservedStockExcluded: number;
  expiredStockExcluded: number;
  reorderThreshold: number;
  nearExpiryUnits30d: number;
  observedSalesUnits30d: number | null; // null if no SALE audit movements exist
  areaDemandSignals30d: number;
  latestDataDate: string | null;
  fromDate: string;
  toDate: string;
  todayStr: string;
  minThreshold: number;
  now?: Date;
}

/**
 * Deterministic pharmacy-specific restock recommender.
 * - Never fabricates sales, supplier lead times, or purchase prices.
 * - Explicitly labels recommendations DEMAND_SIGNAL_BASED when actual sales data is unavailable.
 * - Never mutates inventory or creates purchase orders automatically.
 */
export function computeSmartRestock(input: RestockInput): SmartRestockItem {
  const nowIso = (input.now ?? new Date()).toISOString();
  const areaDailyDemandRate =
    Math.round((input.areaDemandSignals30d / 30) * 100) / 100;

  const hasSalesData =
    input.observedSalesUnits30d !== null && input.observedSalesUnits30d > 0;
  const basis: RestockBasis = hasSalesData
    ? 'SALES_AND_DEMAND_BASED'
    : 'DEMAND_SIGNAL_BASED';

  const effectiveDailyRate = hasSalesData
    ? Math.max(input.observedSalesUnits30d! / 30, areaDailyDemandRate * 0.5)
    : areaDailyDemandRate;

  const staleDays = input.latestDataDate
    ? Math.round(
        (Date.parse(`${input.todayStr}T00:00:00Z`) -
          Date.parse(`${input.latestDataDate}T00:00:00Z`)) /
          86400000
      )
    : null;
  const isStale = staleDays !== null && staleDays > 14;

  // Target stock covers 14 days of effective signal/sales rate or at least 2x reorderThreshold
  const targetStock = Math.max(
    input.reorderThreshold * 2,
    Math.ceil(effectiveDailyRate * 14)
  );

  // Suggest restock only if current eligible stock is at/below reorder threshold or below 7-day coverage
  const sevenDayNeed = Math.ceil(effectiveDailyRate * 7);
  const needsRestock =
    input.currentEligibleStock <= input.reorderThreshold ||
    (input.areaDemandSignals30d >= input.minThreshold &&
      input.currentEligibleStock < sevenDayNeed);

  const suggestedRestockQuantity = needsRestock
    ? Math.max(0, targetStock - input.currentEligibleStock)
    : 0;

  const estimatedCoverageDays =
    effectiveDailyRate > 0
      ? Math.round((input.currentEligibleStock / effectiveDailyRate) * 10) / 10
      : null;

  let confidence: ConfidenceLevel = 'LOW';
  if (input.areaDemandSignals30d < input.minThreshold && !hasSalesData) {
    confidence = 'INSUFFICIENT';
  } else if (!isStale && hasSalesData && input.areaDemandSignals30d >= input.minThreshold * 2) {
    confidence = 'HIGH';
  } else if (!isStale && input.areaDemandSignals30d >= input.minThreshold) {
    confidence = 'MODERATE';
  }

  const limitations: string[] = [
    'Review required by pharmacy staff; no purchase order or inventory adjustment is performed automatically.',
    'Supplier lead time and purchase prices are not modeled because verified supplier-lead-time data is not available.',
  ];
  if (!hasSalesData) {
    limitations.push(
      'No confirmed SALE movement history found for this medicine; recommendation is strictly DEMAND_SIGNAL_BASED.'
    );
  }

  const hasSufficientAreaDemand = input.areaDemandSignals30d >= input.minThreshold;
  const demandAvailabilityStatus =
    input.areaDemandSignals30d === 0
      ? 'ZERO_DEMAND'
      : hasSufficientAreaDemand
        ? 'SUFFICIENT'
        : 'SUPPRESSED_BELOW_THRESHOLD';

  const exposedAreaDailyRate = hasSufficientAreaDemand ? areaDailyDemandRate : null;

  return {
    pharmacyId: input.pharmacyId,
    medicineId: input.medicineId,
    medicineName: input.medicineName,
    currentEligibleStock: input.currentEligibleStock,
    reservedStockExcluded: input.reservedStockExcluded,
    expiredStockExcluded: input.expiredStockExcluded,
    reorderThreshold: input.reorderThreshold,
    suggestedRestockQuantity,
    estimatedCoverageDays,
    basis,
    supportingMetrics: {
      demandAvailabilityStatus,
      observedSalesUnits30d: input.observedSalesUnits30d,
      areaDailyDemandRate: exposedAreaDailyRate,
      nearExpiryUnits30d: input.nearExpiryUnits30d,
      leadTimeDaysUsed: null, // Never invented
    },
    reviewRequired: true,
    algorithmVersion: AI_ALGORITHM_VERSION,
    generatedAt: nowIso,
    explanation: {
      summary:
        suggestedRestockQuantity > 0
          ? `Suggested reviewing a restock of ${suggestedRestockQuantity} units for ${input.medicineName} (${basis}).`
          : `Current eligible stock (${input.currentEligibleStock}) is sufficient relative to threshold (${input.reorderThreshold}).`,
      whatWasIdentified:
        suggestedRestockQuantity > 0
          ? `Restock review candidate: +${suggestedRestockQuantity} units (${basis}).`
          : 'No immediate restock needed.',
      whyIdentified: hasSufficientAreaDemand
        ? `Eligible stock is ${input.currentEligibleStock} units (excluding ${input.reservedStockExcluded} reserved and ${input.expiredStockExcluded} expired), threshold is ${input.reorderThreshold}, and area demand rate is ${areaDailyDemandRate}/day.`
        : `Eligible stock is ${input.currentEligibleStock} units (excluding ${input.reservedStockExcluded} reserved and ${input.expiredStockExcluded} expired), threshold is ${input.reorderThreshold}; area demand signals are below the privacy threshold (${input.minThreshold}) and suppressed.`,
      influencingMetrics: {
        currentEligibleStock: input.currentEligibleStock,
        reorderThreshold: input.reorderThreshold,
        areaDemandSignals30d: hasSufficientAreaDemand ? input.areaDemandSignals30d : null,
        observedSalesUnits30d: input.observedSalesUnits30d,
        suggestedRestockQuantity,
      },
      reportingPeriod: { fromDate: input.fromDate, toDate: input.toDate },
      dataFreshness: {
        latestDataDate: input.latestDataDate,
        isStale,
        staleReason: isStale ? `Latest demand bucket is ${staleDays} days old.` : null,
      },
      confidence,
      limitations,
      explanationSource: 'DETERMINISTIC',
    },
  };
}
