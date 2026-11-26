import {
  IMedicineRepository,
  MedicineRecord,
  RawPharmacyStockRecord,
} from '../repositories/medicineRepository.js';
import { AppError } from '../types/index.js';

export type PublicStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface PublicMedicineAvailabilityDto {
  pharmacyId: string;
  pharmacyName: string;
  isDemo: boolean;
  area: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
  is24x7: boolean;
  isOpenNow: boolean | null; // null if operating hours are not configured
  status: PublicStockStatus;
  sellingPrice: number;
  mrp: number;
  lastUpdatedAt: string;
}

export interface MedicinePriceComparisonDto {
  pharmacyId: string;
  pharmacyName: string;
  isDemo: boolean;
  area: string;
  city: string;
  pincode: string;
  distanceKm: number | null;
  status: PublicStockStatus;
  sellingPrice: number;
  mrp: number;
  savingsAmount: number;
  savingsPercent: number;
  lastUpdatedAt: string;
}

export interface MedicineSearchResponseDto {
  items: MedicineRecord[];
  suggestions: MedicineRecord[];
  query: string;
  hasExactOrPartialMatch: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Computes spherical geodesic distance in kilometres using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Extracts current date (YYYY-MM-DD), day of week (0=Sun..6=Sat), and HH:MM:SS in Asia/Kolkata.
 */
export function getIndianTimeParts(now: Date = new Date()): {
  dateStr: string;
  dayOfWeek: number;
  timeStr: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    dayOfWeek: weekdayMap[get('weekday')] ?? 0,
    timeStr: `${hour}:${get('minute')}:${get('second')}`,
  };
}

/**
 * Evaluates whether a pharmacy is currently open using Asia/Kolkata operating hours
 * and exceptional closures. Never assumes open merely because isActive is true.
 */
export function evaluateIsOpenNow(
  stock: Pick<RawPharmacyStockRecord, 'isActive' | 'is24x7' | 'operatingHours' | 'exceptionalClosures'>,
  now: Date = new Date()
): boolean | null {
  if (!stock.isActive) return false;

  const { dateStr, dayOfWeek, timeStr } = getIndianTimeParts(now);

  // 1. Check exceptional closures for today's IST date
  const todayClosure = stock.exceptionalClosures.find((c) => c.closureDate === dateStr);
  if (todayClosure) {
    if (todayClosure.isClosed) return false;
    if (todayClosure.customOpenTime && todayClosure.customCloseTime) {
      return timeStr >= todayClosure.customOpenTime && timeStr <= todayClosure.customCloseTime;
    }
  }

  // 2. Check explicit 24x7 flag only when not overridden by closure
  if (stock.is24x7) return true;

  // 3. Check weekly operating hours
  if (!stock.operatingHours || stock.operatingHours.length === 0) {
    return null; // Unknown operating hours — do not guess
  }

  const todayHours = stock.operatingHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!todayHours) return null;
  if (todayHours.isClosed) return false;
  if (!todayHours.openTime || !todayHours.closeTime) return null;

  return timeStr >= todayHours.openTime && timeStr <= todayHours.closeTime;
}

export function computeStockStatus(
  quantityAvailable: number,
  reorderThreshold: number
): PublicStockStatus {
  if (quantityAvailable <= 0) return 'OUT_OF_STOCK';
  if (quantityAvailable <= reorderThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export class MedicineService {
  constructor(private readonly repository: IMedicineRepository) {}

  async searchMedicines(params: {
    q: string;
    form?: string;
    page: number;
    limit: number;
  }): Promise<MedicineSearchResponseDto> {
    const normalizedQuery = params.q.trim().replace(/\s+/g, ' ');
    const raw = await this.repository.searchMedicines(
      normalizedQuery,
      params.form,
      params.page,
      params.limit
    );

    const totalPages = raw.total > 0 ? Math.ceil(raw.total / params.limit) : 0;

    return {
      items: raw.matches,
      suggestions: raw.suggestions,
      query: normalizedQuery,
      hasExactOrPartialMatch: raw.matches.length > 0,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: raw.total,
        totalPages,
      },
    };
  }

  async getMedicineById(id: string): Promise<MedicineRecord> {
    const medicine = await this.repository.findMedicineById(id);
    if (!medicine) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Medicine with ID ${id} was not found.`);
    }
    return medicine;
  }

  async getMedicineAvailability(
    medicineId: string,
    options: { lat?: number; lng?: number; radiusKm: number },
    now: Date = new Date()
  ): Promise<{ medicine: MedicineRecord; pharmacies: PublicMedicineAvailabilityDto[] }> {
    const medicine = await this.getMedicineById(medicineId);
    const rawStocks = await this.repository.findStockForMedicine(medicineId);
    const { dateStr: todayIst } = getIndianTimeParts(now);

    // Filter out expired batches (expiryDate <= today in IST) and aggregate by pharmacy
    const byPharmacy = new Map<
      string,
      {
        base: RawPharmacyStockRecord;
        totalAvailable: number;
        lowestSellingPrice: number;
        mrp: number;
        latestUpdate: string;
      }
    >();

    for (const row of rawStocks) {
      if (row.expiryDate <= todayIst) {
        continue; // Never surface expired stock as available
      }

      const existing = byPharmacy.get(row.pharmacyId);
      if (!existing) {
        byPharmacy.set(row.pharmacyId, {
          base: row,
          totalAvailable: row.quantityAvailable,
          lowestSellingPrice: row.sellingPrice,
          mrp: row.mrp,
          latestUpdate: row.updatedAt,
        });
      } else {
        existing.totalAvailable += row.quantityAvailable;
        if (row.sellingPrice < existing.lowestSellingPrice && row.quantityAvailable > 0) {
          existing.lowestSellingPrice = row.sellingPrice;
          existing.mrp = row.mrp;
        }
        if (row.updatedAt > existing.latestUpdate) {
          existing.latestUpdate = row.updatedAt;
        }
      }
    }

    const hasUserCoords = options.lat !== undefined && options.lng !== undefined;
    const pharmacies: PublicMedicineAvailabilityDto[] = [];

    for (const entry of byPharmacy.values()) {
      const distanceKm = hasUserCoords
        ? calculateDistanceKm(options.lat!, options.lng!, entry.base.lat, entry.base.lng)
        : null;

      if (distanceKm !== null && distanceKm > options.radiusKm) {
        continue;
      }

      const status = computeStockStatus(entry.totalAvailable, entry.base.reorderThreshold);
      const isOpenNow = evaluateIsOpenNow(entry.base, now);

      pharmacies.push({
        pharmacyId: entry.base.pharmacyId,
        pharmacyName: entry.base.pharmacyName,
        isDemo: entry.base.isDemo,
        area: entry.base.area,
        city: entry.base.city,
        state: entry.base.state,
        pincode: entry.base.pincode,
        address: entry.base.address,
        lat: entry.base.lat,
        lng: entry.base.lng,
        distanceKm,
        is24x7: entry.base.is24x7,
        isOpenNow,
        status,
        sellingPrice: entry.lowestSellingPrice,
        mrp: entry.mrp,
        lastUpdatedAt: entry.latestUpdate,
      });
    }

    // Sort: Available stock first, then by distance (if provided) or price
    pharmacies.sort((a, b) => {
      const aAvail = a.status === 'OUT_OF_STOCK' ? 1 : 0;
      const bAvail = b.status === 'OUT_OF_STOCK' ? 1 : 0;
      if (aAvail !== bAvail) return aAvail - bAvail;
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return a.sellingPrice - b.sellingPrice;
    });

    return { medicine, pharmacies };
  }

  async getMedicinePrices(
    medicineId: string,
    options: { lat?: number; lng?: number; radiusKm: number; sortBy: 'price_asc' | 'distance_asc' },
    now: Date = new Date()
  ): Promise<{
    medicine: {
      id: string;
      displayName: string;
      genericName: string;
      strength: string;
      dosageForm: string;
      packSize: string;
      currency: 'INR';
    };
    comparisons: MedicinePriceComparisonDto[];
  }> {
    const { medicine, pharmacies } = await this.getMedicineAvailability(
      medicineId,
      { lat: options.lat, lng: options.lng, radiusKm: options.radiusKm },
      now
    );

    // Only compare pharmacies that actually have non-expired stock (or show status clearly)
    const comparisons: MedicinePriceComparisonDto[] = pharmacies
      .filter((p) => p.status !== 'OUT_OF_STOCK')
      .map((p) => {
        const savingsAmount = Math.max(0, Math.round((p.mrp - p.sellingPrice) * 100) / 100);
        const savingsPercent =
          p.mrp > 0 ? Math.round((savingsAmount / p.mrp) * 1000) / 10 : 0;
        return {
          pharmacyId: p.pharmacyId,
          pharmacyName: p.pharmacyName,
          isDemo: p.isDemo,
          area: p.area,
          city: p.city,
          pincode: p.pincode,
          distanceKm: p.distanceKm,
          status: p.status,
          sellingPrice: p.sellingPrice,
          mrp: p.mrp,
          savingsAmount,
          savingsPercent,
          lastUpdatedAt: p.lastUpdatedAt,
        };
      });

    comparisons.sort((a, b) => {
      if (options.sortBy === 'distance_asc' && a.distanceKm !== null && b.distanceKm !== null) {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      }
      if (a.sellingPrice !== b.sellingPrice) return a.sellingPrice - b.sellingPrice;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return a.pharmacyName.localeCompare(b.pharmacyName);
    });

    return {
      medicine: {
        id: medicine.id,
        displayName: medicine.displayName,
        genericName: medicine.genericName,
        strength: medicine.strength,
        dosageForm: medicine.dosageForm,
        packSize: medicine.packSize,
        currency: 'INR',
      },
      comparisons,
    };
  }
}
