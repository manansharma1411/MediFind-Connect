import {
  adminVerificationRepository,
  IAdminVerificationRepository,
} from '../repositories/adminVerificationRepository.js';
import { VerificationStatus } from '../repositories/pharmacyRepository.js';
import { AppError } from '../types/index.js';

export class AdminVerificationService {
  constructor(
    private readonly repo: IAdminVerificationRepository = adminVerificationRepository
  ) {}

  async listAllPharmacies(query: {
    q?: string;
    search?: string;
    status: 'ALL' | VerificationStatus;
    isActive: 'all' | 'true' | 'false';
    sortBy: 'createdAt' | 'name' | 'verificationStatus';
    sortOrder: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    const searchText = query.q || query.search;
    const { items, total } = await this.repo.listAllPharmacies({
      q: searchText,
      status: query.status,
      isActive: query.isActive,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      limit: query.limit,
    });
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async listPharmacies(query: {
    status: VerificationStatus;
    page: number;
    limit: number;
  }) {
    const { items, total } = await this.repo.listPharmaciesByVerificationStatus(query);
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async getVerificationDetails(pharmacyId: string) {
    const pharmacy = await this.repo.getPharmacyVerificationById(pharmacyId);
    if (!pharmacy) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        `Pharmacy ${pharmacyId} not found.`
      );
    }

    const history = await this.repo.listVerificationEvents(pharmacyId);
    return {
      pharmacy,
      history,
    };
  }

  async verifyPharmacy(
    pharmacyId: string,
    adminUserId: string,
    input: { action: 'APPROVE' | 'REJECT'; reason?: string },
    options?: { isVerifiedAdmin?: boolean }
  ) {
    const pharmacy = await this.repo.getPharmacyVerificationById(pharmacyId);
    if (!pharmacy) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        `Pharmacy ${pharmacyId} not found.`
      );
    }

    // Only block if caller is NOT a verified platform administrator
    if (!options?.isVerifiedAdmin && pharmacy.ownerUserId && pharmacy.ownerUserId === adminUserId) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Pharmacy owners cannot approve or reject their own pharmacy.'
      );
    }

    if (
      input.action === 'APPROVE' &&
      (!pharmacy.licenseNumber || pharmacy.licenseNumber.trim().length < 4)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Cannot approve a pharmacy without a valid drug license number.'
      );
    }

    return this.repo.verifyPharmacyAtomic({
      pharmacyId,
      adminUserId,
      action: input.action,
      reason: input.reason,
      isVerifiedAdmin: Boolean(options?.isVerifiedAdmin),
    });
  }

  async updatePharmacyOperationalStatus(
    pharmacyId: string,
    adminUserId: string,
    input: { action: 'SUSPEND' | 'REACTIVATE'; reason: string },
    options?: { isVerifiedAdmin?: boolean }
  ) {
    const pharmacy = await this.repo.getPharmacyVerificationById(pharmacyId);
    if (!pharmacy) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        `Pharmacy ${pharmacyId} not found.`
      );
    }

    if (!options?.isVerifiedAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Administrator privileges are required.');
    }

    return this.repo.updatePharmacyOperationalStatusAtomic({
      pharmacyId,
      adminUserId,
      action: input.action,
      reason: input.reason,
      isVerifiedAdmin: true,
    });
  }
}

export const adminVerificationService = new AdminVerificationService();
