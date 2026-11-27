import { AppError } from '../types/index.js';

export type TransferStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'CANCELLED';

export type TransferActorSide = 'REQUESTING' | 'SUPPLYING';

interface TransitionRule {
  nextStatus: TransferStatus;
  allowedSides: ReadonlyArray<TransferActorSide>;
}

const STATE_TRANSITIONS: Record<TransferStatus, ReadonlyArray<TransitionRule>> = {
  REQUESTED: [
    { nextStatus: 'APPROVED', allowedSides: ['SUPPLYING'] },
    { nextStatus: 'REJECTED', allowedSides: ['SUPPLYING'] },
    { nextStatus: 'CANCELLED', allowedSides: ['REQUESTING'] },
  ],
  APPROVED: [
    { nextStatus: 'DISPATCHED', allowedSides: ['SUPPLYING'] },
    { nextStatus: 'CANCELLED', allowedSides: ['REQUESTING', 'SUPPLYING'] },
  ],
  DISPATCHED: [{ nextStatus: 'RECEIVED', allowedSides: ['REQUESTING'] }],
  REJECTED: [],
  RECEIVED: [],
  CANCELLED: [],
};

/**
 * Centralized state-transition validator enforcing permitted workflow transitions
 * and actor side authorization.
 */
export function validateTransferTransition(
  currentStatus: TransferStatus,
  targetStatus: TransferStatus,
  actorSide: TransferActorSide
): void {
  const permitted = STATE_TRANSITIONS[currentStatus] || [];
  const matchingRule = permitted.find((r) => r.nextStatus === targetStatus);

  if (!matchingRule) {
    throw new AppError(
      409,
      'INVALID_STATE_TRANSITION',
      `Transition from ${currentStatus} to ${targetStatus} is not permitted.`
    );
  }

  if (!matchingRule.allowedSides.includes(actorSide)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      `Your pharmacy (${actorSide}) is not authorized to transition a transfer from ${currentStatus} to ${targetStatus}.`
    );
  }
}

export interface TransferEligibilityPolicy {
  requireVerifiedPharmacies: boolean;
  allowControlledSubstances: boolean;
  allowColdChainTransfer: boolean;
  allowPrescriptionMedicines: boolean;
  minDaysToExpiry: number;
}

export const DEFAULT_ELIGIBILITY_POLICY: TransferEligibilityPolicy = {
  requireVerifiedPharmacies: false, // Configurable; set true once KYC verification flow is live
  allowControlledSubstances: false,
  allowColdChainTransfer: false,
  allowPrescriptionMedicines: true,
  minDaysToExpiry: 30,
};

export function evaluateTransferEligibility(
  params: {
    supplyingPharmacyActive: boolean;
    supplyingPharmacyVerified: boolean;
    requestingPharmacyActive: boolean;
    requestingPharmacyVerified: boolean;
    storageCondition: string;
    isPrescriptionRequired: boolean;
    expiryDate: string;
    quantityAvailable: number;
    requestedQuantity: number;
  },
  policy: TransferEligibilityPolicy = DEFAULT_ELIGIBILITY_POLICY,
  todayIstDate: string
): { eligible: boolean; reason?: string } {
  if (!params.supplyingPharmacyActive || !params.requestingPharmacyActive) {
    return { eligible: false, reason: 'Both participating pharmacies must be active.' };
  }

  if (
    policy.requireVerifiedPharmacies &&
    (!params.supplyingPharmacyVerified || !params.requestingPharmacyVerified)
  ) {
    return {
      eligible: false,
      reason: 'Both participating pharmacies must have verified licensing status.',
    };
  }

  if (!policy.allowControlledSubstances && params.storageCondition === 'Controlled Substance') {
    return {
      eligible: false,
      reason: 'Controlled substances are restricted from peer-to-peer stock transfers.',
    };
  }

  if (
    !policy.allowColdChainTransfer &&
    (params.storageCondition === 'Refrigerated (2-8C)' || params.storageCondition === 'Cold Storage')
  ) {
    return {
      eligible: false,
      reason: `Cold-chain medicine (${params.storageCondition}) requires certified cold-chain transport policy.`,
    };
  }

  if (!policy.allowPrescriptionMedicines && params.isPrescriptionRequired) {
    return {
      eligible: false,
      reason: 'Prescription medicines are disabled by current transfer policy.',
    };
  }

  const fromMs = Date.parse(`${todayIstDate}T00:00:00Z`);
  const expMs = Date.parse(`${params.expiryDate}T00:00:00Z`);
  const daysToExpiry = Math.round((expMs - fromMs) / (1000 * 60 * 60 * 24));

  if (daysToExpiry <= 0) {
    return { eligible: false, reason: 'Expired stock cannot be transferred.' };
  }

  if (daysToExpiry < policy.minDaysToExpiry) {
    return {
      eligible: false,
      reason: `Stock expires in ${daysToExpiry} days (minimum ${policy.minDaysToExpiry} days required for transfer).`,
    };
  }

  if (params.quantityAvailable < params.requestedQuantity) {
    return {
      eligible: false,
      reason: `Insufficient available stock (${params.quantityAvailable} available, ${params.requestedQuantity} requested).`,
    };
  }

  return { eligible: true };
}
