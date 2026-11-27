import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';
import {
  EligibleStockCandidateRecord,
  ICollaborationRepository,
  StockTransferRecord,
  TransferEventRecord,
} from '../src/repositories/collaborationRepository.js';
import {
  IPharmacyRepository,
  PharmacyProfileRecord,
  PrivateInventoryItemRecord,
} from '../src/repositories/pharmacyRepository.js';
import { CollaborationService } from '../src/services/collaborationService.js';
import { TransferStatus } from '../src/services/collaborationStateMachine.js';
import { AppError } from '../src/types/index.js';
import { TokenVerifier } from '../src/middleware/auth.js';

const USER_REQ = 'aaaa1111-1111-4111-8111-111111111111';
const USER_SUP = 'bbbb2222-2222-4222-8222-222222222222';
const USER_OUTSIDER = 'cccc3333-3333-4333-8333-333333333333';

const PHARM_REQ = '10000000-0000-4000-8000-000000000001';
const PHARM_SUP = '10000000-0000-4000-8000-000000000002';
const PHARM_OUTSIDER = '10000000-0000-4000-8000-000000000003';

const MED_PARACETAMOL = '20000000-0000-4000-8000-000000000001';
const MED_CONTROLLED = '20000000-0000-4000-8000-000000000002';
const MED_EXPIRED = '20000000-0000-4000-8000-000000000003';

const INV_SUP_PARA = '30000000-0000-4000-8000-000000000001';
const INV_SUP_CTRL = '30000000-0000-4000-8000-000000000002';
const INV_SUP_EXP = '30000000-0000-4000-8000-000000000003';

interface InMemoryInvSlot {
  id: string;
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  storageCondition: string;
  isPrescriptionRequired: boolean;
  expiryDate: string;
  quantityAvailable: number;
  quantityReserved: number;
  sellingPrice: number;
  mrp: number;
}

class InMemoryCollabStore implements ICollaborationRepository {
  public inventorySlots: InMemoryInvSlot[] = [
    {
      id: INV_SUP_PARA,
      pharmacyId: PHARM_SUP,
      medicineId: MED_PARACETAMOL,
      medicineName: 'Paracetamol 650 mg Tablet',
      genericName: 'Paracetamol',
      storageCondition: 'Ambient',
      isPrescriptionRequired: false,
      expiryDate: '2028-12-31',
      quantityAvailable: 15,
      quantityReserved: 0,
      sellingPrice: 30,
      mrp: 34,
    },
    {
      id: INV_SUP_CTRL,
      pharmacyId: PHARM_SUP,
      medicineId: MED_CONTROLLED,
      medicineName: 'Alprazolam 0.5 mg Tablet',
      genericName: 'Alprazolam',
      storageCondition: 'Controlled Substance',
      isPrescriptionRequired: true,
      expiryDate: '2028-12-31',
      quantityAvailable: 50,
      quantityReserved: 0,
      sellingPrice: 80,
      mrp: 90,
    },
    {
      id: INV_SUP_EXP,
      pharmacyId: PHARM_SUP,
      medicineId: MED_EXPIRED,
      medicineName: 'Old Batch Tablet',
      genericName: 'Old Generic',
      storageCondition: 'Ambient',
      isPrescriptionRequired: false,
      expiryDate: '2024-01-01',
      quantityAvailable: 40,
      quantityReserved: 0,
      sellingPrice: 20,
      mrp: 25,
    },
  ];

  public transfers: StockTransferRecord[] = [];
  public events: TransferEventRecord[] = [];
  public idempotency = new Map<string, unknown>();
  private eventSeq = 1;
  private lockQueue: Promise<void> = Promise.resolve();

  // Simulates PostgreSQL row-level transaction serialization
  private runSerialized<T>(fn: () => T): Promise<T> {
    const next = this.lockQueue.then(fn);
    this.lockQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private toCandidate(s: InMemoryInvSlot): EligibleStockCandidateRecord {
    return {
      inventoryItemId: s.id,
      pharmacyId: s.pharmacyId,
      pharmacyName: s.pharmacyId === PHARM_SUP ? 'Supplying Pharmacy' : 'Other Pharmacy',
      pharmacyIsActive: true,
      pharmacyIsVerified: true,
      area: 'MP Nagar',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462011',
      lat: 23.2323,
      lng: 77.4332,
      medicineId: s.medicineId,
      medicineName: s.medicineName,
      genericName: s.genericName,
      dosageForm: 'Tablet',
      strength: '650 mg',
      packSize: 'Strip of 15',
      storageCondition: s.storageCondition,
      isPrescriptionRequired: s.isPrescriptionRequired,
      expiryDate: s.expiryDate,
      quantityAvailable: s.quantityAvailable,
      sellingPrice: s.sellingPrice,
      mrp: s.mrp,
      updatedAt: new Date().toISOString(),
    };
  }

  async findEligibleStockCandidates(params: {
    excludePharmacyId: string;
    medicineId?: string;
    q?: string;
    area?: string;
  }): Promise<EligibleStockCandidateRecord[]> {
    return this.inventorySlots
      .filter((s) => s.pharmacyId !== params.excludePharmacyId && s.quantityAvailable > 0)
      .filter((s) => !params.medicineId || s.medicineId === params.medicineId)
      .filter(
        (s) =>
          !params.q ||
          s.medicineName.toLowerCase().includes(params.q.toLowerCase()) ||
          s.genericName.toLowerCase().includes(params.q.toLowerCase())
      )
      .map((s) => this.toCandidate(s));
  }

  async getSourceInventoryForTransfer(
    supplyingPharmacyId: string,
    medicineId: string,
    sourceInventoryItemId: string
  ): Promise<EligibleStockCandidateRecord | null> {
    const slot = this.inventorySlots.find(
      (s) =>
        s.id === sourceInventoryItemId &&
        s.pharmacyId === supplyingPharmacyId &&
        s.medicineId === medicineId
    );
    return slot ? this.toCandidate(slot) : null;
  }

  async createTransfer(params: {
    requestingPharmacyId: string;
    supplyingPharmacyId: string;
    medicineId: string;
    sourceInventoryItemId: string;
    requestedQuantity: number;
    requestReason?: string;
    requestedByUserId: string;
  }): Promise<StockTransferRecord> {
    const slot = this.inventorySlots.find((s) => s.id === params.sourceInventoryItemId)!;
    const now = new Date().toISOString();
    const t: StockTransferRecord = {
      id: crypto.randomUUID(),
      transferCode: `TR-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      requestingPharmacyId: params.requestingPharmacyId,
      requestingPharmacyName: 'Requesting Pharmacy',
      supplyingPharmacyId: params.supplyingPharmacyId,
      supplyingPharmacyName: 'Supplying Pharmacy',
      medicineId: params.medicineId,
      medicineName: slot.medicineName,
      sourceInventoryItemId: params.sourceInventoryItemId,
      requestedQuantity: params.requestedQuantity,
      approvedQuantity: null,
      status: 'REQUESTED',
      requestReason: params.requestReason ?? null,
      rejectionReason: null,
      requestedByUserId: params.requestedByUserId,
      approvedByUserId: null,
      dispatchedAt: null,
      dispatchedByUserId: null,
      dispatchReference: null,
      receivedAt: null,
      receivedByUserId: null,
      receivedQuantity: null,
      hasDiscrepancy: false,
      discrepancyNotes: null,
      createdAt: now,
      updatedAt: now,
    };
    this.transfers.push(t);
    this.events.push({
      id: this.eventSeq++,
      transferId: t.id,
      previousStatus: null,
      newStatus: 'REQUESTED',
      actorUserId: params.requestedByUserId,
      eventType: 'TRANSFER_REQUESTED',
      notes: params.requestReason ?? null,
      createdAt: now,
    });
    return t;
  }

  async listTransfersForPharmacy(pharmacyId: string): Promise<StockTransferRecord[]> {
    return this.transfers.filter(
      (t) => t.requestingPharmacyId === pharmacyId || t.supplyingPharmacyId === pharmacyId
    );
  }

  async getTransferById(transferId: string): Promise<StockTransferRecord | null> {
    return this.transfers.find((t) => t.id === transferId) ?? null;
  }

  async getTransferEvents(transferId: string): Promise<TransferEventRecord[]> {
    return this.events.filter((e) => e.transferId === transferId);
  }

  async approveTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    approvedQuantity?: number;
    idempotencyKey?: string;
  }) {
    return this.runSerialized(() => {
      const iKey = params.idempotencyKey ? `APPROVE:${params.transferId}:${params.idempotencyKey}` : null;
      if (iKey && this.idempotency.has(iKey)) {
        return this.idempotency.get(iKey) as {
          transferId: string;
          status: TransferStatus;
          approvedQuantity: number;
        };
      }
      const t = this.transfers.find((x) => x.id === params.transferId);
      if (!t) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Transfer not found');
      if (t.status !== 'REQUESTED') {
        throw new AppError(409, 'INVALID_STATE_TRANSITION', `Cannot approve in ${t.status}`);
      }
      const qty = params.approvedQuantity ?? t.requestedQuantity;
      if (qty <= 0 || qty > t.requestedQuantity) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid approved quantity');
      }
      const slot = this.inventorySlots.find((s) => s.id === t.sourceInventoryItemId)!;
      if (slot.quantityAvailable < qty) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock at approval');
      }
      slot.quantityAvailable -= qty;
      slot.quantityReserved += qty;
      t.status = 'APPROVED';
      t.approvedQuantity = qty;
      t.approvedByUserId = params.actorId;
      t.updatedAt = new Date().toISOString();
      this.events.push({
        id: this.eventSeq++,
        transferId: t.id,
        previousStatus: 'REQUESTED',
        newStatus: 'APPROVED',
        actorUserId: params.actorId,
        eventType: 'TRANSFER_APPROVED',
        notes: `Approved ${qty}`,
        createdAt: t.updatedAt,
      });
      const res = { transferId: t.id, status: 'APPROVED' as TransferStatus, approvedQuantity: qty };
      if (iKey) this.idempotency.set(iKey, res);
      return res;
    });
  }

  async rejectTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    reason: string;
    idempotencyKey?: string;
  }) {
    return this.runSerialized(() => {
      const t = this.transfers.find((x) => x.id === params.transferId)!;
      if (t.status !== 'REQUESTED') {
        throw new AppError(409, 'INVALID_STATE_TRANSITION', 'Invalid state');
      }
      t.status = 'REJECTED';
      t.rejectionReason = params.reason;
      t.updatedAt = new Date().toISOString();
      this.events.push({
        id: this.eventSeq++,
        transferId: t.id,
        previousStatus: 'REQUESTED',
        newStatus: 'REJECTED',
        actorUserId: params.actorId,
        eventType: 'TRANSFER_REJECTED',
        notes: params.reason,
        createdAt: t.updatedAt,
      });
      return { transferId: t.id, status: 'REJECTED' as TransferStatus };
    });
  }

  async dispatchTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    dispatchReference?: string;
    idempotencyKey?: string;
  }) {
    return this.runSerialized(() => {
      const t = this.transfers.find((x) => x.id === params.transferId)!;
      if (t.status !== 'APPROVED') {
        throw new AppError(409, 'INVALID_STATE_TRANSITION', 'Must be APPROVED to dispatch');
      }
      t.status = 'DISPATCHED';
      t.dispatchedAt = new Date().toISOString();
      t.dispatchedByUserId = params.actorId;
      t.dispatchReference = params.dispatchReference ?? null;
      this.events.push({
        id: this.eventSeq++,
        transferId: t.id,
        previousStatus: 'APPROVED',
        newStatus: 'DISPATCHED',
        actorUserId: params.actorId,
        eventType: 'TRANSFER_DISPATCHED',
        notes: params.dispatchReference ?? 'Dispatched',
        createdAt: t.dispatchedAt,
      });
      return {
        transferId: t.id,
        status: 'DISPATCHED' as TransferStatus,
        dispatchReference: t.dispatchReference,
      };
    });
  }

  async receiveTransferAtomic(params: {
    transferId: string;
    requestingPharmacyId: string;
    actorId: string;
    receivedQuantity: number;
    discrepancyNotes?: string;
    idempotencyKey?: string;
  }) {
    return this.runSerialized(() => {
      const iKey = params.idempotencyKey ? `RECEIVE:${params.transferId}:${params.idempotencyKey}` : null;
      if (iKey && this.idempotency.has(iKey)) {
        return this.idempotency.get(iKey) as {
          transferId: string;
          status: TransferStatus;
          receivedQuantity: number;
          hasDiscrepancy: boolean;
        };
      }
      const t = this.transfers.find((x) => x.id === params.transferId)!;
      if (t.status !== 'DISPATCHED') {
        throw new AppError(409, 'INVALID_STATE_TRANSITION', 'Must be DISPATCHED to receive');
      }
      const approved = t.approvedQuantity!;
      if (params.receivedQuantity < 0 || params.receivedQuantity > approved) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid received quantity');
      }
      const hasDiscrepancy = params.receivedQuantity < approved;
      if (hasDiscrepancy && (!params.discrepancyNotes || params.discrepancyNotes.trim().length < 3)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'discrepancyNotes required on shortfall');
      }
      const srcSlot = this.inventorySlots.find((s) => s.id === t.sourceInventoryItemId)!;
      srcSlot.quantityReserved -= approved;

      if (params.receivedQuantity > 0) {
        this.inventorySlots.push({
          id: crypto.randomUUID(),
          pharmacyId: t.requestingPharmacyId,
          medicineId: t.medicineId,
          medicineName: t.medicineName,
          genericName: srcSlot.genericName,
          storageCondition: srcSlot.storageCondition,
          isPrescriptionRequired: srcSlot.isPrescriptionRequired,
          expiryDate: srcSlot.expiryDate,
          quantityAvailable: params.receivedQuantity,
          quantityReserved: 0,
          sellingPrice: srcSlot.sellingPrice,
          mrp: srcSlot.mrp,
        });
      }

      t.status = 'RECEIVED';
      t.receivedAt = new Date().toISOString();
      t.receivedByUserId = params.actorId;
      t.receivedQuantity = params.receivedQuantity;
      t.hasDiscrepancy = hasDiscrepancy;
      t.discrepancyNotes = params.discrepancyNotes ?? null;
      this.events.push({
        id: this.eventSeq++,
        transferId: t.id,
        previousStatus: 'DISPATCHED',
        newStatus: 'RECEIVED',
        actorUserId: params.actorId,
        eventType: hasDiscrepancy ? 'TRANSFER_RECEIVED_WITH_DISCREPANCY' : 'TRANSFER_RECEIVED',
        notes: params.discrepancyNotes ?? `Received ${params.receivedQuantity}`,
        createdAt: t.receivedAt,
      });

      const res = {
        transferId: t.id,
        status: 'RECEIVED' as TransferStatus,
        receivedQuantity: params.receivedQuantity,
        hasDiscrepancy,
      };
      if (iKey) this.idempotency.set(iKey, res);
      return res;
    });
  }

  async cancelTransferAtomic(params: {
    transferId: string;
    actorPharmacyId: string;
    actorId: string;
    reason?: string;
    idempotencyKey?: string;
  }) {
    return this.runSerialized(() => {
      const t = this.transfers.find((x) => x.id === params.transferId)!;
      const prev = t.status;
      if (prev === 'APPROVED') {
        const slot = this.inventorySlots.find((s) => s.id === t.sourceInventoryItemId)!;
        slot.quantityAvailable += t.approvedQuantity!;
        slot.quantityReserved -= t.approvedQuantity!;
      } else if (prev !== 'REQUESTED') {
        throw new AppError(409, 'INVALID_STATE_TRANSITION', `Cannot cancel in ${prev}`);
      }
      t.status = 'CANCELLED';
      t.updatedAt = new Date().toISOString();
      this.events.push({
        id: this.eventSeq++,
        transferId: t.id,
        previousStatus: prev,
        newStatus: 'CANCELLED',
        actorUserId: params.actorId,
        eventType: 'TRANSFER_CANCELLED',
        notes: params.reason ?? 'Cancelled',
        createdAt: t.updatedAt,
      });
      return { transferId: t.id, status: 'CANCELLED' as TransferStatus };
    });
  }
}

class StubPharmacyRepo implements IPharmacyRepository {
  private profiles: Record<string, PharmacyProfileRecord> = {
    [USER_REQ]: {
      id: PHARM_REQ,
      ownerUserId: USER_REQ,
      name: 'Requesting Pharmacy',
      licenseNumber: 'MP-REQ-01',
      isLicensedVerified: true,
      verificationStatus: 'VERIFIED',
      phone: '+91-755-1111111',
      email: 'req@pharm.in',
      isActive: true,
      is24x7: false,
      tier: 'standard',
      isDemo: false,
      location: {
        address: 'Zone 1',
        area: 'MP Nagar',
        city: 'Bhopal',
        state: 'MP',
        pincode: '462011',
        lat: 23.23,
        lng: 77.43,
        isLocationVerified: true,
      },
      createdAt: '',
      updatedAt: '',
    },
    [USER_SUP]: {
      id: PHARM_SUP,
      ownerUserId: USER_SUP,
      name: 'Supplying Pharmacy',
      licenseNumber: 'MP-SUP-02',
      isLicensedVerified: true,
      verificationStatus: 'VERIFIED',
      phone: '+91-755-2222222',
      email: 'sup@pharm.in',
      isActive: true,
      is24x7: true,
      tier: 'hub',
      isDemo: false,
      location: {
        address: 'Arera',
        area: 'Arera Colony',
        city: 'Bhopal',
        state: 'MP',
        pincode: '462016',
        lat: 23.21,
        lng: 77.43,
        isLocationVerified: true,
      },
      createdAt: '',
      updatedAt: '',
    },
    [USER_OUTSIDER]: {
      id: PHARM_OUTSIDER,
      ownerUserId: USER_OUTSIDER,
      name: 'Outsider Pharmacy',
      licenseNumber: 'MP-OUT-03',
      isLicensedVerified: true,
      verificationStatus: 'VERIFIED',
      phone: '+91-755-3333333',
      email: 'out@pharm.in',
      isActive: true,
      is24x7: false,
      tier: 'standard',
      isDemo: false,
      location: {
        address: 'Kolar',
        area: 'Kolar Road',
        city: 'Bhopal',
        state: 'MP',
        pincode: '462042',
        lat: 23.18,
        lng: 77.42,
        isLocationVerified: true,
      },
      createdAt: '',
      updatedAt: '',
    },
  };

  async findPharmacyByUserId(userId: string) {
    return this.profiles[userId] ?? null;
  }
  async createPharmacyForUser(): Promise<PharmacyProfileRecord> { throw new Error('Unused'); }
  async updatePharmacyProfile(): Promise<PharmacyProfileRecord> { throw new Error('Unused'); }
  async getOperatingHours() { return []; }
  async upsertOperatingHours() { return []; }
  async listAllInventory(): Promise<PrivateInventoryItemRecord[]> { return []; }
  async getInventoryItem() { return null; }
  async addInventoryItem(): Promise<PrivateInventoryItemRecord> { throw new Error('Unused'); }
  async updateInventoryItem(): Promise<PrivateInventoryItemRecord> { throw new Error('Unused'); }
  async adjustInventoryAtomic(): Promise<{ inventoryId: string; previousQuantity: number; newQuantity: number; auditId: number }> { throw new Error('Unused'); }
  async getItemHistory() { return []; }
  async getRecentMovements() { return []; }
}

const mockVerifier: TokenVerifier = async (token: string) => {
  if (token === 'token-req') return { id: USER_REQ, email: 'req@pharm.in' };
  if (token === 'token-sup') return { id: USER_SUP, email: 'sup@pharm.in' };
  if (token === 'token-outsider') return { id: USER_OUTSIDER, email: 'out@pharm.in' };
  return null;
};

let server: Server;
let baseUrl: string;
let store: InMemoryCollabStore;

test.before(() => {
  store = new InMemoryCollabStore();
  const service = new CollaborationService(store, new StubPharmacyRepo());
  const app = createApp({ collaborationService: service, tokenVerifier: mockVerifier });
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

test('Discovery: returns only eligible non-expired non-controlled stock and hides exact counts/costs', async () => {
  const res = await fetch(`${baseUrl}/api/v1/collaboration/stock?lat=23.23&lng=77.43`, {
    headers: { Authorization: 'Bearer token-req' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  // Only Paracetamol is eligible (Controlled Substance & Expired batch excluded!)
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.items[0].medicineId, MED_PARACETAMOL);
  assert.equal(body.data.items[0].quantityAvailable, undefined);
  assert.equal(body.data.items[0].unitCostPrice, undefined);
  assert.equal(body.data.items[0].licenseNumber, undefined);
});

test('Validation & Eligibility: blocks self-transfers, invalid quantities, controlled & expired stock', async () => {
  const selfRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_REQ,
      medicineId: MED_PARACETAMOL,
      sourceInventoryItemId: INV_SUP_PARA,
      requestedQuantity: 5,
    }),
  });
  assert.equal(selfRes.status, 400);

  const badQty = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_SUP,
      medicineId: MED_PARACETAMOL,
      sourceInventoryItemId: INV_SUP_PARA,
      requestedQuantity: 0,
    }),
  });
  assert.equal(badQty.status, 400);

  const ctrlRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_SUP,
      medicineId: MED_CONTROLLED,
      sourceInventoryItemId: INV_SUP_CTRL,
      requestedQuantity: 5,
    }),
  });
  assert.equal(ctrlRes.status, 400);

  const expRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_SUP,
      medicineId: MED_EXPIRED,
      sourceInventoryItemId: INV_SUP_EXP,
      requestedQuantity: 5,
    }),
  });
  assert.equal(expRes.status, 400);
});

test('Concurrency: parallel approvals against limited stock prevent overselling', async () => {
  // Supplier has 15 Paracetamol available. Create two 10-unit requests.
  const req1 = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_SUP,
      medicineId: MED_PARACETAMOL,
      sourceInventoryItemId: INV_SUP_PARA,
      requestedQuantity: 10,
    }),
  });
  const req2 = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_SUP,
      medicineId: MED_PARACETAMOL,
      sourceInventoryItemId: INV_SUP_PARA,
      requestedQuantity: 10,
    }),
  });
  const t1 = (await req1.json()).data.id;
  const t2 = (await req2.json()).data.id;

  // Approve both concurrently -> only ONE can succeed (200); the other MUST fail with 409 INSUFFICIENT_STOCK
  const [a1, a2] = await Promise.all([
    fetch(`${baseUrl}/api/v1/collaboration/transfers/${t1}/approve`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-sup', 'Idempotency-Key': 'approve-t1' },
    }),
    fetch(`${baseUrl}/api/v1/collaboration/transfers/${t2}/approve`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-sup', 'Idempotency-Key': 'approve-t2' },
    }),
  ]);
  const statuses = [a1.status, a2.status].sort();
  assert.deepEqual(statuses, [200, 409]);

  // Idempotent retry on approved transfer returns 200 without double-reserving
  const approvedId = a1.status === 200 ? t1 : t2;
  const idempRetry = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${approvedId}/approve`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-sup', 'Idempotency-Key': a1.status === 200 ? 'approve-t1' : 'approve-t2' },
  });
  assert.equal(idempRetry.status, 200);

  // Supplying slot must have 5 available and 10 reserved (never negative!)
  const slot = store.inventorySlots.find((s) => s.id === INV_SUP_PARA)!;
  assert.equal(slot.quantityAvailable, 5);
  assert.equal(slot.quantityReserved, 10);

  // Cancel the approved transfer -> releases 10 reserved back to 15 available
  const cancelRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${approvedId}/cancel`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Restocked locally' }),
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(slot.quantityAvailable, 15);
  assert.equal(slot.quantityReserved, 0);

  // Double cancellation rejected with 409
  const doubleCancel = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${approvedId}/cancel`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req' },
  });
  assert.equal(doubleCancel.status, 409);
});

test('Full Lifecycle, Discrepancy Handling, Duplicate Receipt Prevention, & Tenant Isolation', async () => {
  // 1. Create 10-unit request
  const createRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_SUP,
      medicineId: MED_PARACETAMOL,
      sourceInventoryItemId: INV_SUP_PARA,
      requestedQuantity: 10,
      requestReason: 'Urgent patient demand',
    }),
  });
  assert.equal(createRes.status, 201);
  const transferId = (await createRes.json()).data.id;

  // 2. Outsider cannot view or approve -> 403 FORBIDDEN
  const outsiderGet = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}`, {
    headers: { Authorization: 'Bearer token-outsider' },
  });
  assert.equal(outsiderGet.status, 403);

  // 3. Cannot dispatch unapproved transfer -> 409
  const earlyDispatch = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}/dispatch`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-sup' },
  });
  assert.equal(earlyDispatch.status, 409);

  // 4. Approve 8 units (partial approval)
  const appRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}/approve`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-sup', 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvedQuantity: 8 }),
  });
  assert.equal(appRes.status, 200);

  // 5. Dispatch
  const dispRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}/dispatch`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-sup', 'Content-Type': 'application/json' },
    body: JSON.stringify({ dispatchReference: 'COURIER-991' }),
  });
  assert.equal(dispRes.status, 200);

  // 6. Ordinary cancellation of DISPATCHED transfer MUST fail (409)
  const badCancel = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}/cancel`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req' },
  });
  assert.equal(badCancel.status, 409);

  // 7. Receive with discrepancy (7 instead of 8) without notes -> 400; with notes -> 200
  const noNotes = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}/receive`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({ receivedQuantity: 7 }),
  });
  assert.equal(noNotes.status, 400);

  const recRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}/receive`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-req',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'rec-1',
    },
    body: JSON.stringify({
      receivedQuantity: 7,
      discrepancyNotes: '1 strip damaged in transit',
    }),
  });
  assert.equal(recRes.status, 200);
  const recBody = await recRes.json();
  assert.equal(recBody.data.hasDiscrepancy, true);
  assert.equal(recBody.data.receivedQuantity, 7);

  // 8. Duplicate receipt without idempotency key -> 409 INVALID_STATE_TRANSITION
  const dupRec = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}/receive`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({ receivedQuantity: 7, discrepancyNotes: 'Retry' }),
  });
  assert.equal(dupRec.status, 409);

  // 9. Verify audit history has 4 chronological events (REQUESTED -> APPROVED -> DISPATCHED -> RECEIVED)
  const detailRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${transferId}`, {
    headers: { Authorization: 'Bearer token-req' },
  });
  const detailBody = await detailRes.json();
  assert.equal(detailBody.data.history.length, 4);
  assert.deepEqual(
    detailBody.data.history.map((h: { newStatus: string }) => h.newStatus),
    ['REQUESTED', 'APPROVED', 'DISPATCHED', 'RECEIVED']
  );
});

test('Reject flow: rejects request and prevents REJECTED -> APPROVED', async () => {
  const createRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-req', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplyingPharmacyId: PHARM_SUP,
      medicineId: MED_PARACETAMOL,
      sourceInventoryItemId: INV_SUP_PARA,
      requestedQuantity: 2,
    }),
  });
  const id = (await createRes.json()).data.id;

  const rejRes = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${id}/reject`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-sup', 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Reserved for local clinic' }),
  });
  assert.equal(rejRes.status, 200);

  const reApprove = await fetch(`${baseUrl}/api/v1/collaboration/transfers/${id}/approve`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-sup' },
  });
  assert.equal(reApprove.status, 409);
});
