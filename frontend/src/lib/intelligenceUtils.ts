import type {
  UnmetDemandCategory,
  UnmetDemandSignal,
} from "../types/intelligence.ts";

/**
 * Enforces minimum aggregation threshold so small groups cannot be exposed.
 */
export function shouldSuppressForPrivacy(
  sampleSize: number,
  minThreshold = 10
): boolean {
  return sampleSize < minThreshold;
}

/**
 * Computes a zero-based chart ceiling so axes are never misleading.
 */
export function getChartMaxDomain(values: number[]): number {
  if (values.length === 0) return 10;
  const maxVal = Math.max(...values, 0);
  if (maxVal === 0) return 10;
  return Math.ceil(maxVal * 1.15);
}

export function formatDemandChangePct(pct: number | null): string {
  if (pct === null || Number.isNaN(pct)) return "Insufficient baseline";
  const rounded = Math.round(pct * 10) / 10;
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function validateDateRange(
  dateFrom: string,
  dateTo: string
): string | null {
  if (!dateFrom || !dateTo) return null;
  const fromMs = Date.parse(dateFrom);
  const toMs = Date.parse(dateTo);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return "Enter valid start and end dates.";
  }
  if (fromMs > toMs) {
    return "Start date cannot be after end date.";
  }
  return null;
}

export function filterUnmetSignals(
  items: UnmetDemandSignal[],
  filters: { area: string; category: "all" | UnmetDemandCategory }
): UnmetDemandSignal[] {
  return items.filter((item) => {
    if (filters.area !== "all" && item.area !== filters.area) {
      return false;
    }
    if (filters.category !== "all" && item.category !== filters.category) {
      return false;
    }
    return true;
  });
}
