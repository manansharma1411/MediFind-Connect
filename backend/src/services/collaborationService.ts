import {
  ICollaborationRepository,
  StockTransferRecord,
  TransferEventRecord,
} from '../repositories/collaborationRepository.js';
import { IPharmacyRepository, PharmacyProfileRecord } from '../repositories/pharmacyRepository.js';
import { AppError } from '../types/index.js';
import { calculateDistanceKm, getIndianTimeParts } from './medicineService.js';
import {
  DEFAULT_ELIGIBILITY_POLICY,
  evaluateTransferEligibility,
  TransferEligibilityPolicy,
  validateTransferTransition,
} from './collaborationStateMachine.js';

export interface PublicCollaborationStockDto {
  inventoryItemId: string;
  supplyingPharmacyId: string;
  supplyingPharmacyName: string;
  area: string;
  city: string;
  pincode: string;
  distanceKm: number | null;
  medicineId: string;
  medicineName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  isPrescriptionRequired: boolean;
  storageCondition: string;
  availableForTransferStatus: 'ELIGIBLE_HIGH' | 'ELIGIBLE_LIMITED';
  sellingPrice: number;
  mrp: number;
  lastUpdatedAt: string;
}

export class CollaborationService {
  constructor(
    private readonly collabRepo: ICollaborationRepository,
    private readonly pharmacyRepo: IPharmacyRepository,
    private readonly policy: TransferEligibilityPolicy = DEFAULT_ELIGIBILITY_POLICY
  ) {}

  private async resolvePharmacy(userId: string): Promise<PharmacyProfileRecord> {
    const pharmacy = await this.pharmacyRepo.findPharmacyByUserId(userId);
    if (!pharmacy) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'No authorized pharmacy profile found for this user.'
      );
    }
    return pharmacy;
  }

  async discoverTransferStock(
    userId: string,
    query: {
      medicineId?: string;
      q: string;
      area?: string;
      lat?: number;
      lng?: number;
      radiusKm: number;
      onlyAvailable: boolean;
      page: number;
      limit: number;
    },
    now: Date = new Date()
  ) {
    const myPharmacy = await this.resolvePharmacy(userId);
    const candidates = await this.collabRepo.findEligibleStockCandidates({
      excludePharmacyId: myPharmacy.id,
      medicineId: query.medicineId,
      q: query.q,
      area: query.area,
    });

    const { dateStr: todayIst } = getIndianTimeParts(now);
    const hasCoords = query.lat !== undefined && query.lng !== undefined;

    const eligibleList: PublicCollaborationStockDto[] = [];

    for (const c of candidates) {
      const check = evaluateTransferEligibility(
        {
          supplyingPharmacyActive: c.pharmacyIsActive,
          supplyingPharmacyVerified: c.pharmacyIsVerified,
          requestingPharmacyActive: myPharmacy.isActive,
          requestingPharmacyVerified: myPharmacy.isLicensedVerified,
          storageCondition: c.storageCondition,
          isPrescriptionRequired: c.isPrescriptionRequired,
          expiryDate: c.expiryDate,
          quantityAvailable: c.quantityAvailable,
          requestedQuantity: 1,
        },
        this.policy,
        todayIst
      );

      if (!check.eligible) continue;

      const distanceKm = hasCoords
        ? calculateDistanceKm(query.lat!, query.lng!, c.lat, c.lng)
        : null;

      if (distanceKm !== null && distanceKm > query.radiusKm) {
        continue;
      }

      // Never expose exact inventory counts, wholesale costs, or license numbers
      eligibleList.push({
        inventoryItemId: c.inventoryItemId,
        supplyingPharmacyId: c.pharmacyId,
        supplyingPharmacyName: c.pharmacyName,
        area: c.area,
        city: c.city,
        pincode: c.pincode,
        distanceKm,
        medicineId: c.medicineId,
        medicineName: c.medicineName,
        genericName: c.genericName,
        dosageForm: c.dosageForm,
        strength: c.strength,
        packSize: c.packSize,
        isPrescriptionRequired: c.isPrescriptionRequired,
        storageCondition: c.storageCondition,
        availableForTransferStatus:
          c.quantityAvailable >= 20 ? 'ELIGIBLE_HIGH' : 'ELIGIBLE_LIMITED',
        sellingPrice: c.sellingPrice,
        mrp: c.mrp,
        lastUpdatedAt: c.updatedAt,
      });
    }

    eligibleList.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return a.sellingPrice - b.sellingPrice;
    });

    const total = eligibleList.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;

    return {
      items: eligibleList.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  async createTransferRequest(
    userId: string,
    input: {
      supplyingPharmacyId: string;
      medicineId: string;
      sourceInventoryItemId: string;
      requestedQuantity: number;
      requestReason?: string;
    },
    now: Date = new Date()
  ): Promise<StockTransferRecord> {
    const myPharmacy = await this.resolvePharmacy(userId);

    if (input.supplyingPharmacyId === myPharmacy.id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Self-transfers are not permitted.');
    }

    const source = await this.collabRepo.getSourceInventoryForTransfer(
      input.supplyingPharmacyId,
      input.medicineId,
      input.sourceInventoryItemId
    );

    if (!source) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        'Source inventory item not found for the specified supplying pharmacy and medicine.'
      );
    }

    const { dateStr: todayIst } = getIndianTimeParts(now);
    const eligibility = evaluateTransferEligibility(
      {
        supplyingPharmacyActive: source.pharmacyIsActive,
        supplyingPharmacyVerified: source.pharmacyIsVerified,
        requestingPharmacyActive: myPharmacy.isActive,
        requestingPharmacyVerified: myPharmacy.isLicensedVerified,
        storageCondition: source.storageCondition,
        isPrescriptionRequired: source.isPrescriptionRequired,
        expiryDate: source.expiryDate,
        quantityAvailable: source.quantityAvailable,
        requestedQuantity: input.requestedQuantity,
      },
      this.policy,
      todayIst
    );

    if (!eligibility.eligible) {
      throw new AppError(
        400,
        'TRANSFER_INELIGIBLE',
        eligibility.reason || 'Stock is ineligible for transfer.'
      );
    }

    return this.collabRepo.createTransfer({
      requestingPharmacyId: myPharmacy.id,
      supplyingPharmacyId: input.supplyingPharmacyId,
      medicineId: input.medicineId,
      sourceInventoryItemId: input.sourceInventoryItemId,
      requestedQuantity: input.requestedQuantity,
      requestReason: input.requestReason,
      requestedByUserId: userId,
    });
  }

  async listTransfers(
    userId: string,
    query: {
      direction: 'incoming' | 'outgoing' | 'all';
      status: string;
      medicineId?: string;
      fromDate?: string;
      toDate?: string;
      page: number;
      limit: number;
    }
  ) {
    const myPharmacy = await this.resolvePharmacy(userId);
    const all = await this.collabRepo.listTransfersForPharmacy(myPharmacy.id);

    const filtered = all.filter((t) => {
      if (query.direction === 'incoming' && t.supplyingPharmacyId !== myPharmacy.id) return false;
      if (query.direction === 'outgoing' && t.requestingPharmacyId !== myPharmacy.id) return false;
      if (query.status !== 'ALL' && t.status !== query.status) return false;
      if (query.medicineId && t.medicineId !== query.medicineId) return false;
      const createdDate = t.createdAt.slice(0, 10);
      if (query.fromDate && createdDate < query.fromDate) return false;
      if (query.toDate && createdDate > query.toDate) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;

    return {
      items: filtered.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total, totalPages },
    };
  }

  private async getAuthorizedTransfer(
    userId: string,
    transferId: string
  ): Promise<{ myPharmacy: PharmacyProfileRecord; transfer: StockTransferRecord }> {
    const myPharmacy = await this.resolvePharmacy(userId);
    const transfer = await this.collabRepo.getTransferById(transferId);
    if (!transfer) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Transfer ${transferId} not found.`);
    }

    if (
      transfer.requestingPharmacyId !== myPharmacy.id &&
      transfer.supplyingPharmacyId !== myPharmacy.id
    ) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You are not authorized to access this transfer.'
      );
    }

    return { myPharmacy, transfer };
  }

  async getTransferDetails(
    userId: string,
    transferId: string
  ): Promise<{ transfer: StockTransferRecord; history: TransferEventRecord[] }> {
    const { transfer } = await this.getAuthorizedTransfer(userId, transferId);
    const history = await this.collabRepo.getTransferEvents(transferId);
    return { transfer, history };
  }

  private assertTransitionOrIdempotentRetry(
    currentStatus: StockTransferRecord['status'],
    targetStatus: StockTransferRecord['status'],
    side: 'REQUESTING' | 'SUPPLYING',
    requiredSide: 'REQUESTING' | 'SUPPLYING' | null,
    idempotencyKey?: string
  ) {
    if (requiredSide && side !== requiredSide) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Only the ${requiredSide.toLowerCase()} pharmacy can perform this action.`
      );
    }
    if (idempotencyKey && currentStatus === targetStatus) {
      return;
    }
    validateTransferTransition(currentStatus, targetStatus, side);
  }

  async approveTransfer(
    userId: string,
    transferId: string,
    approvedQuantity?: number,
    idempotencyKey?: string
  ) {
    const { myPharmacy, transfer } = await this.getAuthorizedTransfer(userId, transferId);
    const side = transfer.supplyingPharmacyId === myPharmacy.id ? 'SUPPLYING' : 'REQUESTING';
    this.assertTransitionOrIdempotentRetry(transfer.status, 'APPROVED', side, 'SUPPLYING', idempotencyKey);

    return this.collabRepo.approveTransferAtomic({
      transferId,
      supplyingPharmacyId: myPharmacy.id,
      actorId: userId,
      approvedQuantity,
      idempotencyKey,
    });
  }

  async rejectTransfer(
    userId: string,
    transferId: string,
    reason: string,
    idempotencyKey?: string
  ) {
    const { myPharmacy, transfer } = await this.getAuthorizedTransfer(userId, transferId);
    const side = transfer.supplyingPharmacyId === myPharmacy.id ? 'SUPPLYING' : 'REQUESTING';
    this.assertTransitionOrIdempotentRetry(transfer.status, 'REJECTED', side, 'SUPPLYING', idempotencyKey);

    return this.collabRepo.rejectTransferAtomic({
      transferId,
      supplyingPharmacyId: myPharmacy.id,
      actorId: userId,
      reason,
      idempotencyKey,
    });
  }

  async dispatchTransfer(
    userId: string,
    transferId: string,
    dispatchReference?: string,
    idempotencyKey?: string
  ) {
    const { myPharmacy, transfer } = await this.getAuthorizedTransfer(userId, transferId);
    const side = transfer.supplyingPharmacyId === myPharmacy.id ? 'SUPPLYING' : 'REQUESTING';
    this.assertTransitionOrIdempotentRetry(transfer.status, 'DISPATCHED', side, 'SUPPLYING', idempotencyKey);

    return this.collabRepo.dispatchTransferAtomic({
      transferId,
      supplyingPharmacyId: myPharmacy.id,
      actorId: userId,
      dispatchReference,
      idempotencyKey,
    });
  }

  async receiveTransfer(
    userId: string,
    transferId: string,
    receivedQuantity: number,
    discrepancyNotes?: string,
    idempotencyKey?: string
  ) {
    const { myPharmacy, transfer } = await this.getAuthorizedTransfer(userId, transferId);
    const side = transfer.requestingPharmacyId === myPharmacy.id ? 'REQUESTING' : 'SUPPLYING';
    this.assertTransitionOrIdempotentRetry(transfer.status, 'RECEIVED', side, 'REQUESTING', idempotencyKey);

    return this.collabRepo.receiveTransferAtomic({
      transferId,
      requestingPharmacyId: myPharmacy.id,
      actorId: userId,
      receivedQuantity,
      discrepancyNotes,
      idempotencyKey,
    });
  }

  async cancelTransfer(
    userId: string,
    transferId: string,
    reason?: string,
    idempotencyKey?: string
  ) {
    const { myPharmacy, transfer } = await this.getAuthorizedTransfer(userId, transferId);
    const side = transfer.requestingPharmacyId === myPharmacy.id ? 'REQUESTING' : 'SUPPLYING';
    this.assertTransitionOrIdempotentRetry(transfer.status, 'CANCELLED', side, null, idempotencyKey);

    return this.collabRepo.cancelTransferAtomic({
      transferId,
      actorPharmacyId: myPharmacy.id,
      actorId: userId,
      reason,
      idempotencyKey,
    });
  }
}
