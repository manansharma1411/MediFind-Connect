import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { createApp } from '../src/app.js';
import { TokenVerifier } from '../src/middleware/auth.js';
import {
  EligibleStockCandidateRecord,
  ICollaborationRepository,
} from '../src/repositories/collaborationRepository.js';
import {
  DemandAggregateRecord,
  IIntelligenceRepository,
} from '../src/repositories/intelligenceRepository.js';
import {
  InventoryMovementRecord,
  IPharmacyRepository,
  PharmacyProfileRecord,
  PrivateInventoryItemRecord,
} from '../src/repositories/pharmacyRepository.js';
import { AiIntelligenceService } from '../src/services/aiIntelligenceService.js';
import { applySafeExplanationEnhancer } from '../src/services/ai/explanationService.js';
import { EligibleInventorySlot } from '../src/services/demandPrivacyEngine.js';
import { getIndianTimeParts } from '../src/services/medicineService.js';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const USER_UNVERIFIED = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
const USER_NO_PHARM = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';

const PHARM_A = '11111111-1111-4111-8111-1111111111a1';
const PHARM_B = '22222222-2222-4222-8222-2222222222b2';
const PHARM_UNVERIFIED = '33333333-3333-4333-8333-3333333333c3';

const MED_DOLO = '44444444-4444-4444-8444-444444444401';
const MED_AZITHRO = '44444444-4444-4444-8444-444444444402';
const MED_CONTROLLED = '44444444-4444-4444-8444-444444444403';
const MED_LOW_DEMAND = '44444444-4444-4444-8444-444444444404';

function shiftDays(dateStr: string, deltaDays: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + deltaDays * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

class InMemoryAiFixtures {
  medicines = new Map<string, string>([
    [MED_DOLO, 'Paracetamol 650 mg Tablet'],
    [MED_AZITHRO, 'Azithromycin 500 mg Tablet'],
    [MED_CONTROLLED, 'Alprazolam 0.5 mg Tablet'],
    [MED_LOW_DEMAND, 'Vitamin C 500 mg Tablet'],
  ]);
  aggregates: DemandAggregateRecord[] = [];
  slots: EligibleInventorySlot[] = [];
  pharmacyInventories = new Map<string, PrivateInventoryItemRecord[]>();
  pharmacyMovements = new Map<string, InventoryMovementRecord[]>();
  collabCandidates: EligibleStockCandidateRecord[] = [];

  reset() {
    this.aggregates = [];
    this.slots = [];
    this.pharmacyInventories.clear();
    this.pharmacyMovements.clear();
    this.collabCandidates = [];
  }
}

const fixtures = new InMemoryAiFixtures();

const mockIntelRepo = {
  medicineExists: async (id: string) => fixtures.medicines.has(id),
  listAggregates: async (params: {
    fromDate: string;
    toDate: string;
    area?: string;
    medicineId?: string;
  }) =>
    fixtures.aggregates.filter((a) => {
      if (a.bucketDate < params.fromDate || a.bucketDate > params.toDate) return false;
      if (params.area && a.area.toLowerCase() !== params.area.toLowerCase()) return false;
      if (params.medicineId && a.medicineId !== params.medicineId) return false;
      return true;
    }),
  listEligibleInventorySlots: async (params: { area?: string; medicineId?: string }) =>
    fixtures.slots.filter((s) => {
      if (params.area && s.area.toLowerCase() !== params.area.toLowerCase()) return false;
      if (params.medicineId && s.medicineId !== params.medicineId) return false;
      return true;
    }),
} as unknown as IIntelligenceRepository;

const mockPharmProfiles: Record<string, PharmacyProfileRecord> = {
  [USER_A]: {
    id: PHARM_A,
    ownerUserId: USER_A,
    name: 'Arogya Care Pharmacy',
    licenseNumber: 'MP-BPL-101',
    isLicensedVerified: true,
    verificationStatus: 'VERIFIED',
    phone: '+91-9876543210',
    email: 'arogya@example.com',
    isActive: true,
    is24x7: false,
    tier: 'standard',
    isDemo: false,
    location: {
      address: 'E-4/12 Arera Colony',
      area: 'Arera Colony',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462016',
      lat: 23.2156,
      lng: 77.4305,
    },
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  [USER_B]: {
    id: PHARM_B,
    ownerUserId: USER_B,
    name: 'CityMed MP Nagar',
    licenseNumber: 'MP-BPL-202',
    isLicensedVerified: true,
    verificationStatus: 'VERIFIED',
    phone: '+91-9876543211',
    email: 'citymed@example.com',
    isActive: true,
    is24x7: true,
    tier: 'hub',
    isDemo: false,
    location: {
      address: 'Plot 8 MP Nagar',
      area: 'MP Nagar',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462011',
      lat: 23.2313,
      lng: 77.4326,
    },
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  [USER_UNVERIFIED]: {
    id: PHARM_UNVERIFIED,
    ownerUserId: USER_UNVERIFIED,
    name: 'Pending Store',
    licenseNumber: 'MP-BPL-303',
    isLicensedVerified: false,
    verificationStatus: 'PENDING',
    phone: '+91-9876543212',
    email: 'pending@example.com',
    isActive: true,
    is24x7: false,
    tier: 'standard',
    isDemo: false,
    location: {
      address: '10 Arera Colony',
      area: 'Arera Colony',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462016',
      lat: 23.2156,
      lng: 77.4305,
    },
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
};

const mockPharmRepo = {
  findPharmacyByUserId: async (userId: string) => mockPharmProfiles[userId] ?? null,
  listAllInventory: async (pharmacyId: string) =>
    fixtures.pharmacyInventories.get(pharmacyId) ?? [],
  getRecentMovements: async (pharmacyId: string) =>
    fixtures.pharmacyMovements.get(pharmacyId) ?? [],
} as unknown as IPharmacyRepository;

const mockCollabRepo = {
  findEligibleStockCandidates: async (params: {
    excludePharmacyId: string;
    medicineId?: string;
  }) =>
    fixtures.collabCandidates.filter(
      (c) =>
        c.pharmacyId !== params.excludePharmacyId &&
        (!params.medicineId || c.medicineId === params.medicineId)
    ),
} as unknown as ICollaborationRepository;

const mockTokenVerifier: TokenVerifier = async (token: string) => {
  if (token === 'token-a') return { id: USER_A, email: 'a@example.com' };
  if (token === 'token-b') return { id: USER_B, email: 'b@example.com' };
  if (token === 'token-unverified') return { id: USER_UNVERIFIED, email: 'u@example.com' };
  if (token === 'token-nopharm') return { id: USER_NO_PHARM, email: 'n@example.com' };
  return null;
};

const aiService = new AiIntelligenceService(mockIntelRepo, mockPharmRepo, mockCollabRepo, {
  minThreshold: 5,
});

let server: http.Server;
let baseUrl: string;

before(async () => {
  const app = createApp({
    aiIntelligenceService: aiService,
    tokenVerifier: mockTokenVerifier,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  fixtures.reset();
});

test('Shortage Radar: multi-factor scoring, zero supply, expired/reserved exclusion & insufficient data', async () => {
  const today = getIndianTimeParts().dateStr;
  fixtures.aggregates.push(
    // High demand + high unmet + 0 eligible supply -> HIGH risk
    {
      bucketDate: today,
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'NO_ELIGIBLE_NEARBY_STOCK',
      searchSource: 'AVAILABILITY_CHECK',
      signalCount: 25,
    },
    // High demand + ample eligible supply -> LOW risk (never HIGH from search volume alone!)
    {
      bucketDate: today,
      medicineId: MED_AZITHRO,
      medicineName: 'Azithromycin 500 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'MATCH_FOUND',
      searchSource: 'MEDICINE_SEARCH',
      signalCount: 20,
    },
    // Low demand + low supply -> INSUFFICIENT_DATA
    {
      bucketDate: today,
      medicineId: MED_LOW_DEMAND,
      medicineName: 'Vitamin C 500 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'NO_ELIGIBLE_NEARBY_STOCK',
      searchSource: 'AVAILABILITY_CHECK',
      signalCount: 2,
    }
  );

  fixtures.slots.push(
    // MED_DOLO only has expired + reserved stock -> eligibleSupplyAvailable MUST be 0!
    {
      pharmacyId: PHARM_A,
      medicineId: MED_DOLO,
      area: 'Arera Colony',
      city: 'Bhopal',
      quantityAvailable: 50,
      quantityReserved: 10,
      expiryDate: shiftDays(today, -2),
      isPharmacyActive: true,
      isPharmacyVerified: true,
    },
    // MED_AZITHRO has 100 eligible units across 2 pharmacies
    {
      pharmacyId: PHARM_A,
      medicineId: MED_AZITHRO,
      area: 'Arera Colony',
      city: 'Bhopal',
      quantityAvailable: 60,
      quantityReserved: 5,
      expiryDate: shiftDays(today, 180),
      isPharmacyActive: true,
      isPharmacyVerified: true,
    },
    {
      pharmacyId: PHARM_UNVERIFIED,
      medicineId: MED_AZITHRO,
      area: 'Arera Colony',
      city: 'Bhopal',
      quantityAvailable: 40,
      quantityReserved: 0,
      expiryDate: shiftDays(today, 180),
      isPharmacyActive: true,
      isPharmacyVerified: false,
    }
  );

  const res = await fetch(`${baseUrl}/api/v1/intelligence/shortages`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  const byId = new Map<string, any>(body.data.items.map((x: any) => [x.medicineId, x]));

  assert.equal(byId.get(MED_DOLO).riskCategory, 'HIGH');
  assert.equal(byId.get(MED_DOLO).supportingIndicators.eligibleSupplyAvailable, 0);
  assert.equal(byId.get(MED_DOLO).supportingIndicators.reservedStockExcluded, 10);
  assert.equal(byId.get(MED_DOLO).supportingIndicators.expiredBatchesExcluded, 1);

  assert.equal(byId.get(MED_AZITHRO).riskCategory, 'LOW');
  assert.equal(byId.get(MED_AZITHRO).supportingIndicators.demandAvailabilityStatus, 'SUFFICIENT');
  assert.equal(byId.get(MED_AZITHRO).supportingIndicators.supplyAvailabilityStatus, 'AVAILABLE');

  const lowItem = byId.get(MED_LOW_DEMAND);
  assert.equal(lowItem.riskCategory, 'INSUFFICIENT_DATA');
  assert.equal(lowItem.riskScore, null);
  assert.equal(lowItem.supportingIndicators.demandAvailabilityStatus, 'SUPPRESSED_BELOW_THRESHOLD');
  assert.equal(lowItem.supportingIndicators.supplyAvailabilityStatus, 'SUPPRESSED');
  assert.equal(lowItem.supportingIndicators.recentDemandSignals, null);
  assert.equal(lowItem.supportingIndicators.priorDemandSignals, null);
  assert.equal(lowItem.supportingIndicators.unmetDemandSignals, null);
  assert.equal(lowItem.supportingIndicators.unmetDemandRatio, null);
  assert.equal(lowItem.supportingIndicators.eligibleSupplyAvailable, null);
  assert.equal(lowItem.supportingIndicators.reservedStockExcluded, null);
  assert.equal(lowItem.supportingIndicators.participatingPharmaciesCount, null);
  assert.equal(lowItem.explanation.influencingMetrics.recentDemandSignals, undefined);
  assert.equal(lowItem.explanation.whyIdentified.includes(' 2 '), false);

  // Zero demand medicine (no aggregates, only inventory slot or detail lookup) -> ZERO_DEMAND
  const zeroRes = await fetch(`${baseUrl}/api/v1/intelligence/shortages/${MED_CONTROLLED}`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(zeroRes.status, 200);
  const zeroJson = await zeroRes.json();
  assert.equal(zeroJson.data.riskCategory, 'INSUFFICIENT_DATA');
  assert.equal(zeroJson.data.supportingIndicators.demandAvailabilityStatus, 'ZERO_DEMAND');
  assert.equal(zeroJson.data.supportingIndicators.recentDemandSignals, null);
});

test('Smart Restock: missing sales & lead-time transparency, expired/reserved exclusion & tenant isolation', async () => {
  const today = getIndianTimeParts().dateStr;
  fixtures.aggregates.push({
    bucketDate: today,
    medicineId: MED_DOLO,
    medicineName: 'Paracetamol 650 mg Tablet',
    area: 'Arera Colony',
    city: 'Bhopal',
    pincodePrefix: '462xxx',
    searchOutcome: 'PARTIAL_AVAILABILITY',
    searchSource: 'AVAILABILITY_CHECK',
    signalCount: 30,
  });

  fixtures.pharmacyInventories.set(PHARM_A, [
    {
      id: 'inv-1',
      pharmacyId: PHARM_A,
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      genericName: 'Paracetamol',
      dosageForm: 'Tablet',
      strength: '650 mg',
      packSize: '15s',
      brands: [],
      batchNumber: 'B1',
      expiryDate: shiftDays(today, 90),
      quantityAvailable: 4,
      quantityReserved: 6,
      mrp: 30,
      sellingPrice: 28,
      unitCostPrice: 20,
      reorderThreshold: 15,
      status: 'LOW_STOCK',
      isExpired: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'inv-2',
      pharmacyId: PHARM_A,
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      genericName: 'Paracetamol',
      dosageForm: 'Tablet',
      strength: '650 mg',
      packSize: '15s',
      brands: [],
      batchNumber: 'B2-EXP',
      expiryDate: shiftDays(today, -1),
      quantityAvailable: 50,
      quantityReserved: 0,
      mrp: 30,
      sellingPrice: 28,
      unitCostPrice: 20,
      reorderThreshold: 15,
      status: 'IN_STOCK',
      isExpired: true,
      updatedAt: new Date().toISOString(),
    },
  ]);

  const res = await fetch(`${baseUrl}/api/v1/pharmacies/me/intelligence/restock`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.items.length, 1);
  const rec = body.data.items[0];
  assert.equal(rec.currentEligibleStock, 4);
  assert.equal(rec.reservedStockExcluded, 6);
  assert.equal(rec.expiredStockExcluded, 50);
  assert.equal(rec.basis, 'DEMAND_SIGNAL_BASED');
  assert.equal(rec.supportingMetrics.observedSalesUnits30d, null);
  assert.equal(rec.supportingMetrics.leadTimeDaysUsed, null);
  assert.equal(rec.reviewRequired, true);
  assert.ok(rec.suggestedRestockQuantity > 0);
});

test('Forecasting: walk-forward evaluation, baseline comparison, stale detection & insufficient history', async () => {
  const today = getIndianTimeParts().dateStr;

  // Insufficient history (only 3 buckets) -> INSUFFICIENT_DATA
  for (let i = 0; i < 3; i++) {
    fixtures.aggregates.push({
      bucketDate: shiftDays(today, -i),
      medicineId: MED_AZITHRO,
      medicineName: 'Azithromycin 500 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'MATCH_FOUND',
      searchSource: 'MEDICINE_SEARCH',
      signalCount: 4,
    });
  }
  const insuffRes = await fetch(
    `${baseUrl}/api/v1/intelligence/forecast?medicineId=${MED_AZITHRO}&horizon=7`,
    { headers: { Authorization: 'Bearer token-a' } }
  );
  assert.equal(insuffRes.status, 200);
  const insuffJson = await insuffRes.json();
  assert.equal(insuffJson.data.status, 'INSUFFICIENT_DATA');
  assert.equal(insuffJson.data.predictions.length, 0);

  // Sufficient history (12 ordered days) -> READY with MAE/RMSE/baseline comparison
  for (let d = 11; d >= 0; d--) {
    fixtures.aggregates.push({
      bucketDate: shiftDays(today, -d),
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'MATCH_FOUND',
      searchSource: 'MEDICINE_SEARCH',
      signalCount: 10 + (11 - d),
    });
  }
  const okRes = await fetch(
    `${baseUrl}/api/v1/intelligence/forecast?medicineId=${MED_DOLO}&horizon=5&granularity=day`,
    { headers: { Authorization: 'Bearer token-a' } }
  );
  assert.equal(okRes.status, 200);
  const okJson = await okRes.json();
  assert.equal(okJson.data.status, 'READY');
  assert.equal(okJson.data.predictions.length, 5);
  assert.equal(okJson.data.evaluation.status, 'EVALUATED');
  assert.equal(typeof okJson.data.evaluation.mae, 'number');
  assert.equal(typeof okJson.data.evaluation.baselineMae, 'number');

  // Stale data (> 14 days old) flags isStale = true
  fixtures.aggregates = fixtures.aggregates.filter((a) => a.medicineId !== MED_DOLO);
  for (let d = 30; d >= 20; d--) {
    fixtures.aggregates.push({
      bucketDate: shiftDays(today, -d),
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'MATCH_FOUND',
      searchSource: 'MEDICINE_SEARCH',
      signalCount: 8,
    });
  }
  const staleRes = await fetch(
    `${baseUrl}/api/v1/intelligence/forecast?medicineId=${MED_DOLO}&horizon=3`,
    { headers: { Authorization: 'Bearer token-a' } }
  );
  const staleJson = await staleRes.json();
  assert.equal(staleJson.data.explanation.dataFreshness.isStale, true);
});

test('Matching, Authorization, Cross-Pharmacy Isolation, & LLM Deterministic Fallback', async () => {
  const today = getIndianTimeParts().dateStr;
  fixtures.aggregates.push(
    {
      bucketDate: today,
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'NO_ELIGIBLE_NEARBY_STOCK',
      searchSource: 'AVAILABILITY_CHECK',
      signalCount: 12,
    },
    {
      bucketDate: today,
      medicineId: MED_CONTROLLED,
      medicineName: 'Alprazolam 0.5 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'NO_ELIGIBLE_NEARBY_STOCK',
      searchSource: 'AVAILABILITY_CHECK',
      signalCount: 12,
    }
  );

  fixtures.collabCandidates.push(
    // Valid match (~2 km away)
    {
      inventoryItemId: 'cand-1',
      pharmacyId: PHARM_B,
      pharmacyName: 'CityMed MP Nagar',
      pharmacyIsActive: true,
      pharmacyIsVerified: true,
      area: 'MP Nagar',
      city: 'Bhopal',
      state: 'MP',
      pincode: '462011',
      lat: 23.2313,
      lng: 77.4326,
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      genericName: 'Paracetamol',
      dosageForm: 'Tablet',
      strength: '650 mg',
      packSize: '15s',
      storageCondition: 'Ambient',
      isPrescriptionRequired: false,
      expiryDate: shiftDays(today, 90),
      quantityAvailable: 30,
      sellingPrice: 27,
      mrp: 30,
      updatedAt: new Date().toISOString(),
    },
    // Ineligible controlled substance -> MUST be excluded!
    {
      inventoryItemId: 'cand-2',
      pharmacyId: PHARM_B,
      pharmacyName: 'CityMed MP Nagar',
      pharmacyIsActive: true,
      pharmacyIsVerified: true,
      area: 'MP Nagar',
      city: 'Bhopal',
      state: 'MP',
      pincode: '462011',
      lat: 23.2313,
      lng: 77.4326,
      medicineId: MED_CONTROLLED,
      medicineName: 'Alprazolam 0.5 mg Tablet',
      genericName: 'Alprazolam',
      dosageForm: 'Tablet',
      strength: '0.5 mg',
      packSize: '10s',
      storageCondition: 'Controlled Substance',
      isPrescriptionRequired: true,
      expiryDate: shiftDays(today, 90),
      quantityAvailable: 30,
      sellingPrice: 40,
      mrp: 45,
      updatedAt: new Date().toISOString(),
    }
  );

  // Valid verified match request
  const matchRes = await fetch(`${baseUrl}/api/v1/intelligence/matches?maxDistanceKm=10`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(matchRes.status, 200);
  const matchJson = await matchRes.json();
  assert.equal(matchJson.data.items.length, 1);
  assert.equal(matchJson.data.items[0].medicineId, MED_DOLO);
  assert.equal(matchJson.data.items[0].autoCreated, false);

  // Unverified pharmacy blocked from matches -> 403
  const unverifiedRes = await fetch(`${baseUrl}/api/v1/intelligence/matches`, {
    headers: { Authorization: 'Bearer token-unverified' },
  });
  assert.equal(unverifiedRes.status, 403);

  // Cross-area isolation -> 403
  const crossArea = await fetch(`${baseUrl}/api/v1/intelligence/shortages?area=Arera%20Colony`, {
    headers: { Authorization: 'Bearer token-b' },
  });
  assert.equal(crossArea.status, 403);

  // Unauthenticated -> 401
  const unauth = await fetch(`${baseUrl}/api/v1/intelligence/shortages`);
  assert.equal(unauth.status, 401);

  // Deterministic fallback when optional LLM fails or fabricates numbers
  const baseExp = matchJson.data.items[0].explanation;
  const failedEnhancer = await applySafeExplanationEnhancer(baseExp, {
    enhanceSummary: async () => {
      throw new Error('LLM timeout');
    },
  });
  assert.equal(failedEnhancer.explanationSource, 'DETERMINISTIC');

  const fabricatedNumEnhancer = await applySafeExplanationEnhancer(baseExp, {
    enhanceSummary: async () => 'Shortage is 99999% certain right now!',
  });
  assert.equal(fabricatedNumEnhancer.explanationSource, 'DETERMINISTIC');
});
