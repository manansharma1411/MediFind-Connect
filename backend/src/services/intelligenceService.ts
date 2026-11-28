import { env } from '../config/env.js';
import { getIndianTimeParts } from './medicineService.js';
import {
  IIntelligenceRepository,
  DemandAggregateRecord,
  intelligenceRepository,
} from '../repositories/intelligenceRepository.js';
import {
  IPharmacyRepository,
  PharmacyProfileRecord,
  SupabasePharmacyRepository,
} from '../repositories/pharmacyRepository.js';
import {
  applyKAnonymityThreshold,
  assessDataSufficiency,
  buildEphemeralDedupHash,
  computeEligibleSupplySummary,
  normalizeGeographicGrouping,
  SearchOutcome,
  SearchSource,
  toWeekBucketStart,
} from './demandPrivacyEngine.js';
import { AppError } from '../types/index.js';

const UNMET_OUTCOMES: SearchOutcome[] = [
  'NO_MATCH',
  'NO_ELIGIBLE_NEARBY_STOCK',
  'PARTIAL_AVAILABILITY',
];

export interface IntelligenceServiceConfig {
  minThreshold?: number;
  dedupTtlSeconds?: number;
  retentionDays?: number;
  signalSalt?: string;
}

export class IntelligenceService {
  private readonly minThreshold: number;
  private readonly dedupTtlSeconds: number;
  private readonly retentionDays: number;
  private readonly signalSalt: string;

  constructor(
    private readonly repo: IIntelligenceRepository = intelligenceRepository,
    private readonly pharmRepo: IPharmacyRepository = new SupabasePharmacyRepository(),
    config: IntelligenceServiceConfig = {}
  ) {
    this.minThreshold = config.minThreshold ?? env.DEMAND_MIN_THRESHOLD;
    this.dedupTtlSeconds = config.dedupTtlSeconds ?? env.DEMAND_DEDUP_TTL_SECONDS;
    this.retentionDays = config.retentionDays ?? env.DEMAND_RETENTION_DAYS;
    this.signalSalt = config.signalSalt ?? env.DEMAND_SIGNAL_SALT;
  }

  private resolveWindow(fromDate?: string, toDate?: string): { fromDate: string; toDate: string } {
    const today = getIndianTimeParts().dateStr;
    const end = toDate ?? today;
    if (fromDate) {
      return { fromDate, toDate: end };
    }
    const endMs = Date.parse(`${end}T00:00:00Z`);
    const startMs = endMs - 29 * 86400000;
    const start = new Date(startMs).toISOString().slice(0, 10);
    return { fromDate: start, toDate: end };
  }

  private getPreviousWindow(fromDate: string, toDate: string): { fromDate: string; toDate: string } {
    const startMs = Date.parse(`${fromDate}T00:00:00Z`);
    const endMs = Date.parse(`${toDate}T00:00:00Z`);
    const spanDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
    const prevEnd = new Date(startMs - 86400000).toISOString().slice(0, 10);
    const prevStart = new Date(startMs - spanDays * 86400000).toISOString().slice(0, 10);
    return { fromDate: prevStart, toDate: prevEnd };
  }

  private async resolveAuthorizedPharmacy(userId: string): Promise<PharmacyProfileRecord> {
    const pharmacy = await this.pharmRepo.findPharmacyByUserId(userId);
    if (!pharmacy) {
      throw new AppError(
        403,
        'PHARMACY_PROFILE_REQUIRED',
        'An authorized pharmacy profile is required to access demand intelligence.'
      );
    }
    return pharmacy;
  }

  private enforceAreaScope(pharmacy: PharmacyProfileRecord, requestedArea?: string): string {
    const permittedArea = pharmacy.location?.area ?? 'UNKNOWN_AREA';
    if (!requestedArea) {
      return permittedArea;
    }
    if (requestedArea.trim().toLowerCase() !== permittedArea.toLowerCase()) {
      throw new AppError(
        403,
        'FORBIDDEN_AREA_SCOPE',
        'You may only query demand intelligence for your pharmacy’s permitted area.'
      );
    }
    return permittedArea;
  }

  async recordSearchSignal(
    input: {
      medicineId: string | null;
      searchOutcome: SearchOutcome;
      searchSource: SearchSource;
      area?: string | null;
      city?: string | null;
      pincode?: string | null;
    },
    clientFingerprint: string
  ): Promise<{ recorded: boolean; deduplicated: boolean }> {
    if (input.medicineId) {
      const exists = await this.repo.medicineExists(input.medicineId);
      if (!exists) {
        throw new AppError(400, 'INVALID_MEDICINE', 'Canonical medicineId does not exist.');
      }
    }

    const geo = normalizeGeographicGrouping({
      area: input.area,
      city: input.city,
      pincode: input.pincode,
    });
    const bucketDate = getIndianTimeParts().dateStr;
    const dedupHash = buildEphemeralDedupHash({
      clientFingerprint,
      medicineId: input.medicineId,
      area: geo.area,
      searchOutcome: input.searchOutcome,
      bucketDate,
      salt: this.signalSalt,
    });

    return this.repo.recordDemandSignal({
      bucketDate,
      medicineId: input.medicineId,
      area: geo.area,
      city: geo.city,
      pincodePrefix: geo.pincodePrefix,
      searchOutcome: input.searchOutcome,
      searchSource: input.searchSource,
      dedupHash,
      dedupTtlSeconds: this.dedupTtlSeconds,
    });
  }

  async getDemandOverview(
    userId: string,
    query: { area?: string; fromDate?: string; toDate?: string; granularity: 'day' | 'week' }
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const window = this.resolveWindow(query.fromDate, query.toDate);
    const today = getIndianTimeParts().dateStr;

    const rows = await this.repo.listAggregates({
      fromDate: window.fromDate,
      toDate: window.toDate,
      area: scopedArea,
    });

    // Group by canonical medicineId for popular medicines (k-anonymity applied)
    const medMap = new Map<
      string,
      { medicineId: string; medicineName: string; signalCount: number; unmetSignals: number }
    >();
    let unmetRawTotal = 0;

    for (const r of rows) {
      if (UNMET_OUTCOMES.includes(r.searchOutcome)) {
        unmetRawTotal += r.signalCount;
      }
      if (!r.medicineId) continue;
      const existing = medMap.get(r.medicineId) ?? {
        medicineId: r.medicineId,
        medicineName: r.medicineName ?? 'Unknown Medicine',
        signalCount: 0,
        unmetSignals: 0,
      };
      existing.signalCount += r.signalCount;
      if (UNMET_OUTCOMES.includes(r.searchOutcome)) {
        existing.unmetSignals += r.signalCount;
      }
      medMap.set(r.medicineId, existing);
    }

    const { visible: visibleMeds, suppressedCount } = applyKAnonymityThreshold(
      Array.from(medMap.values()),
      this.minThreshold
    );
    visibleMeds.sort((a, b) => b.signalCount - a.signalCount);

    // Totals computed ONLY from visible groups to prevent differencing attacks
    const visibleSearchVolume = visibleMeds.reduce((sum, m) => sum + m.signalCount, 0);
    const visibleUnmetVolume = visibleMeds.reduce((sum, m) => sum + m.unmetSignals, 0);

    // Previous period comparison (only if both periods satisfy threshold)
    const prevWindow = this.getPreviousWindow(window.fromDate, window.toDate);
    const prevRows = await this.repo.listAggregates({
      fromDate: prevWindow.fromDate,
      toDate: prevWindow.toDate,
      area: scopedArea,
    });
    const prevMedMap = new Map<string, { signalCount: number }>();
    for (const r of prevRows) {
      if (!r.medicineId) continue;
      const cur = prevMedMap.get(r.medicineId) ?? { signalCount: 0 };
      cur.signalCount += r.signalCount;
      prevMedMap.set(r.medicineId, cur);
    }
    const { visible: prevVisible } = applyKAnonymityThreshold(
      Array.from(prevMedMap.values()),
      this.minThreshold
    );
    const prevVisibleVolume = prevVisible.reduce((sum, m) => sum + m.signalCount, 0);

    const periodOverPeriodChangePercent =
      visibleSearchVolume >= this.minThreshold && prevVisibleVolume >= this.minThreshold
        ? Math.round(((visibleSearchVolume - prevVisibleVolume) / prevVisibleVolume) * 1000) / 10
        : null;

    const slots = await this.repo.listEligibleInventorySlots({ area: scopedArea });
    const supply = computeEligibleSupplySummary(slots, today);
    const sufficiency = assessDataSufficiency(visibleSearchVolume, this.minThreshold);
    const latestRun = await this.repo.getLatestAggregationRun();

    const demandToSupplyIndicator =
      sufficiency.isSufficientData && supply.eligibleTotalAvailable > 0
        ? Math.round((visibleSearchVolume / supply.eligibleTotalAvailable) * 100) / 100
        : null;

    return {
      area: scopedArea,
      city: pharmacy.location?.city ?? 'UNKNOWN',
      reportingPeriod: { ...window, granularity: query.granularity },
      searchVolume: sufficiency.isSufficientData ? visibleSearchVolume : 0,
      unmetDemandSignals:
        unmetRawTotal >= this.minThreshold ? visibleUnmetVolume : 0,
      periodOverPeriodChangePercent,
      popularMedicines: visibleMeds.slice(0, 10).map((m) => ({
        medicineId: m.medicineId,
        medicineName: m.medicineName,
        searchSignals: m.signalCount,
        unmetSignals: m.unmetSignals >= this.minThreshold ? m.unmetSignals : 0,
      })),
      currentEligibleSupply: supply,
      demandToSupplyIndicator,
      privacy: {
        minThreshold: this.minThreshold,
        suppressedGroups: suppressedCount,
        aggregationGranularity: 'DAY_OR_WEEK',
      },
      dataFreshness: {
        latestBucketDate: rows[0]?.bucketDate ?? null,
        lastCleanupAt: latestRun?.completedAt ?? null,
        retentionDays: this.retentionDays,
      },
      ...sufficiency,
    };
  }

  async getDemandTrends(
    userId: string,
    query: {
      medicineId?: string;
      area?: string;
      fromDate?: string;
      toDate?: string;
      granularity: 'day' | 'week';
      page: number;
      limit: number;
    }
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const window = this.resolveWindow(query.fromDate, query.toDate);

    const rows = await this.repo.listAggregates({
      fromDate: window.fromDate,
      toDate: window.toDate,
      area: scopedArea,
      medicineId: query.medicineId,
    });

    const bucketMap = new Map<
      string,
      {
        periodStart: string;
        medicineId: string | null;
        medicineName: string | null;
        area: string;
        signalCount: number;
        unmetSignals: number;
      }
    >();

    for (const r of rows) {
      const periodStart =
        query.granularity === 'week' ? toWeekBucketStart(r.bucketDate) : r.bucketDate;
      const key = `${periodStart}|${r.medicineId ?? 'NONE'}|${r.area.toLowerCase()}`;
      const existing = bucketMap.get(key) ?? {
        periodStart,
        medicineId: r.medicineId,
        medicineName: r.medicineName,
        area: r.area,
        signalCount: 0,
        unmetSignals: 0,
      };
      existing.signalCount += r.signalCount;
      if (UNMET_OUTCOMES.includes(r.searchOutcome)) {
        existing.unmetSignals += r.signalCount;
      }
      bucketMap.set(key, existing);
    }

    const { visible } = applyKAnonymityThreshold(
      Array.from(bucketMap.values()),
      this.minThreshold
    );
    visible.sort((a, b) => b.periodStart.localeCompare(a.periodStart));

    const total = visible.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;
    const items = visible.slice(start, start + query.limit).map((b) => ({
      periodStart: b.periodStart,
      granularity: query.granularity,
      medicineId: b.medicineId,
      medicineName: b.medicineName,
      area: b.area,
      searchSignals: b.signalCount,
      unmetSignals: b.unmetSignals >= this.minThreshold ? b.unmetSignals : 0,
    }));

    const totalVisibleSignals = visible.reduce((s, x) => s + x.signalCount, 0);
    const sufficiency = assessDataSufficiency(totalVisibleSignals, this.minThreshold);

    return {
      reportingPeriod: window,
      granularity: query.granularity,
      items,
      pagination: { page: query.page, limit: query.limit, total, totalPages },
      minThreshold: this.minThreshold,
      ...sufficiency,
    };
  }

  async getAreaDemand(
    userId: string,
    query: {
      medicineId?: string;
      fromDate?: string;
      toDate?: string;
      page: number;
      limit: number;
    }
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const permittedCity = pharmacy.location?.city;
    const window = this.resolveWindow(query.fromDate, query.toDate);
    const today = getIndianTimeParts().dateStr;

    const rows = await this.repo.listAggregates({
      fromDate: window.fromDate,
      toDate: window.toDate,
      city: permittedCity,
      medicineId: query.medicineId,
    });

    const areaMap = new Map<
      string,
      { area: string; city: string; pincodePrefix: string; signalCount: number; unmetSignals: number }
    >();

    for (const r of rows) {
      const key = `${r.area.toLowerCase()}|${r.city.toLowerCase()}`;
      const existing = areaMap.get(key) ?? {
        area: r.area,
        city: r.city,
        pincodePrefix: r.pincodePrefix,
        signalCount: 0,
        unmetSignals: 0,
      };
      existing.signalCount += r.signalCount;
      if (UNMET_OUTCOMES.includes(r.searchOutcome)) {
        existing.unmetSignals += r.signalCount;
      }
      areaMap.set(key, existing);
    }

    const { visible } = applyKAnonymityThreshold(
      Array.from(areaMap.values()),
      this.minThreshold
    );
    visible.sort((a, b) => b.signalCount - a.signalCount);

    const slots = await this.repo.listEligibleInventorySlots({
      city: permittedCity,
      medicineId: query.medicineId,
    });

    const enriched = visible.map((a) => {
      const areaSlots = slots.filter((s) => s.area.toLowerCase() === a.area.toLowerCase());
      const supply = computeEligibleSupplySummary(areaSlots, today);
      return {
        area: a.area,
        city: a.city,
        pincodePrefix: a.pincodePrefix,
        searchSignals: a.signalCount,
        unmetSignals: a.unmetSignals >= this.minThreshold ? a.unmetSignals : 0,
        currentEligibleSupply: supply,
      };
    });

    const total = enriched.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;
    const totalVisibleSignals = visible.reduce((s, x) => s + x.signalCount, 0);

    return {
      reportingPeriod: window,
      items: enriched.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
      minThreshold: this.minThreshold,
      ...assessDataSufficiency(totalVisibleSignals, this.minThreshold),
    };
  }

  async getUnmetDemand(
    userId: string,
    query: {
      area?: string;
      fromDate?: string;
      toDate?: string;
      page: number;
      limit: number;
    }
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const window = this.resolveWindow(query.fromDate, query.toDate);

    const rows = await this.repo.listAggregates({
      fromDate: window.fromDate,
      toDate: window.toDate,
      area: scopedArea,
      outcomes: UNMET_OUTCOMES,
    });

    const groupMap = new Map<
      string,
      {
        medicineId: string | null;
        medicineName: string | null;
        area: string;
        searchOutcome: SearchOutcome;
        signalCount: number;
      }
    >();

    for (const r of rows) {
      const key = `${r.medicineId ?? 'NONE'}|${r.area.toLowerCase()}|${r.searchOutcome}`;
      const existing = groupMap.get(key) ?? {
        medicineId: r.medicineId,
        medicineName: r.medicineName,
        area: r.area,
        searchOutcome: r.searchOutcome,
        signalCount: 0,
      };
      existing.signalCount += r.signalCount;
      groupMap.set(key, existing);
    }

    const { visible } = applyKAnonymityThreshold(
      Array.from(groupMap.values()),
      this.minThreshold
    );
    visible.sort((a, b) => b.signalCount - a.signalCount);

    const total = visible.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;
    const totalVisible = visible.reduce((s, x) => s + x.signalCount, 0);

    return {
      area: scopedArea,
      reportingPeriod: window,
      items: visible.slice(start, start + query.limit).map((g) => ({
        medicineId: g.medicineId,
        medicineName: g.medicineName,
        area: g.area,
        searchOutcome: g.searchOutcome,
        unmetSignals: g.signalCount,
      })),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
      minThreshold: this.minThreshold,
      ...assessDataSufficiency(totalVisible, this.minThreshold),
    };
  }

  async getMedicineInsights(
    userId: string,
    medicineId: string,
    query: { area?: string; fromDate?: string; toDate?: string; granularity: 'day' | 'week' }
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const exists = await this.repo.medicineExists(medicineId);
    if (!exists) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Medicine ${medicineId} not found.`);
    }

    const window = this.resolveWindow(query.fromDate, query.toDate);
    const today = getIndianTimeParts().dateStr;

    const rows = await this.repo.listAggregates({
      fromDate: window.fromDate,
      toDate: window.toDate,
      area: scopedArea,
      medicineId,
    });

    const bucketMap = new Map<string, { periodStart: string; signalCount: number; unmetSignals: number }>();
    for (const r of rows) {
      const periodStart =
        query.granularity === 'week' ? toWeekBucketStart(r.bucketDate) : r.bucketDate;
      const cur = bucketMap.get(periodStart) ?? { periodStart, signalCount: 0, unmetSignals: 0 };
      cur.signalCount += r.signalCount;
      if (UNMET_OUTCOMES.includes(r.searchOutcome)) {
        cur.unmetSignals += r.signalCount;
      }
      bucketMap.set(periodStart, cur);
    }

    const { visible } = applyKAnonymityThreshold(
      Array.from(bucketMap.values()),
      this.minThreshold
    );
    visible.sort((a, b) => a.periodStart.localeCompare(b.periodStart));

    const totalVisibleSignals = visible.reduce((s, x) => s + x.signalCount, 0);
    const totalVisibleUnmet = visible.reduce((s, x) => s + x.unmetSignals, 0);

    const slots = await this.repo.listEligibleInventorySlots({
      area: scopedArea,
      medicineId,
    });
    const supply = computeEligibleSupplySummary(slots, today);
    const sufficiency = assessDataSufficiency(totalVisibleSignals, this.minThreshold);
    const latestRun = await this.repo.getLatestAggregationRun();

    let localDemandLevel: 'INSUFFICIENT_DATA' | 'LOW' | 'MODERATE' | 'HIGH' = 'INSUFFICIENT_DATA';
    if (sufficiency.isSufficientData) {
      if (totalVisibleSignals >= this.minThreshold * 6) localDemandLevel = 'HIGH';
      else if (totalVisibleSignals >= this.minThreshold * 2) localDemandLevel = 'MODERATE';
      else localDemandLevel = 'LOW';
    }

    return {
      medicineId,
      medicineName: rows[0]?.medicineName ?? null,
      area: scopedArea,
      reportingPeriod: { ...window, granularity: query.granularity },
      localDemandLevel,
      searchVolume: sufficiency.isSufficientData ? totalVisibleSignals : 0,
      unmetDemandSignals: totalVisibleUnmet >= this.minThreshold ? totalVisibleUnmet : 0,
      trend: visible.map((v) => ({
        periodStart: v.periodStart,
        searchSignals: v.signalCount,
        unmetSignals: v.unmetSignals >= this.minThreshold ? v.unmetSignals : 0,
      })),
      currentEligibleSupply: supply,
      dataFreshness: {
        latestBucketDate: rows[0]?.bucketDate ?? null,
        lastCleanupAt: latestRun?.completedAt ?? null,
        retentionDays: this.retentionDays,
      },
      minThreshold: this.minThreshold,
      ...sufficiency,
    };
  }

  async getMyPharmacyDemandInsights(
    userId: string,
    query: { fromDate?: string; toDate?: string; granularity: 'day' | 'week'; medicineId?: string }
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const overview = await this.getDemandOverview(userId, {
      area: pharmacy.location?.area,
      fromDate: query.fromDate,
      toDate: query.toDate,
      granularity: query.granularity,
    });

    const trends = await this.getDemandTrends(userId, {
      area: pharmacy.location?.area,
      medicineId: query.medicineId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      granularity: query.granularity,
      page: 1,
      limit: 20,
    });

    return {
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      permittedArea: pharmacy.location?.area ?? 'UNKNOWN_AREA',
      permittedCity: pharmacy.location?.city ?? 'UNKNOWN',
      overview,
      trends: trends.items,
    };
  }

  async runRetentionCleanup(): Promise<{
    dedupPurged: number;
    aggregatesPurged: number;
    cutoffDate: string;
  }> {
    return this.repo.cleanupExpiredData(this.retentionDays);
  }
}

export const intelligenceService = new IntelligenceService();
