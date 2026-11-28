import { env } from '../config/env.js';
import {
  ICollaborationRepository,
  SupabaseCollaborationRepository,
} from '../repositories/collaborationRepository.js';
import {
  IIntelligenceRepository,
  intelligenceRepository,
} from '../repositories/intelligenceRepository.js';
import {
  IPharmacyRepository,
  PharmacyProfileRecord,
  SupabasePharmacyRepository,
} from '../repositories/pharmacyRepository.js';
import { AppError } from '../types/index.js';
import { getIndianTimeParts } from './medicineService.js';
import {
  applySafeExplanationEnhancer,
  IExplanationEnhancer,
} from './ai/explanationService.js';
import {
  buildOrderedTimeSeries,
  generateDemandForecast,
} from './ai/forecastingEngine.js';
import { computeSupplyDemandMatches } from './ai/matchingEngine.js';
import { computeSmartRestock } from './ai/restockEngine.js';
import { evaluateShortageRisk } from './ai/shortageRiskEngine.js';
import {
  ShortageRadarItem,
  ShortageRiskCategory,
  SmartRestockItem,
} from './ai/aiTypes.js';

const UNMET_OUTCOMES = new Set([
  'NO_MATCH',
  'NO_ELIGIBLE_NEARBY_STOCK',
  'PARTIAL_AVAILABILITY',
]);

function shiftDays(dateStr: string, deltaDays: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + deltaDays * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export class AiIntelligenceService {
  private readonly minThreshold: number;

  constructor(
    private readonly intelRepo: IIntelligenceRepository = intelligenceRepository,
    private readonly pharmRepo: IPharmacyRepository = new SupabasePharmacyRepository(),
    private readonly collabRepo: ICollaborationRepository = new SupabaseCollaborationRepository(),
    private readonly options: {
      minThreshold?: number;
      explanationEnhancer?: IExplanationEnhancer;
    } = {}
  ) {
    this.minThreshold = options.minThreshold ?? env.DEMAND_MIN_THRESHOLD;
  }

  private async resolvePharmacy(userId: string): Promise<PharmacyProfileRecord> {
    const pharmacy = await this.pharmRepo.findPharmacyByUserId(userId);
    if (!pharmacy) {
      throw new AppError(
        403,
        'PHARMACY_PROFILE_REQUIRED',
        'An authorized pharmacy profile is required to access AI intelligence.'
      );
    }
    return pharmacy;
  }

  private enforceAreaScope(pharmacy: PharmacyProfileRecord, requestedArea?: string): string {
    const permittedArea = pharmacy.location?.area ?? 'UNKNOWN_AREA';
    if (!requestedArea) return permittedArea;
    if (requestedArea.trim().toLowerCase() !== permittedArea.toLowerCase()) {
      throw new AppError(
        403,
        'FORBIDDEN_AREA_SCOPE',
        'You may only query AI intelligence for your pharmacy’s permitted area.'
      );
    }
    return permittedArea;
  }

  async getShortageRadar(
    userId: string,
    query: {
      medicineId?: string;
      area?: string;
      riskCategory?: ShortageRiskCategory;
      page: number;
      limit: number;
    },
    now: Date = new Date()
  ) {
    const pharmacy = await this.resolvePharmacy(userId);
    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const todayStr = getIndianTimeParts(now).dateStr;
    const recentFrom = shiftDays(todayStr, -13);
    const priorFrom = shiftDays(todayStr, -27);
    const priorTo = shiftDays(todayStr, -14);
    const nearExpiryCutoff = shiftDays(todayStr, 30);

    const [aggregates, slots] = await Promise.all([
      this.intelRepo.listAggregates({
        fromDate: priorFrom,
        toDate: todayStr,
        area: scopedArea,
        medicineId: query.medicineId,
      }),
      this.intelRepo.listEligibleInventorySlots({
        area: scopedArea,
        medicineId: query.medicineId,
      }),
    ]);

    const medIds = new Set<string>();
    const medNames = new Map<string, string>();
    for (const a of aggregates) {
      if (a.medicineId) {
        medIds.add(a.medicineId);
        if (a.medicineName) medNames.set(a.medicineId, a.medicineName);
      }
    }
    for (const s of slots) {
      medIds.add(s.medicineId);
    }

    const items: ShortageRadarItem[] = [];
    for (const medId of medIds) {
      let recentDemand = 0;
      let priorDemand = 0;
      let unmetDemand = 0;
      let latestDataDate: string | null = null;

      for (const a of aggregates) {
        if (a.medicineId !== medId) continue;
        if (!latestDataDate || a.bucketDate > latestDataDate) {
          latestDataDate = a.bucketDate;
        }
        if (a.bucketDate >= recentFrom) {
          recentDemand += a.signalCount;
          if (UNMET_OUTCOMES.has(a.searchOutcome)) unmetDemand += a.signalCount;
        } else if (a.bucketDate >= priorFrom && a.bucketDate <= priorTo) {
          priorDemand += a.signalCount;
        }
      }

      let eligibleSupply = 0;
      let reservedExcluded = 0;
      let expiredExcluded = 0;
      let nearExpiryUnits = 0;
      const activePharms = new Set<string>();

      for (const s of slots) {
        if (s.medicineId !== medId) continue;
        if (!s.isPharmacyActive) continue;
        reservedExcluded += s.quantityReserved;
        if (s.expiryDate <= todayStr) {
          expiredExcluded += 1;
          continue;
        }
        eligibleSupply += s.quantityAvailable;
        if (s.expiryDate <= nearExpiryCutoff) {
          nearExpiryUnits += s.quantityAvailable;
        }
        if (s.quantityAvailable > 0) activePharms.add(s.pharmacyId);
      }

      const evaluated = evaluateShortageRisk({
        medicineId: medId,
        medicineName: medNames.get(medId) ?? medId,
        area: scopedArea,
        city: pharmacy.location?.city ?? 'UNKNOWN',
        recentDemandSignals: recentDemand,
        priorDemandSignals: priorDemand,
        unmetDemandSignals: unmetDemand,
        eligibleSupplyAvailable: eligibleSupply,
        reservedStockExcluded: reservedExcluded,
        expiredBatchesExcluded: expiredExcluded,
        nearExpiryUnitsCount: nearExpiryUnits,
        participatingPharmaciesCount: activePharms.size,
        latestDataDate,
        fromDate: recentFrom,
        toDate: todayStr,
        todayStr,
        minThreshold: this.minThreshold,
        now,
      });

      evaluated.explanation = await applySafeExplanationEnhancer(
        evaluated.explanation,
        this.options.explanationEnhancer
      );

      if (!query.riskCategory || evaluated.riskCategory === query.riskCategory) {
        items.push(evaluated);
      }
    }

    items.sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1));

    const total = items.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;

    return {
      area: scopedArea,
      reportingPeriod: { fromDate: recentFrom, toDate: todayStr },
      items: items.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async getShortageDetail(
    userId: string,
    medicineId: string,
    query: { area?: string },
    now: Date = new Date()
  ) {
    const exists = await this.intelRepo.medicineExists(medicineId);
    if (!exists) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Medicine ${medicineId} not found.`);
    }

    const list = await this.getShortageRadar(
      userId,
      { medicineId, area: query.area, page: 1, limit: 1 },
      now
    );

    if (list.items.length > 0) {
      return list.items[0];
    }

    const pharmacy = await this.resolvePharmacy(userId);
    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const todayStr = getIndianTimeParts(now).dateStr;
    return evaluateShortageRisk({
      medicineId,
      medicineName: medicineId,
      area: scopedArea,
      city: pharmacy.location?.city ?? 'UNKNOWN',
      recentDemandSignals: 0,
      priorDemandSignals: 0,
      unmetDemandSignals: 0,
      eligibleSupplyAvailable: 0,
      reservedStockExcluded: 0,
      expiredBatchesExcluded: 0,
      nearExpiryUnitsCount: 0,
      participatingPharmaciesCount: 0,
      latestDataDate: null,
      fromDate: shiftDays(todayStr, -13),
      toDate: todayStr,
      todayStr,
      minThreshold: this.minThreshold,
      now,
    });
  }

  async getMyRestockRecommendations(
    userId: string,
    query: { onlyActionable: boolean; page: number; limit: number },
    now: Date = new Date()
  ) {
    const pharmacy = await this.resolvePharmacy(userId);
    const scopedArea = pharmacy.location?.area ?? 'UNKNOWN_AREA';
    const todayStr = getIndianTimeParts(now).dateStr;
    const fromDate = shiftDays(todayStr, -29);
    const nearExpiryCutoff = shiftDays(todayStr, 30);

    const [inventory, movements, aggregates] = await Promise.all([
      this.pharmRepo.listAllInventory(pharmacy.id),
      this.pharmRepo.getRecentMovements(pharmacy.id, 200),
      this.intelRepo.listAggregates({
        fromDate,
        toDate: todayStr,
        area: scopedArea,
      }),
    ]);

    const byMed = new Map<
      string,
      {
        medicineName: string;
        eligible: number;
        reserved: number;
        expired: number;
        nearExpiry: number;
        reorderThreshold: number;
      }
    >();

    for (const item of inventory) {
      const cur = byMed.get(item.medicineId) ?? {
        medicineName: item.medicineName,
        eligible: 0,
        reserved: 0,
        expired: 0,
        nearExpiry: 0,
        reorderThreshold: item.reorderThreshold,
      };
      cur.reserved += item.quantityReserved;
      cur.reorderThreshold = Math.max(cur.reorderThreshold, item.reorderThreshold);
      if (item.expiryDate <= todayStr) {
        cur.expired += item.quantityAvailable;
      } else {
        cur.eligible += item.quantityAvailable;
        if (item.expiryDate <= nearExpiryCutoff) {
          cur.nearExpiry += item.quantityAvailable;
        }
      }
      byMed.set(item.medicineId, cur);
    }

    const salesByMed = new Map<string, number>();
    for (const m of movements) {
      if (m.createdAt.slice(0, 10) < fromDate) continue;
      if (m.reason === 'SALE' || m.movementType === 'SALE') {
        salesByMed.set(
          m.medicineId,
          (salesByMed.get(m.medicineId) ?? 0) + Math.abs(m.deltaQuantity)
        );
      }
    }

    const demandByMed = new Map<string, { signals: number; latestDate: string | null }>();
    for (const a of aggregates) {
      if (!a.medicineId) continue;
      const cur = demandByMed.get(a.medicineId) ?? { signals: 0, latestDate: null };
      cur.signals += a.signalCount;
      if (!cur.latestDate || a.bucketDate > cur.latestDate) cur.latestDate = a.bucketDate;
      demandByMed.set(a.medicineId, cur);
    }

    const items: SmartRestockItem[] = [];
    for (const [medId, inv] of byMed.entries()) {
      const dem = demandByMed.get(medId) ?? { signals: 0, latestDate: null };
      const rec = computeSmartRestock({
        pharmacyId: pharmacy.id,
        medicineId: medId,
        medicineName: inv.medicineName,
        currentEligibleStock: inv.eligible,
        reservedStockExcluded: inv.reserved,
        expiredStockExcluded: inv.expired,
        reorderThreshold: inv.reorderThreshold,
        nearExpiryUnits30d: inv.nearExpiry,
        observedSalesUnits30d: salesByMed.has(medId) ? salesByMed.get(medId)! : null,
        areaDemandSignals30d: dem.signals,
        latestDataDate: dem.latestDate,
        fromDate,
        toDate: todayStr,
        todayStr,
        minThreshold: this.minThreshold,
        now,
      });

      rec.explanation = await applySafeExplanationEnhancer(
        rec.explanation,
        this.options.explanationEnhancer
      );

      if (!query.onlyActionable || rec.suggestedRestockQuantity > 0) {
        items.push(rec);
      }
    }

    items.sort((a, b) => b.suggestedRestockQuantity - a.suggestedRestockQuantity);

    const total = items.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;

    return {
      pharmacyId: pharmacy.id,
      area: scopedArea,
      reportingPeriod: { fromDate, toDate: todayStr },
      items: items.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async getMyMedicineRestockDetail(
    userId: string,
    medicineId: string,
    now: Date = new Date()
  ) {
    const exists = await this.intelRepo.medicineExists(medicineId);
    if (!exists) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Medicine ${medicineId} not found.`);
    }

    const all = await this.getMyRestockRecommendations(
      userId,
      { onlyActionable: false, page: 1, limit: 50 },
      now
    );

    const match = all.items.find((i) => i.medicineId === medicineId);
    if (!match) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        `Medicine ${medicineId} is not present in your pharmacy inventory.`
      );
    }
    return match;
  }

  async getDemandForecast(
    userId: string,
    query: {
      medicineId: string;
      area?: string;
      horizon: number;
      granularity: 'day' | 'week';
    },
    now: Date = new Date()
  ) {
    const pharmacy = await this.resolvePharmacy(userId);
    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const exists = await this.intelRepo.medicineExists(query.medicineId);
    if (!exists) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Medicine ${query.medicineId} not found.`);
    }

    const todayStr = getIndianTimeParts(now).dateStr;
    const lookbackDays = query.granularity === 'week' ? 84 : 45;
    const fromDate = shiftDays(todayStr, -lookbackDays);

    const rows = await this.intelRepo.listAggregates({
      fromDate,
      toDate: todayStr,
      area: scopedArea,
      medicineId: query.medicineId,
    });

    const series = buildOrderedTimeSeries(rows, query.granularity);
    const result = generateDemandForecast({
      medicineId: query.medicineId,
      medicineName: rows[0]?.medicineName ?? null,
      area: scopedArea,
      granularity: query.granularity,
      horizon: query.horizon,
      series,
      fromDate,
      toDate: todayStr,
      minThreshold: this.minThreshold,
      todayStr,
      now,
    });

    result.explanation = await applySafeExplanationEnhancer(
      result.explanation,
      this.options.explanationEnhancer
    );
    return result;
  }

  async getSupplyDemandMatches(
    userId: string,
    query: {
      medicineId?: string;
      area?: string;
      maxDistanceKm?: number;
      page: number;
      limit: number;
    },
    now: Date = new Date()
  ) {
    const pharmacy = await this.resolvePharmacy(userId);
    if (!pharmacy.isLicensedVerified) {
      throw new AppError(
        403,
        'PHARMACY_NOT_VERIFIED',
        'Your pharmacy must complete license verification before viewing peer-to-peer transfer matches.'
      );
    }

    const scopedArea = this.enforceAreaScope(pharmacy, query.area);
    const todayStr = getIndianTimeParts(now).dateStr;
    const fromDate = shiftDays(todayStr, -13);

    const [aggregates, candidates] = await Promise.all([
      this.intelRepo.listAggregates({
        fromDate,
        toDate: todayStr,
        area: scopedArea,
        medicineId: query.medicineId,
      }),
      this.collabRepo.findEligibleStockCandidates({
        excludePharmacyId: pharmacy.id,
        medicineId: query.medicineId,
      }),
    ]);

    const demandMap = new Map<
      string,
      { totalSignals: number; unmetSignals: number; latestDataDate: string | null }
    >();
    for (const a of aggregates) {
      if (!a.medicineId) continue;
      const cur = demandMap.get(a.medicineId) ?? {
        totalSignals: 0,
        unmetSignals: 0,
        latestDataDate: null,
      };
      cur.totalSignals += a.signalCount;
      if (UNMET_OUTCOMES.has(a.searchOutcome)) cur.unmetSignals += a.signalCount;
      if (!cur.latestDataDate || a.bucketDate > cur.latestDataDate) {
        cur.latestDataDate = a.bucketDate;
      }
      demandMap.set(a.medicineId, cur);
    }

    const matches = computeSupplyDemandMatches({
      requestingPharmacyId: pharmacy.id,
      requestingArea: scopedArea,
      requestingLat: pharmacy.location?.lat,
      requestingLng: pharmacy.location?.lng,
      maxDistanceKm: query.maxDistanceKm,
      areaDemandByMedicine: demandMap,
      candidates,
      fromDate,
      toDate: todayStr,
      todayStr,
      minThreshold: this.minThreshold,
      now,
    });

    for (const m of matches) {
      m.explanation = await applySafeExplanationEnhancer(
        m.explanation,
        this.options.explanationEnhancer
      );
    }

    const total = matches.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;

    return {
      requestingPharmacyId: pharmacy.id,
      area: scopedArea,
      reportingPeriod: { fromDate, toDate: todayStr },
      items: matches.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
    };
  }
}

export const aiIntelligenceService = new AiIntelligenceService();
