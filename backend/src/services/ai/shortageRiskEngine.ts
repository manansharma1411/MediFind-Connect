import {
  AI_ALGORITHM_VERSION,
  ConfidenceLevel,
  ShortageRadarItem,
  ShortageRiskCategory,
} from './aiTypes.js';

export interface ShortageRiskInput {
  medicineId: string;
  medicineName: string;
  area: string;
  city: string;
  recentDemandSignals: number;
  priorDemandSignals: number;
  unmetDemandSignals: number;
  eligibleSupplyAvailable: number;
  reservedStockExcluded: number;
  expiredBatchesExcluded: number;
  nearExpiryUnitsCount: number;
  participatingPharmaciesCount: number;
  latestDataDate: string | null;
  fromDate: string;
  toDate: string;
  todayStr: string;
  minThreshold: number;
  now?: Date;
}

/**
 * Multi-factor deterministic shortage risk scorer.
 * Never uses search volume alone; weighs demand growth, unmet ratio,
 * eligible supply coverage, and near-expiry pressure.
 */
export function evaluateShortageRisk(input: ShortageRiskInput): ShortageRadarItem {
  const nowIso = (input.now ?? new Date()).toISOString();
  const staleDays = input.latestDataDate
    ? Math.round(
        (Date.parse(`${input.todayStr}T00:00:00Z`) -
          Date.parse(`${input.latestDataDate}T00:00:00Z`)) /
          86400000
      )
    : null;
  const isStale = staleDays !== null && staleDays > 14;

  const unmetRatio =
    input.recentDemandSignals > 0
      ? Math.round((input.unmetDemandSignals / input.recentDemandSignals) * 1000) / 1000
      : 0;
  const growthRatePercent =
    input.priorDemandSignals >= input.minThreshold
      ? Math.round(
          ((input.recentDemandSignals - input.priorDemandSignals) /
            input.priorDemandSignals) *
            1000
        ) / 10
      : null;

  if (input.recentDemandSignals < input.minThreshold) {
    return {
      medicineId: input.medicineId,
      medicineName: input.medicineName,
      scope: 'AREA',
      area: input.area,
      city: input.city,
      riskCategory: 'INSUFFICIENT_DATA',
      riskScore: null,
      estimatedRiskPeriodDays: null,
      supportingIndicators: {
        recentDemandSignals: input.recentDemandSignals,
        priorDemandSignals: input.priorDemandSignals,
        demandGrowthRatePercent: growthRatePercent,
        unmetDemandSignals: input.unmetDemandSignals,
        unmetDemandRatio: unmetRatio,
        eligibleSupplyAvailable: input.eligibleSupplyAvailable,
        reservedStockExcluded: input.reservedStockExcluded,
        expiredBatchesExcluded: input.expiredBatchesExcluded,
        nearExpiryUnitsCount: input.nearExpiryUnitsCount,
        participatingPharmaciesCount: input.participatingPharmaciesCount,
      },
      algorithmVersion: AI_ALGORITHM_VERSION,
      generatedAt: nowIso,
      explanation: {
        summary: `Insufficient anonymized demand data for ${input.medicineName} in ${input.area}.`,
        whatWasIdentified: 'INSUFFICIENT_DATA for area shortage-risk classification.',
        whyIdentified: `Observed ${input.recentDemandSignals} demand signals, below the minimum privacy/sufficiency threshold of ${input.minThreshold}.`,
        influencingMetrics: {
          recentDemandSignals: input.recentDemandSignals,
          minThreshold: input.minThreshold,
          eligibleSupplyAvailable: input.eligibleSupplyAvailable,
        },
        reportingPeriod: { fromDate: input.fromDate, toDate: input.toDate },
        dataFreshness: {
          latestDataDate: input.latestDataDate,
          isStale,
          staleReason: isStale ? `Latest demand bucket is ${staleDays} days old.` : null,
        },
        confidence: 'INSUFFICIENT',
        limitations: [
          'Search volume alone is never used to claim a shortage.',
          'Area-level risk does not imply stockout at every individual pharmacy.',
        ],
        explanationSource: 'DETERMINISTIC',
      },
    };
  }

  // Factor 1: Unmet demand share (0..1, weight 0.35)
  const unmetScore = Math.min(1, unmetRatio);

  // Factor 2: Supply coverage pressure (0..1, weight 0.35)
  const coverageRatio =
    input.eligibleSupplyAvailable <= 0
      ? 1
      : Math.min(1, input.recentDemandSignals / Math.max(1, input.eligibleSupplyAvailable * 1.5));

  // Factor 3: Demand growth acceleration (0..1, weight 0.15)
  const growthScore =
    growthRatePercent !== null && growthRatePercent > 0
      ? Math.min(1, growthRatePercent / 100)
      : 0;

  // Factor 4: Near-expiry / thin pharmacy coverage (0..1, weight 0.15)
  const expiryShare =
    input.eligibleSupplyAvailable > 0
      ? Math.min(1, input.nearExpiryUnitsCount / input.eligibleSupplyAvailable)
      : 1;
  const thinNetwork = input.participatingPharmaciesCount <= 1 ? 0.5 : 0;
  const fragilityScore = Math.min(1, expiryShare * 0.6 + thinNetwork * 0.4);

  const rawScore =
    0.35 * unmetScore +
    0.35 * coverageRatio +
    0.15 * growthScore +
    0.15 * fragilityScore;

  const riskScore = Math.round(Math.min(1, Math.max(0, rawScore)) * 100) / 100;

  let riskCategory: ShortageRiskCategory = 'LOW';
  if (riskScore >= 0.65) riskCategory = 'HIGH';
  else if (riskScore >= 0.35) riskCategory = 'MODERATE';

  const dailyDemand = input.recentDemandSignals / 14;
  const estimatedRiskPeriodDays =
    dailyDemand > 0 && input.eligibleSupplyAvailable > 0
      ? Math.max(1, Math.round(input.eligibleSupplyAvailable / dailyDemand))
      : input.eligibleSupplyAvailable === 0
        ? 0
        : null;

  let confidence: ConfidenceLevel = 'LOW';
  if (!isStale && input.recentDemandSignals >= input.minThreshold * 4 && input.participatingPharmaciesCount >= 2) {
    confidence = 'HIGH';
  } else if (input.recentDemandSignals >= input.minThreshold * 2) {
    confidence = 'MODERATE';
  }

  return {
    medicineId: input.medicineId,
    medicineName: input.medicineName,
    scope: 'AREA',
    area: input.area,
    city: input.city,
    riskCategory,
    riskScore,
    estimatedRiskPeriodDays,
    supportingIndicators: {
      recentDemandSignals: input.recentDemandSignals,
      priorDemandSignals: input.priorDemandSignals,
      demandGrowthRatePercent: growthRatePercent,
      unmetDemandSignals: input.unmetDemandSignals,
      unmetDemandRatio: unmetRatio,
      eligibleSupplyAvailable: input.eligibleSupplyAvailable,
      reservedStockExcluded: input.reservedStockExcluded,
      expiredBatchesExcluded: input.expiredBatchesExcluded,
      nearExpiryUnitsCount: input.nearExpiryUnitsCount,
      participatingPharmaciesCount: input.participatingPharmaciesCount,
    },
    algorithmVersion: AI_ALGORITHM_VERSION,
    generatedAt: nowIso,
    explanation: {
      summary: `${riskCategory} area shortage-risk indicator (score ${riskScore}) for ${input.medicineName} in ${input.area}.`,
      whatWasIdentified: `Area-level ${riskCategory} shortage-risk indicator (not proof of an actual stockout).`,
      whyIdentified: `Combined unmet-demand ratio (${Math.round(unmetRatio * 100)}%), eligible local supply (${input.eligibleSupplyAvailable} units across ${input.participatingPharmaciesCount} pharmacies, excluding ${input.reservedStockExcluded} reserved units), and demand trend.`,
      influencingMetrics: {
        riskScore,
        unmetDemandRatio: unmetRatio,
        eligibleSupplyAvailable: input.eligibleSupplyAvailable,
        demandGrowthRatePercent: growthRatePercent,
        nearExpiryUnitsCount: input.nearExpiryUnitsCount,
      },
      reportingPeriod: { fromDate: input.fromDate, toDate: input.toDate },
      dataFreshness: {
        latestDataDate: input.latestDataDate,
        isStale,
        staleReason: isStale ? `Latest demand bucket is ${staleDays} days old.` : null,
      },
      confidence,
      limitations: [
        'This is a regional risk indicator derived from anonymized searches and eligible inventory, not a guarantee that a medicine will run out.',
        'Individual pharmacy availability may differ from area-wide indicators.',
      ],
      explanationSource: 'DETERMINISTIC',
    },
  };
}
