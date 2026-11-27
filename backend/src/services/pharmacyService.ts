import {
  AddInventoryItemInput,
  AdjustInventoryInput,
  InventoryMovementRecord,
  IPharmacyRepository,
  OperatingHourEntry,
  PharmacyProfileRecord,
  PrivateInventoryItemRecord,
  RegisterPharmacyInput,
  UpdateInventoryItemInput,
  UpdatePharmacyProfileInput,
} from '../repositories/pharmacyRepository.js';
import { AppError } from '../types/index.js';
import { getIndianTimeParts } from './medicineService.js';

export interface PharmacyAlert {
  id: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NEAR_EXPIRY' | 'EXPIRED';
  severity: 'CRITICAL' | 'WARNING';
  inventoryItemId: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantityAvailable: number;
  reorderThreshold: number;
  expiryDate: string;
  daysToExpiry: number;
  message: string;
}

export interface PharmacyDashboardDto {
  pharmacy: {
    id: string;
    name: string;
    verificationStatus: string;
    isLicensedVerified: boolean;
  };
  metrics: {
    totalActiveItems: number;
    totalUnitsAvailable: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringSoonCount: number;
    expiredCount: number;
  };
  recentMovements: InventoryMovementRecord[];
}

function daysBetweenIst(fromDateStr: string, toDateStr: string): number {
  const from = Date.parse(`${fromDateStr}T00:00:00Z`);
  const to = Date.parse(`${toDateStr}T00:00:00Z`);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export class PharmacyService {
  constructor(private readonly repository: IPharmacyRepository) {}

  async resolveAuthorizedPharmacy(userId: string): Promise<PharmacyProfileRecord> {
    const pharmacy = await this.repository.findPharmacyByUserId(userId);
    if (!pharmacy) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'No authorized pharmacy profile found for this user. Please register a pharmacy first.'
      );
    }
    return pharmacy;
  }

  async registerPharmacy(
    userId: string,
    input: RegisterPharmacyInput
  ): Promise<PharmacyProfileRecord> {
    return this.repository.createPharmacyForUser(userId, input);
  }

  async getMyProfile(userId: string): Promise<PharmacyProfileRecord> {
    return this.resolveAuthorizedPharmacy(userId);
  }

  async updateMyProfile(
    userId: string,
    input: UpdatePharmacyProfileInput
  ): Promise<PharmacyProfileRecord> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    return this.repository.updatePharmacyProfile(pharmacy.id, input);
  }

  async getMyOperatingHours(userId: string): Promise<OperatingHourEntry[]> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    return this.repository.getOperatingHours(pharmacy.id);
  }

  async updateMyOperatingHours(
    userId: string,
    hours: OperatingHourEntry[]
  ): Promise<OperatingHourEntry[]> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    return this.repository.upsertOperatingHours(pharmacy.id, hours);
  }

  async getDashboard(userId: string, now: Date = new Date()): Promise<PharmacyDashboardDto> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const items = await this.repository.listAllInventory(pharmacy.id);
    const recentMovements = await this.repository.getRecentMovements(pharmacy.id, 10);
    const { dateStr: todayIst } = getIndianTimeParts(now);

    let totalActiveItems = 0;
    let totalUnitsAvailable = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    for (const item of items) {
      const daysLeft = daysBetweenIst(todayIst, item.expiryDate);
      const isExpired = daysLeft <= 0;

      if (isExpired) {
        expiredCount++;
        continue; // Expired inventory is NOT active sellable stock
      }

      totalActiveItems++;
      totalUnitsAvailable += item.quantityAvailable;

      if (item.status === 'OUT_OF_STOCK') {
        outOfStockCount++;
      } else if (item.status === 'LOW_STOCK') {
        lowStockCount++;
      }

      if (daysLeft <= 30) {
        expiringSoonCount++;
      }
    }

    return {
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        verificationStatus: pharmacy.verificationStatus,
        isLicensedVerified: pharmacy.isLicensedVerified,
      },
      metrics: {
        totalActiveItems,
        totalUnitsAvailable,
        lowStockCount,
        outOfStockCount,
        expiringSoonCount,
        expiredCount,
      },
      recentMovements,
    };
  }

  async listInventory(
    userId: string,
    query: {
      q: string;
      status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ALL';
      expiry: 'ALL' | 'NEAR_EXPIRY' | 'EXPIRED' | 'VALID';
      sortBy: 'updated_desc' | 'quantity_asc' | 'expiry_asc' | 'name_asc';
      page: number;
      limit: number;
    },
    now: Date = new Date()
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const allItems = await this.repository.listAllInventory(pharmacy.id);
    const { dateStr: todayIst } = getIndianTimeParts(now);
    const searchLower = query.q.trim().toLowerCase();

    const filtered = allItems
      .map((item) => {
        const daysLeft = daysBetweenIst(todayIst, item.expiryDate);
        return {
          ...item,
          isExpired: daysLeft <= 0,
        };
      })
      .filter((item) => {
        if (searchLower) {
          const matchesSearch =
            item.medicineName.toLowerCase().includes(searchLower) ||
            item.genericName.toLowerCase().includes(searchLower) ||
            item.batchNumber.toLowerCase().includes(searchLower) ||
            item.brands.some((b) => b.toLowerCase().includes(searchLower));
          if (!matchesSearch) return false;
        }

        if (query.status !== 'ALL' && item.status !== query.status) {
          return false;
        }

        const daysLeft = daysBetweenIst(todayIst, item.expiryDate);
        if (query.expiry === 'EXPIRED' && daysLeft > 0) return false;
        if (query.expiry === 'VALID' && daysLeft <= 0) return false;
        if (query.expiry === 'NEAR_EXPIRY' && (daysLeft <= 0 || daysLeft > 30)) return false;

        return true;
      });

    filtered.sort((a, b) => {
      switch (query.sortBy) {
        case 'quantity_asc':
          return a.quantityAvailable - b.quantityAvailable;
        case 'expiry_asc':
          return a.expiryDate.localeCompare(b.expiryDate);
        case 'name_asc':
          return a.medicineName.localeCompare(b.medicineName);
        case 'updated_desc':
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });

    const total = filtered.length;
    const totalPages = total > 0 ? Math.ceil(total / query.limit) : 0;
    const start = (query.page - 1) * query.limit;
    const items = filtered.slice(start, start + query.limit);

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

  async addInventoryItem(
    userId: string,
    input: AddInventoryItemInput,
    now: Date = new Date()
  ): Promise<PrivateInventoryItemRecord> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const { dateStr: todayIst } = getIndianTimeParts(now);

    if (input.expiryDate <= todayIst) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Cannot add already-expired medicine batch to active inventory.'
      );
    }

    return this.repository.addInventoryItem(pharmacy.id, userId, input);
  }

  async getInventoryItem(userId: string, itemId: string): Promise<PrivateInventoryItemRecord> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const item = await this.repository.getInventoryItem(pharmacy.id, itemId);
    if (!item) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        `Inventory item ${itemId} was not found for your pharmacy.`
      );
    }
    return item;
  }

  async updateInventoryItem(
    userId: string,
    itemId: string,
    input: UpdateInventoryItemInput,
    now: Date = new Date()
  ): Promise<PrivateInventoryItemRecord> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const { dateStr: todayIst } = getIndianTimeParts(now);

    if (input.expiryDate !== undefined && input.expiryDate <= todayIst) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Expiry date must be in the future for sellable inventory.'
      );
    }

    return this.repository.updateInventoryItem(pharmacy.id, itemId, input);
  }

  async adjustInventory(
    userId: string,
    itemId: string,
    input: AdjustInventoryInput
  ) {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    return this.repository.adjustInventoryAtomic(pharmacy.id, itemId, userId, input);
  }

  async getInventoryItemHistory(
    userId: string,
    itemId: string
  ): Promise<InventoryMovementRecord[]> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const item = await this.repository.getInventoryItem(pharmacy.id, itemId);
    if (!item) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        `Inventory item ${itemId} was not found for your pharmacy.`
      );
    }
    return this.repository.getItemHistory(pharmacy.id, itemId);
  }

  async getAlerts(
    userId: string,
    nearExpiryDays = 30,
    now: Date = new Date()
  ): Promise<{ alerts: PharmacyAlert[]; summary: Record<string, number> }> {
    const pharmacy = await this.resolveAuthorizedPharmacy(userId);
    const items = await this.repository.listAllInventory(pharmacy.id);
    const { dateStr: todayIst } = getIndianTimeParts(now);

    const alerts: PharmacyAlert[] = [];

    for (const item of items) {
      const daysToExpiry = daysBetweenIst(todayIst, item.expiryDate);

      if (daysToExpiry <= 0) {
        alerts.push({
          id: `expired-${item.id}`,
          type: 'EXPIRED',
          severity: 'CRITICAL',
          inventoryItemId: item.id,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          quantityAvailable: item.quantityAvailable,
          reorderThreshold: item.reorderThreshold,
          expiryDate: item.expiryDate,
          daysToExpiry,
          message: `Batch ${item.batchNumber} expired on ${item.expiryDate}. Remove from sellable stock immediately.`,
        });
        continue; // Do not emit low-stock alerts for expired batches
      }

      if (daysToExpiry <= nearExpiryDays) {
        alerts.push({
          id: `near-expiry-${item.id}`,
          type: 'NEAR_EXPIRY',
          severity: daysToExpiry <= 7 ? 'CRITICAL' : 'WARNING',
          inventoryItemId: item.id,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          quantityAvailable: item.quantityAvailable,
          reorderThreshold: item.reorderThreshold,
          expiryDate: item.expiryDate,
          daysToExpiry,
          message: `Batch ${item.batchNumber} expires in ${daysToExpiry} day(s) (${item.expiryDate}).`,
        });
      }

      if (item.quantityAvailable <= 0) {
        alerts.push({
          id: `out-of-stock-${item.id}`,
          type: 'OUT_OF_STOCK',
          severity: 'CRITICAL',
          inventoryItemId: item.id,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          quantityAvailable: item.quantityAvailable,
          reorderThreshold: item.reorderThreshold,
          expiryDate: item.expiryDate,
          daysToExpiry,
          message: `${item.medicineName} (Batch ${item.batchNumber}) is out of available stock.`,
        });
      } else if (item.quantityAvailable <= item.reorderThreshold) {
        alerts.push({
          id: `low-stock-${item.id}`,
          type: 'LOW_STOCK',
          severity: 'WARNING',
          inventoryItemId: item.id,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          quantityAvailable: item.quantityAvailable,
          reorderThreshold: item.reorderThreshold,
          expiryDate: item.expiryDate,
          daysToExpiry,
          message: `${item.medicineName} is low on stock (${item.quantityAvailable} <= threshold ${item.reorderThreshold}).`,
        });
      }
    }

    const summary = {
      total: alerts.length,
      expired: alerts.filter((a) => a.type === 'EXPIRED').length,
      nearExpiry: alerts.filter((a) => a.type === 'NEAR_EXPIRY').length,
      outOfStock: alerts.filter((a) => a.type === 'OUT_OF_STOCK').length,
      lowStock: alerts.filter((a) => a.type === 'LOW_STOCK').length,
    };

    return { alerts, summary };
  }
}
