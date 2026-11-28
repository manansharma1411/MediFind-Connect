import { EligibleStockCandidateRecord } from '../../repositories/collaborationRepository.js';
import {
  DEFAULT_ELIGIBILITY_POLICY,
  evaluateTransferEligibility,
} from '../collaborationStateMachine.js';
import { calculateDistanceKm } from '../medicineService.js';
import {
  AI_ALGORITHM_VERSION,
  ConfidenceLevel,
  SupplyDemandMatchItem,
} from './aiTypes.js';

export interface MatchingInput {
  requestingPharmacyId: string;
  requestingArea: string;
  requestingLat?: number;
  requestingLng?: number;
  maxDistanceKm?: number;
  areaDemandByMedicine: Map<
    string,
    { totalSignals: number; unmetSignals: number; latestDataDate: string | null }
  >;
  candidates: EligibleStockCandidateRecord[];
  fromDate: string;
  toDate: string;
  todayStr: string;
  minThreshold: number;
  now?: Date;
}

/**
 * Surfaces potential peer-to-peer transfer opportunities without ever auto-creating
 * transfers, exposing private supplier counts, or recommending ineligible stock.
 */
export function computeSupplyDemandMatches(input: MatchingInput): SupplyDemandMatchItem[] {
  const nowIso = (input.now ?? new Date()).toISOString();
  const hasCoords =
    input.requestingLat !== undefined && input.requestingLng !== undefined;
  const matches: SupplyDemandMatchItem[] = [];

  for (const c of input.candidates) {
    if (c.pharmacyId === input.requestingPharmacyId) continue;

    const eligibility = evaluateTransferEligibility(
      {
        supplyingPharmacyActive: c.pharmacyIsActive,
        supplyingPharmacyVerified: c.pharmacyIsVerified,
        requestingPharmacyActive: true,
        requestingPharmacyVerified: true,
        storageCondition: c.storageCondition,
        isPrescriptionRequired: c.isPrescriptionRequired,
        expiryDate: c.expiryDate,
        quantityAvailable: c.quantityAvailable,
        requestedQuantity: 1,
      },
      DEFAULT_ELIGIBILITY_POLICY,
      input.todayStr
    );
    if (!eligibility.eligible) continue;

    const demand = input.areaDemandByMedicine.get(c.medicineId);
    if (!demand || demand.totalSignals < input.minThreshold || demand.unmetSignals <= 0) {
      continue;
    }

    const distanceKm = hasCoords
      ? calculateDistanceKm(input.requestingLat!, input.requestingLng!, c.lat, c.lng)
      : null;
    if (
      input.maxDistanceKm !== undefined &&
      distanceKm !== null &&
      distanceKm > input.maxDistanceKm
    ) {
      continue;
    }

    const staleDays = demand.latestDataDate
      ? Math.round(
          (Date.parse(`${input.todayStr}T00:00:00Z`) -
            Date.parse(`${demand.latestDataDate}T00:00:00Z`)) /
            86400000
        )
      : null;
    const isStale = staleDays !== null && staleDays > 14;

    const confidence: ConfidenceLevel =
      !isStale && demand.totalSignals >= input.minThreshold * 3
        ? 'HIGH'
        : demand.totalSignals >= input.minThreshold * 2
          ? 'MODERATE'
          : 'LOW';

    matches.push({
      medicineId: c.medicineId,
      medicineName: c.medicineName,
      genericName: c.genericName,
      dosageForm: c.dosageForm,
      strength: c.strength,
      packSize: c.packSize,
      requestingArea: input.requestingArea,
      areaDemandSignals: demand.totalSignals,
      areaUnmetSignals: demand.unmetSignals,
      supplyingPharmacyId: c.pharmacyId,
      supplyingPharmacyName: c.pharmacyName,
      supplyingArea: c.area,
      supplyingCity: c.city,
      distanceKm,
      availabilityBand: c.quantityAvailable >= 20 ? 'ELIGIBLE_HIGH' : 'ELIGIBLE_LIMITED',
      sellingPrice: c.sellingPrice,
      mrp: c.mrp,
      collaborationWorkflowEndpoint: '/api/v1/collaboration/transfers',
      autoCreated: false,
      algorithmVersion: AI_ALGORITHM_VERSION,
      generatedAt: nowIso,
      explanation: {
        summary: `Potential transfer match: ${c.pharmacyName} (${c.area}) holds eligible stock for ${c.medicineName} amid ${demand.unmetSignals} unmet area signals.`,
        whatWasIdentified: 'Potential peer-to-peer stock transfer opportunity (requires manual request & approval).',
        whyIdentified: `${input.requestingArea} recorded ${demand.unmetSignals} unmet search signals out of ${demand.totalSignals} total signals, and ${c.pharmacyName} is verified with eligible non-expired, non-controlled stock.`,
        influencingMetrics: {
          areaDemandSignals: demand.totalSignals,
          areaUnmetSignals: demand.unmetSignals,
          distanceKm,
          sellingPrice: c.sellingPrice,
        },
        reportingPeriod: { fromDate: input.fromDate, toDate: input.toDate },
        dataFreshness: {
          latestDataDate: demand.latestDataDate,
          isStale,
          staleReason: isStale ? `Latest demand bucket is ${staleDays} days old.` : null,
        },
        confidence,
        limitations: [
          'This is a potential match only; no transfer has been requested or reserved automatically.',
          'Exact supplier stock counts are hidden to preserve partner pharmacy privacy.',
        ],
        explanationSource: 'DETERMINISTIC',
      },
    });
  }

  matches.sort((a, b) => {
    if (b.areaUnmetSignals !== a.areaUnmetSignals) {
      return b.areaUnmetSignals - a.areaUnmetSignals;
    }
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return a.sellingPrice - b.sellingPrice;
  });

  return matches;
}
