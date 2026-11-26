import type {
  AvailabilityFilters,
  MedicineAvailability,
  StockStatus,
} from "../types/medicine.ts";

/**
 * Haversine distance in kilometers rounded to 1 decimal place.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Maps backend StockStatus enum to UI badge status.
 */
export function mapStockStatusToBadge(
  status: StockStatus
): "in_stock" | "low_stock" | "out_of_stock" {
  switch (status) {
    case "IN_STOCK":
      return "in_stock";
    case "LOW_STOCK":
      return "low_stock";
    case "OUT_OF_STOCK":
    default:
      return "out_of_stock";
  }
}

/**
 * Checks whether an ISO timestamp is older than thresholdHours (default 24h).
 */
export function isStaleTimestamp(
  isoString: string,
  thresholdHours = 24,
  nowMs = Date.now()
): boolean {
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) return true;
  const diffHours = (nowMs - parsed) / (1000 * 60 * 60);
  return diffHours > thresholdHours;
}

/**
 * Formats an ISO timestamp into a concise human-readable label.
 */
export function formatLastUpdated(isoString: string, nowMs = Date.now()): string {
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) return "Unknown";
  const diffMins = Math.max(0, Math.round((nowMs - parsed) / 60000));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

/**
 * Filters and sorts pharmacy availability records using real/returned fields only.
 */
export function filterAndSortAvailability(
  items: MedicineAvailability[],
  filters: AvailabilityFilters
): MedicineAvailability[] {
  const filtered = items.filter((item) => {
    if (filters.availableNow && item.status === "OUT_OF_STOCK") {
      return false;
    }

    if (filters.openNow) {
      const isOpen = item.is24x7 || item.isOpenNow === true;
      if (!isOpen) return false;
    }

    if (filters.maxDistanceKm !== null) {
      if (item.distanceKm === null || item.distanceKm > filters.maxDistanceKm) {
        return false;
      }
    }

    return true;
  });

  const statusRank: Record<StockStatus, number> = {
    IN_STOCK: 0,
    LOW_STOCK: 1,
    OUT_OF_STOCK: 2,
  };

  return [...filtered].sort((a, b) => {
    if (filters.sortBy === "price") {
      return a.sellingPrice - b.sellingPrice;
    }

    if (filters.sortBy === "availability") {
      const diff = statusRank[a.status] - statusRank[b.status];
      if (diff !== 0) return diff;
    }

    const distA = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const distB = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return distA - distB;
  });
}

/**
 * Sorts price comparison entries by lowest selling price first,
 * prioritizing in-stock/low-stock entries when prices tie.
 */
export function sortPriceComparisons(
  items: MedicineAvailability[]
): MedicineAvailability[] {
  const rank: Record<StockStatus, number> = {
    IN_STOCK: 0,
    LOW_STOCK: 1,
    OUT_OF_STOCK: 2,
  };
  return [...items].sort((a, b) => {
    if (a.sellingPrice !== b.sellingPrice) {
      return a.sellingPrice - b.sellingPrice;
    }
    return rank[a.status] - rank[b.status];
  });
}

/**
 * Creates a debounced wrapper around a callback with explicit cancel support.
 */
export function createDebouncer<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs = 300
): { call: (...args: TArgs) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    call: (...args: TArgs) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, delayMs);
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
