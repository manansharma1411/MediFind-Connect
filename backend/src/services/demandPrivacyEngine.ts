import crypto from 'crypto';

export type SearchOutcome =
  | 'MATCH_FOUND'
  | 'NO_MATCH'
  | 'NO_ELIGIBLE_NEARBY_STOCK'
  | 'PARTIAL_AVAILABILITY';

export type SearchSource =
  | 'MEDICINE_SEARCH'
  | 'AVAILABILITY_CHECK'
  | 'PRICE_COMPARISON';

export interface CoarseGeographicGroup {
  area: string;
  city: string;
  pincodePrefix: string;
  isKnownLocation: boolean;
}

const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Normalizes coarse India-compatible geographic labels without ever inferring
 * precise coordinates or storing raw patient addresses/IPs.
 */
export function normalizeGeographicGrouping(input?: {
  area?: string | null;
  city?: string | null;
  pincode?: string | null;
}): CoarseGeographicGroup {
  const rawPin = input?.pincode?.trim() ?? '';
  const validPin = PINCODE_REGEX.test(rawPin) ? rawPin : null;
  const pincodePrefix = validPin ? `${validPin.slice(0, 3)}xxx` : 'UNKNOWN';

  const cleanArea = input?.area?.trim();
  const cleanCity = input?.city?.trim();

  if (!cleanArea && !cleanCity && !validPin) {
    return {
      area: 'UNKNOWN_AREA',
      city: 'UNKNOWN',
      pincodePrefix: 'UNKNOWN',
      isKnownLocation: false,
    };
  }

  return {
    area: cleanArea && cleanArea.length >= 2 ? cleanArea : validPin ? `PIN-${pincodePrefix}` : 'UNKNOWN_AREA',
    city: cleanCity && cleanCity.length >= 2 ? cleanCity : 'UNKNOWN',
    pincodePrefix,
    isKnownLocation: true,
  };
}

/**
 * Builds an opaque SHA-256 deduplication key for a short-lived TTL window.
 * Never persists raw IP, user ID, or raw query text.
 */
export function buildEphemeralDedupHash(params: {
  clientFingerprint: string;
  medicineId: string | null;
  area: string;
  searchOutcome: SearchOutcome;
  bucketDate: string;
  salt: string;
}): string {
  const payload = [
    params.salt,
    params.bucketDate,
    params.clientFingerprint,
    params.medicineId ?? 'NO_MEDICINE',
    params.area.toLowerCase(),
    params.searchOutcome,
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface CountableGroup {
  signalCount: number;
}

/**
 * Enforces k-anonymity minimum group threshold.
 * Groups below `minThreshold` are suppressed and excluded from visible totals
 * to prevent differencing attacks.
 */
export function applyKAnonymityThreshold<T extends CountableGroup>(
  groups: T[],
  minThreshold: number
): {
  visible: T[];
  suppressedCount: number;
} {
  const visible: T[] = [];
  let suppressedCount = 0;

  for (const g of groups) {
    if (g.signalCount >= minThreshold) {
      visible.push(g);
    } else {
      suppressedCount += 1;
    }
  }

  return { visible, suppressedCount };
}

export interface EligibleInventorySlot {
  pharmacyId: string;
  medicineId: string;
  area: string;
  city: string;
  quantityAvailable: number;
  quantityReserved: number;
  expiryDate: string; // YYYY-MM-DD
  isPharmacyActive: boolean;
  isPharmacyVerified: boolean;
}

export interface AreaSupplySummary {
  eligibleTotalAvailable: number;
  participatingPharmaciesCount: number;
  supplyLevel: 'NONE' | 'LOW' | 'ADEQUATE';
}

/**
 * Aggregates eligible local supply while strictly excluding:
 * - Expired batches (expiryDate <= todayStr)
 * - Reserved stock (uses quantityAvailable only)
 * - Inactive pharmacies
 * Never returns individual pharmacy quantities.
 */
export function computeEligibleSupplySummary(
  slots: EligibleInventorySlot[],
  todayStr: string
): AreaSupplySummary {
  let totalAvailable = 0;
  const pharmacyIds = new Set<string>();

  for (const slot of slots) {
    if (!slot.isPharmacyActive) continue;
    if (slot.expiryDate <= todayStr) continue;
    if (slot.quantityAvailable <= 0) continue;

    totalAvailable += slot.quantityAvailable;
    pharmacyIds.add(slot.pharmacyId);
  }

  let supplyLevel: 'NONE' | 'LOW' | 'ADEQUATE' = 'NONE';
  if (totalAvailable > 0 && totalAvailable < 20) {
    supplyLevel = 'LOW';
  } else if (totalAvailable >= 20) {
    supplyLevel = 'ADEQUATE';
  }

  return {
    eligibleTotalAvailable: totalAvailable,
    participatingPharmaciesCount: pharmacyIds.size,
    supplyLevel,
  };
}

export type DataConfidence = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export function assessDataSufficiency(
  visibleSignalTotal: number,
  minThreshold: number
): {
  isSufficientData: boolean;
  confidence: DataConfidence;
  disclaimer: string;
} {
  if (visibleSignalTotal < minThreshold) {
    return {
      isSufficientData: false,
      confidence: 'INSUFFICIENT',
      disclaimer:
        'Insufficient anonymized demand signals to display group metrics without risking privacy or statistical noise.',
    };
  }

  let confidence: DataConfidence = 'LOW';
  if (visibleSignalTotal >= minThreshold * 6) {
    confidence = 'HIGH';
  } else if (visibleSignalTotal >= minThreshold * 2) {
    confidence = 'MODERATE';
  }

  return {
    isSufficientData: true,
    confidence,
    disclaimer:
      'Demand metrics reflect anonymized search signals, not confirmed purchases or verified clinical shortages.',
  };
}

/**
 * Maps a YYYY-MM-DD date string to its ISO week start (Monday YYYY-MM-DD).
 */
export function toWeekBucketStart(dateStr: string): string {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}
