import { toWeekBucketStart } from '../demandPrivacyEngine.js';
import {
  AI_ALGORITHM_VERSION,
  ConfidenceLevel,
  DemandForecastResult,
  ForecastEvaluationMetrics,
  ForecastPoint,
} from './aiTypes.js';

export interface TimeBucketObservation {
  periodStart: string; // YYYY-MM-DD
  signalCount: number;
}

function addDays(dateStr: string, days: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Aggregates raw daily counts into time-ordered buckets (ascending by periodStart).
 */
export function buildOrderedTimeSeries(
  rows: Array<{ bucketDate: string; signalCount: number }>,
  granularity: 'day' | 'week'
): TimeBucketObservation[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = granularity === 'week' ? toWeekBucketStart(r.bucketDate) : r.bucketDate;
    map.set(key, (map.get(key) ?? 0) + r.signalCount);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodStart, signalCount]) => ({ periodStart, signalCount }));
}

/**
 * Deterministic single-exponential smoothing with damped linear trend + walk-forward evaluation.
 * Avoids data leakage by predicting step t strictly from observations 0..t-1.
 */
export function generateDemandForecast(params: {
  medicineId: string;
  medicineName: string | null;
  area: string;
  granularity: 'day' | 'week';
  horizon: number;
  series: TimeBucketObservation[];
  fromDate: string;
  toDate: string;
  minThreshold: number;
  todayStr: string;
  now?: Date;
}): DemandForecastResult {
  const nowIso = (params.now ?? new Date()).toISOString();
  const totalSignals = params.series.reduce((s, x) => s + x.signalCount, 0);
  const latestDataDate =
    params.series.length > 0 ? params.series[params.series.length - 1].periodStart : null;
  const staleDays = latestDataDate
    ? Math.round((Date.parse(`${params.todayStr}T00:00:00Z`) - Date.parse(`${latestDataDate}T00:00:00Z`)) / 86400000)
    : null;
  const isStale = staleDays !== null && staleDays > 14;

  const minBucketsRequired = 7;
  if (params.series.length < minBucketsRequired || totalSignals < params.minThreshold) {
    const insufficientEval: ForecastEvaluationMetrics = {
      status: 'INSUFFICIENT_DATA',
      modelName: 'ExponentialSmoothingWithTrend',
      baselineName: 'NaiveLastObservation',
      mae: null,
      rmse: null,
      mapePercent: null,
      baselineMae: null,
      baselineRmse: null,
      beatsBaselineOnMae: null,
      evaluatedPoints: 0,
    };

    return {
      medicineId: params.medicineId,
      medicineName: params.medicineName,
      area: params.area,
      granularity: params.granularity,
      horizonPeriods: params.horizon,
      status: 'INSUFFICIENT_DATA',
      historicalBucketsCount: params.series.length,
      baselineAverageSignals: null,
      predictions: [],
      evaluation: insufficientEval,
      algorithmVersion: AI_ALGORITHM_VERSION,
      generatedAt: nowIso,
      explanation: {
        summary: `Insufficient historical data to forecast demand for ${params.medicineName ?? params.medicineId} in ${params.area}.`,
        whatWasIdentified: 'Insufficient time-series history for statistical forecasting.',
        whyIdentified: `Found ${params.series.length} ordered time buckets and ${totalSignals} anonymized demand signals; at least ${minBucketsRequired} buckets and ${params.minThreshold} signals are required.`,
        influencingMetrics: {
          historicalBucketsCount: params.series.length,
          requiredBuckets: minBucketsRequired,
          totalSignals,
          minThreshold: params.minThreshold,
        },
        reportingPeriod: { fromDate: params.fromDate, toDate: params.toDate },
        dataFreshness: {
          latestDataDate,
          isStale,
          staleReason: isStale ? `Latest demand bucket is ${staleDays} days old.` : null,
        },
        confidence: 'INSUFFICIENT',
        limitations: [
          'Forecasts are withheld when history is too short to evaluate against a baseline.',
          'Predictions represent anonymized search-signal volume, not confirmed sales.',
        ],
        explanationSource: 'DETERMINISTIC',
      },
    };
  }

  // Walk-forward evaluation (starting after 3 initial warmup points, zero leakage)
  const alpha = 0.4;
  const beta = 0.2;
  let level = params.series[0].signalCount;
  let trend =
    params.series.length > 1 ? params.series[1].signalCount - params.series[0].signalCount : 0;

  const modelErrors: number[] = [];
  const baselineErrors: number[] = [];
  const absPctErrors: number[] = [];
  let canComputeMape = true;

  for (let i = 1; i < params.series.length; i++) {
    const actual = params.series[i].signalCount;
    const oneStepPred = Math.max(0, level + trend);
    const naivePred = params.series[i - 1].signalCount;

    if (i >= 3) {
      modelErrors.push(actual - oneStepPred);
      baselineErrors.push(actual - naivePred);
      if (actual > 0) {
        absPctErrors.push(Math.abs(actual - oneStepPred) / actual);
      } else {
        canComputeMape = false;
      }
    }

    const prevLevel = level;
    level = alpha * actual + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const nEval = modelErrors.length;
  const mae =
    nEval > 0
      ? Math.round((modelErrors.reduce((s, e) => s + Math.abs(e), 0) / nEval) * 100) / 100
      : null;
  const rmse =
    nEval > 0
      ? Math.round(Math.sqrt(modelErrors.reduce((s, e) => s + e * e, 0) / nEval) * 100) / 100
      : null;
  const baselineMae =
    nEval > 0
      ? Math.round((baselineErrors.reduce((s, e) => s + Math.abs(e), 0) / nEval) * 100) / 100
      : null;
  const baselineRmse =
    nEval > 0
      ? Math.round(Math.sqrt(baselineErrors.reduce((s, e) => s + e * e, 0) / nEval) * 100) / 100
      : null;
  const mapePercent =
    canComputeMape && absPctErrors.length > 0
      ? Math.round((absPctErrors.reduce((s, p) => s + p, 0) / absPctErrors.length) * 1000) / 10
      : null;

  const stepDays = params.granularity === 'week' ? 7 : 1;
  const lastPeriod = params.series[params.series.length - 1].periodStart;
  const spread = Math.max(1, rmse ?? 1);

  const predictions: ForecastPoint[] = [];
  for (let h = 1; h <= params.horizon; h++) {
    const point = Math.max(0, Math.round((level + h * 0.7 * trend) * 100) / 100);
    const margin = Math.round(1.64 * spread * Math.sqrt(h) * 100) / 100;
    predictions.push({
      periodStart: addDays(lastPeriod, h * stepDays),
      predictedDemandSignals: point,
      lowerBound: Math.max(0, Math.round((point - margin) * 100) / 100),
      upperBound: Math.round((point + margin) * 100) / 100,
    });
  }

  const avgSignals =
    Math.round((totalSignals / params.series.length) * 100) / 100;

  let confidence: ConfidenceLevel = 'LOW';
  if (!isStale && params.series.length >= 14 && totalSignals >= params.minThreshold * 4) {
    confidence = 'HIGH';
  } else if (params.series.length >= 10) {
    confidence = 'MODERATE';
  }

  const beatsBaseline =
    mae !== null && baselineMae !== null ? mae <= baselineMae : null;

  return {
    medicineId: params.medicineId,
    medicineName: params.medicineName,
    area: params.area,
    granularity: params.granularity,
    horizonPeriods: params.horizon,
    status: 'READY',
    historicalBucketsCount: params.series.length,
    baselineAverageSignals: avgSignals,
    predictions,
    evaluation: {
      status: nEval > 0 ? 'EVALUATED' : 'INSUFFICIENT_DATA',
      modelName: 'ExponentialSmoothingWithTrend',
      baselineName: 'NaiveLastObservation',
      mae,
      rmse,
      mapePercent,
      baselineMae,
      baselineRmse,
      beatsBaselineOnMae: beatsBaseline,
      evaluatedPoints: nEval,
    },
    algorithmVersion: AI_ALGORITHM_VERSION,
    generatedAt: nowIso,
    explanation: {
      summary: `Generated ${params.horizon}-${params.granularity} demand-signal forecast for ${params.medicineName ?? params.medicineId} in ${params.area}.`,
      whatWasIdentified: `Projected ${predictions[0]?.predictedDemandSignals ?? 0} to ${predictions[predictions.length - 1]?.predictedDemandSignals ?? 0} search signals per ${params.granularity}.`,
      whyIdentified: `Computed via walk-forward damped exponential smoothing over ${params.series.length} time-ordered ${params.granularity} buckets (MAE ${mae ?? 'N/A'} vs Naive baseline ${baselineMae ?? 'N/A'}).`,
      influencingMetrics: {
        historicalBucketsCount: params.series.length,
        baselineAverageSignals: avgSignals,
        mae,
        rmse,
        baselineMae,
      },
      reportingPeriod: { fromDate: params.fromDate, toDate: params.toDate },
      dataFreshness: {
        latestDataDate,
        isStale,
        staleReason: isStale ? `Latest demand bucket is ${staleDays} days old.` : null,
      },
      confidence,
      limitations: [
        'Forecasts estimate anonymized search-signal volume, not confirmed prescriptions or sales.',
        'MAPE is omitted if any historical bucket had zero signals.',
      ],
      explanationSource: 'DETERMINISTIC',
    },
  };
}
