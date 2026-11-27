import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import {
  AddInventoryItemInput,
  AdjustInventoryInput,
  deriveStockStatus,
  InventoryMovementRecord,
  IPharmacyRepository,
  OperatingHourEntry,
  PharmacyProfileRecord,
  PrivateInventoryItemRecord,
  RegisterPharmacyInput,
  UpdateInventoryItemInput,
  UpdatePharmacyProfileInput,
} from '../src/repositories/pharmacyRepository.js';
import { PharmacyService } from '../src/services/pharmacyService.js';
import { AppError } from '../src/types/index.js';
import { TokenVerifier } from '../src/middleware/auth.js';

const USER_OWNER_A = 'aaaa1111-1111-4111-8111-111111111111';
const USER_OWNER_B = 'bbbb2222-2222-4222-8222-222222222222';
const USER_UNREGISTERED = 'cccc3333-3333-4333-8333-333333333333';
const MED_PARACETAMOL = '11111111-1111-4111-8111-111111111101';
const MED_AMOXICILLIN = '11111111-1111-4111-8111-111111111103';

class InMemoryPharmacyRepository implements IPharmacyRepository {
  private pharmacies: PharmacyProfileRecord[] = [];
  private hours = new Map<string, OperatingHourEntry[]>();
  private inventory: PrivateInventoryItemRecord[] = [];
  private history: InventoryMovementRecord[] = [];
  private auditSeq = 1;

  async findPharmacyByUserId(userId: string): Promise<PharmacyProfileRecord | null> {
    return this.pharmacies.find((p) => p.ownerUserId === userId) ?? null;
  }

  async createPharmacyForUser(
    userId: string,
    input: RegisterPharmacyInput
  ): Promise<PharmacyProfileRecord> {
    if (await this.findPharmacyByUserId(userId)) {
      throw new AppError(409, 'CONFLICT', 'Authenticated user already has a registered pharmacy.');
    }
    const now = new Date().toISOString();
    const record: PharmacyProfileRecord = {
      id: crypto.randomUUID(),
      ownerUserId: userId,
      name: input.name,
      licenseNumber: input.licenseNumber ?? null,
      isLicensedVerified: false,
      verificationStatus: 'PENDING',
      phone: input.phone,
      email: input.email ?? null,
      isActive: true,
      is24x7: input.is24x7,
      tier: input.tier,
      isDemo: false,
      location: {
        ...input.location,
        isLocationVerified: false,
      },
      createdAt: now,
      updatedAt: now,
    };
    this.pharmacies.push(record);
    return record;
  }

  async updatePharmacyProfile(
    pharmacyId: string,
    input: UpdatePharmacyProfileInput
  ): Promise<PharmacyProfileRecord> {
    const pharm = this.pharmacies.find((p) => p.id === pharmacyId);
    if (!pharm) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Pharmacy not found');

    if (input.name !== undefined) pharm.name = input.name;
    if (input.phone !== undefined) pharm.phone = input.phone;
    if (input.email !== undefined) pharm.email = input.email;
    if (input.licenseNumber !== undefined) pharm.licenseNumber = input.licenseNumber;
    if (input.is24x7 !== undefined) pharm.is24x7 = input.is24x7;
    if (input.location) {
      pharm.location = { ...pharm.location, ...input.location };
    }
    pharm.updatedAt = new Date().toISOString();
    return pharm;
  }

  async getOperatingHours(pharmacyId: string): Promise<OperatingHourEntry[]> {
    return this.hours.get(pharmacyId) ?? [];
  }

  async upsertOperatingHours(
    pharmacyId: string,
    entries: OperatingHourEntry[]
  ): Promise<OperatingHourEntry[]> {
    const existing = [...(this.hours.get(pharmacyId) ?? [])];
    for (const entry of entries) {
      const idx = existing.findIndex((e) => e.dayOfWeek === entry.dayOfWeek);
      if (idx >= 0) existing[idx] = entry;
      else existing.push(entry);
    }
    existing.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    this.hours.set(pharmacyId, existing);
    return existing;
  }

  async listAllInventory(pharmacyId: string): Promise<PrivateInventoryItemRecord[]> {
    return this.inventory.filter((i) => i.pharmacyId === pharmacyId);
  }

  async getInventoryItem(
    pharmacyId: string,
    itemId: string
  ): Promise<PrivateInventoryItemRecord | null> {
    return (
      this.inventory.find((i) => i.id === itemId && i.pharmacyId === pharmacyId) ?? null
    );
  }

  async addInventoryItem(
    pharmacyId: string,
    userId: string,
    input: AddInventoryItemInput
  ): Promise<PrivateInventoryItemRecord> {
    const dup = this.inventory.find(
      (i) =>
        i.pharmacyId === pharmacyId &&
        i.medicineId === input.medicineId &&
        i.batchNumber === input.batchNumber
    );
    if (dup) {
      throw new AppError(409, 'CONFLICT', 'Duplicate batch for this medicine.');
    }

    const isParacetamol = input.medicineId === MED_PARACETAMOL;
    const item: PrivateInventoryItemRecord = {
      id: crypto.randomUUID(),
      pharmacyId,
      medicineId: input.medicineId,
      medicineName: isParacetamol ? 'Paracetamol 650 mg Tablet' : 'Amoxicillin 625 mg Tablet',
      genericName: isParacetamol ? 'Paracetamol' : 'Amoxicillin',
      dosageForm: 'Tablet',
      strength: isParacetamol ? '650 mg' : '625 mg',
      packSize: 'Strip of 15 Tablets',
      brands: isParacetamol ? ['Dolo 650', 'Calpol 650'] : ['Augmentin 625'],
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      quantityAvailable: input.quantityAvailable,
      quantityReserved: input.quantityReserved,
      mrp: input.mrp,
      sellingPrice: input.sellingPrice,
      unitCostPrice: input.unitCostPrice ?? null,
      reorderThreshold: input.reorderThreshold,
      status: deriveStockStatus(input.quantityAvailable, input.reorderThreshold),
      isExpired: false,
      updatedAt: new Date().toISOString(),
    };
    this.inventory.push(item);

    if (input.quantityAvailable > 0) {
      this.history.push({
        id: this.auditSeq++,
        inventoryId: item.id,
        pharmacyId,
        medicineId: input.medicineId,
        medicineName: item.medicineName,
        movementType: 'ADD',
        deltaQuantity: input.quantityAvailable,
        previousQuantity: 0,
        resultingQuantity: input.quantityAvailable,
        reason: 'INITIAL_STOCK',
        actorId: userId,
        notes: `Initial batch ${input.batchNumber}`,
        createdAt: new Date().toISOString(),
      });
    }
    return item;
  }

  async updateInventoryItem(
    pharmacyId: string,
    itemId: string,
    input: UpdateInventoryItemInput
  ): Promise<PrivateInventoryItemRecord> {
    const item = await this.getInventoryItem(pharmacyId, itemId);
    if (!item) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Inventory item not found');
    const nextMrp = input.mrp ?? item.mrp;
    const nextPrice = input.sellingPrice ?? item.sellingPrice;
    if (nextPrice > nextMrp) {
      throw new AppError(400, 'VALIDATION_ERROR', 'sellingPrice cannot exceed MRP.');
    }
    if (input.expiryDate !== undefined) item.expiryDate = input.expiryDate;
    if (input.mrp !== undefined) item.mrp = input.mrp;
    if (input.sellingPrice !== undefined) item.sellingPrice = input.sellingPrice;
    if (input.unitCostPrice !== undefined) item.unitCostPrice = input.unitCostPrice;
    if (input.reorderThreshold !== undefined) {
      item.reorderThreshold = input.reorderThreshold;
      item.status = deriveStockStatus(item.quantityAvailable, item.reorderThreshold);
    }
    item.updatedAt = new Date().toISOString();
    return item;
  }

  async adjustInventoryAtomic(
    pharmacyId: string,
    itemId: string,
    userId: string,
    input: AdjustInventoryInput
  ) {
    const item = await this.getInventoryItem(pharmacyId, itemId);
    if (!item) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Inventory item not found.');
    }
    const prev = item.quantityAvailable;
    const next = prev + input.deltaQuantity;
    if (next < 0) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'Adjustment would result in negative stock.');
    }
    item.quantityAvailable = next;
    item.status = deriveStockStatus(next, item.reorderThreshold);
    item.updatedAt = new Date().toISOString();

    const auditId = this.auditSeq++;
    this.history.push({
      id: auditId,
      inventoryId: item.id,
      pharmacyId,
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      movementType: input.movementType,
      deltaQuantity: input.deltaQuantity,
      previousQuantity: prev,
      resultingQuantity: next,
      reason: input.reason,
      actorId: userId,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    });

    return { inventoryId: item.id, previousQuantity: prev, newQuantity: next, auditId };
  }

  async getItemHistory(pharmacyId: string, itemId: string): Promise<InventoryMovementRecord[]> {
    return this.history
      .filter((h) => h.pharmacyId === pharmacyId && h.inventoryId === itemId)
      .sort((a, b) => b.id - a.id);
  }

  async getRecentMovements(pharmacyId: string, limit: number): Promise<InventoryMovementRecord[]> {
    return this.history
      .filter((h) => h.pharmacyId === pharmacyId)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }

  // Helper to seed an expired batch directly for alert/dashboard testing
  seedExpiredItem(pharmacyId: string) {
    this.inventory.push({
      id: crypto.randomUUID(),
      pharmacyId,
      medicineId: MED_AMOXICILLIN,
      medicineName: 'Amoxicillin 625 mg Tablet',
      genericName: 'Amoxicillin',
      dosageForm: 'Tablet',
      strength: '625 mg',
      packSize: 'Strip of 10 Tablets',
      brands: ['Augmentin 625'],
      batchNumber: 'EXP-2024',
      expiryDate: '2024-01-01',
      quantityAvailable: 15,
      quantityReserved: 0,
      mrp: 200,
      sellingPrice: 180,
      unitCostPrice: 130,
      reorderThreshold: 10,
      status: 'IN_STOCK',
      isExpired: true,
      updatedAt: new Date().toISOString(),
    });
  }
}

const mockVerifier: TokenVerifier = async (token: string) => {
  if (token === 'token-owner-a') return { id: USER_OWNER_A, email: 'ownera@pharmacy.in' };
  if (token === 'token-owner-b') return { id: USER_OWNER_B, email: 'ownerb@pharmacy.in' };
  if (token === 'token-unreg') return { id: USER_UNREGISTERED, email: 'new@pharmacy.in' };
  return null;
};

let server: Server;
let baseUrl: string;
let repo: InMemoryPharmacyRepository;
let ownerAItemId: string;

test.before(() => {
  repo = new InMemoryPharmacyRepository();
  const service = new PharmacyService(repo);
  const app = createApp({ pharmacyService: service, tokenVerifier: mockVerifier });
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

test.after(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test('Auth: rejects missing or invalid Bearer tokens with 401 UNAUTHORIZED', async () => {
  const noAuth = await fetch(`${baseUrl}/api/v1/pharmacies/me`);
  assert.equal(noAuth.status, 401);

  const badAuth = await fetch(`${baseUrl}/api/v1/pharmacies/me`, {
    headers: { Authorization: 'Bearer invalid-jwt' },
  });
  assert.equal(badAuth.status, 401);

  const unreg = await fetch(`${baseUrl}/api/v1/pharmacies/me`, {
    headers: { Authorization: 'Bearer token-unreg' },
  });
  assert.equal(unreg.status, 403);
});

test('Registration: creates pharmacy, rejects duplicate registration, and validates Indian PIN', async () => {
  const badPin = await fetch(`${baseUrl}/api/v1/pharmacies`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Alpha Chemist',
      phone: '+91-755-1234567',
      location: {
        address: '10 MP Nagar',
        area: 'MP Nagar',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '01234', // Invalid Indian PIN
        lat: 23.2323,
        lng: 77.4332,
      },
    }),
  });
  assert.equal(badPin.status, 400);

  const res = await fetch(`${baseUrl}/api/v1/pharmacies`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Alpha Chemist',
      phone: '+91-755-1234567',
      email: 'alpha@chemist.in',
      licenseNumber: 'MP-BPL-2026-001',
      location: {
        address: '10 MP Nagar Zone-I',
        area: 'MP Nagar',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462011',
        lat: 23.2323,
        lng: 77.4332,
      },
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.name, 'Alpha Chemist');
  assert.equal(body.data.verificationStatus, 'PENDING');
  assert.equal(body.data.isLicensedVerified, false);

  // Duplicate registration must fail with 409 CONFLICT
  const dup = await fetch(`${baseUrl}/api/v1/pharmacies`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Alpha Second Store',
      phone: '+91-755-9999999',
      location: {
        address: '20 Arera',
        area: 'Arera',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462016',
        lat: 23.21,
        lng: 77.43,
      },
    }),
  });
  assert.equal(dup.status, 409);
});

test('Profile & Operating Hours: retrieves and updates authorized profile', async () => {
  const getRes = await fetch(`${baseUrl}/api/v1/pharmacies/me`, {
    headers: { Authorization: 'Bearer token-owner-a' },
  });
  assert.equal(getRes.status, 200);

  const putRes = await fetch(`${baseUrl}/api/v1/pharmacies/me`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone: '+91-755-7654321' }),
  });
  assert.equal(putRes.status, 200);
  const putBody = await putRes.json();
  assert.equal(putBody.data.phone, '+91-755-7654321');

  const hrsRes = await fetch(`${baseUrl}/api/v1/pharmacies/me/operating-hours`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hours: [
        { dayOfWeek: 1, openTime: '09:00', closeTime: '21:00', isClosed: false, timezone: 'Asia/Kolkata' },
        { dayOfWeek: 0, openTime: null, closeTime: null, isClosed: true, timezone: 'Asia/Kolkata' },
      ],
    }),
  });
  assert.equal(hrsRes.status, 200);
  const hrsBody = await hrsRes.json();
  assert.equal(hrsBody.data.hours.length, 2);
});

test('Inventory: validates inputs, prevents expired additions & negative stock, supports concurrent adjustments & history', async () => {
  // Invalid sellingPrice > MRP -> 400
  const badPrice = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      medicineId: MED_PARACETAMOL,
      batchNumber: 'BATCH-01',
      expiryDate: '2028-12-31',
      quantityAvailable: 20,
      mrp: 30,
      sellingPrice: 35,
    }),
  });
  assert.equal(badPrice.status, 400);

  // Already expired batch -> 400
  const expiredAdd = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      medicineId: MED_PARACETAMOL,
      batchNumber: 'BATCH-OLD',
      expiryDate: '2024-01-01',
      quantityAvailable: 10,
      mrp: 30,
      sellingPrice: 28,
    }),
  });
  assert.equal(expiredAdd.status, 400);

  // Valid addition
  const addRes = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      medicineId: MED_PARACETAMOL,
      batchNumber: 'BATCH-01',
      expiryDate: '2028-12-31',
      quantityAvailable: 20,
      mrp: 34,
      sellingPrice: 30,
      unitCostPrice: 21,
      reorderThreshold: 10,
    }),
  });
  assert.equal(addRes.status, 201);
  const addBody = await addRes.json();
  ownerAItemId = addBody.data.id;
  assert.equal(addBody.data.status, 'IN_STOCK');

  // Negative stock prevention -> 409 INSUFFICIENT_STOCK
  const negRes = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory/${ownerAItemId}/adjust`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-a',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deltaQuantity: -25,
      movementType: 'SALE',
      reason: 'SALE',
    }),
  });
  assert.equal(negRes.status, 409);

  // Concurrent stock adjustments (5 parallel -3 deductions = -15 -> remaining 5, LOW_STOCK)
  const concurrent = await Promise.all(
    Array.from({ length: 5 }, (_, idx) =>
      fetch(`${baseUrl}/api/v1/pharmacies/me/inventory/${ownerAItemId}/adjust`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-owner-a',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deltaQuantity: -3,
          movementType: 'SALE',
          reason: 'SALE',
          notes: `Concurrent sale #${idx + 1}`,
        }),
      })
    )
  );
  for (const r of concurrent) {
    assert.equal(r.status, 200);
  }

  // Verify final quantity is 5 (LOW_STOCK) and history has 6 records (1 initial + 5 sales)
  const itemRes = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory/${ownerAItemId}`, {
    headers: { Authorization: 'Bearer token-owner-a' },
  });
  const itemBody = await itemRes.json();
  assert.equal(itemBody.data.quantityAvailable, 5);
  assert.equal(itemBody.data.status, 'LOW_STOCK');

  const histRes = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory/${ownerAItemId}/history`, {
    headers: { Authorization: 'Bearer token-owner-a' },
  });
  const histBody = await histRes.json();
  assert.equal(histBody.data.history.length, 6);
});

test('Tenant Isolation: Owner B cannot access or adjust Owner A inventory', async () => {
  // Register Owner B's separate pharmacy
  const regB = await fetch(`${baseUrl}/api/v1/pharmacies`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-b',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Beta Pharmacy',
      phone: '+91-755-8888888',
      location: {
        address: '50 Kolar Road',
        area: 'Kolar Road',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462042',
        lat: 23.18,
        lng: 77.42,
      },
    }),
  });
  assert.equal(regB.status, 201);

  // Owner B tries to read Owner A's inventory item -> 404 (not in Owner B's tenant)
  const crossGet = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory/${ownerAItemId}`, {
    headers: { Authorization: 'Bearer token-owner-b' },
  });
  assert.equal(crossGet.status, 404);

  // Owner B tries to adjust Owner A's inventory item -> 404
  const crossAdj = await fetch(`${baseUrl}/api/v1/pharmacies/me/inventory/${ownerAItemId}/adjust`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-owner-b',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deltaQuantity: -1,
      movementType: 'SALE',
      reason: 'SALE',
    }),
  });
  assert.equal(crossAdj.status, 404);
});

test('Dashboard, Pagination, Filters, & Alerts: accurate metrics and expired separation', async () => {
  const ownerAPharm = await repo.findPharmacyByUserId(USER_OWNER_A);
  repo.seedExpiredItem(ownerAPharm!.id);

  // Search by brand name ("Dolo") + status filter
  const searchRes = await fetch(
    `${baseUrl}/api/v1/pharmacies/me/inventory?q=Dolo&status=LOW_STOCK&page=1&limit=10`,
    { headers: { Authorization: 'Bearer token-owner-a' } }
  );
  const searchBody = await searchRes.json();
  assert.equal(searchBody.data.items.length, 1);
  assert.equal(searchBody.data.pagination.total, 1);

  // Dashboard excludes expired batch from totalActiveItems
  const dashRes = await fetch(`${baseUrl}/api/v1/pharmacies/me/dashboard`, {
    headers: { Authorization: 'Bearer token-owner-a' },
  });
  assert.equal(dashRes.status, 200);
  const dashBody = await dashRes.json();
  assert.equal(dashBody.data.metrics.totalActiveItems, 1);
  assert.equal(dashBody.data.metrics.lowStockCount, 1);
  assert.equal(dashBody.data.metrics.expiredCount, 1);
  assert.equal(dashBody.data.recentMovements.length, 6);

  // Alerts clearly distinguish EXPIRED from LOW_STOCK
  const alertsRes = await fetch(`${baseUrl}/api/v1/pharmacies/me/alerts?nearExpiryDays=30`, {
    headers: { Authorization: 'Bearer token-owner-a' },
  });
  assert.equal(alertsRes.status, 200);
  const alertsBody = await alertsRes.json();
  assert.equal(alertsBody.data.summary.expired, 1);
  assert.equal(alertsBody.data.summary.lowStock, 1);
});
