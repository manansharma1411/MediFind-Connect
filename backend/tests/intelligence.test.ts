import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { createApp } from '../src/app.js';
import { TokenVerifier } from '../src/middleware/auth.js';
import {
  DemandAggregateRecord,
  IIntelligenceRepository,
} from '../src/repositories/intelligenceRepository.js';
import {
  IPharmacyRepository,
  PharmacyProfileRecord,
} from '../src/repositories/pharmacyRepository.js';
import {
  EligibleInventorySlot,
  SearchOutcome,
  SearchSource,
} from '../src/services/demandPrivacyEngine.js';
import { IntelligenceService } from '../src/services/intelligenceService.js';
import { getIndianTimeParts } from '../src/services/medicineService.js';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const USER_NO_PHARM = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

const PHARM_A = '11111111-1111-4111-8111-1111111111a1';
const PHARM_B = '22222222-2222-4222-8222-2222222222b2';

const MED_DOLO = '33333333-3333-4333-8333-333333333301';
const MED_AZITHRO = '33333333-3333-4333-8333-333333333302';
const MED_UNKNOWN = '99999999-9999-4999-8999-999999999999';

function shiftDays(dateStr: string, deltaDays: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + deltaDays * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

class InMemoryIntelligenceStore implements IIntelligenceRepository {
  medicines = new Map<string, string>([
    [MED_DOLO, 'Paracetamol 650 mg Tablet'],
    [MED_AZITHRO, 'Azithromycin 500 mg Tablet'],
  ]);
  aggregates: DemandAggregateRecord[] = [];
  dedup = new Map<string, number>(); // hash -> expiresAtMs
  inventorySlots: EligibleInventorySlot[] = [];
  lastCleanupAt: string | null = null;

  reset() {
    this.aggregates = [];
    this.dedup.clear();
    this.lastCleanupAt = null;
    const today = getIndianTimeParts().dateStr;
    this.inventorySlots = [
      // Eligible active stock in Arera Colony (40 available, 15 reserved -> only 40 counted)
      {
        pharmacyId: PHARM_A,
        medicineId: MED_DOLO,
        area: 'Arera Colony',
        city: 'Bhopal',
        quantityAvailable: 40,
        quantityReserved: 15,
        expiryDate: shiftDays(today, 180),
        isPharmacyActive: true,
        isPharmacyVerified: true,
      },
      // Expired stock in Arera Colony -> MUST be excluded
      {
        pharmacyId: PHARM_A,
        medicineId: MED_DOLO,
        area: 'Arera Colony',
        city: 'Bhopal',
        quantityAvailable: 100,
        quantityReserved: 0,
        expiryDate: shiftDays(today, -5),
        isPharmacyActive: true,
        isPharmacyVerified: true,
      },
      // Inactive pharmacy in Arera Colony -> MUST be excluded
      {
        pharmacyId: PHARM_B,
        medicineId: MED_DOLO,
        area: 'Arera Colony',
        city: 'Bhopal',
        quantityAvailable: 90,
        quantityReserved: 0,
        expiryDate: shiftDays(today, 180),
        isPharmacyActive: false,
        isPharmacyVerified: true,
      },
      // Active stock in MP Nagar (Pharmacy B's area)
      {
        pharmacyId: PHARM_B,
        medicineId: MED_AZITHRO,
        area: 'MP Nagar',
        city: 'Bhopal',
        quantityAvailable: 12,
        quantityReserved: 8,
        expiryDate: shiftDays(today, 120),
        isPharmacyActive: true,
        isPharmacyVerified: true,
      },
    ];
  }

  async medicineExists(medicineId: string): Promise<boolean> {
    return this.medicines.has(medicineId);
  }

  async recordDemandSignal(params: {
    bucketDate: string;
    medicineId: string | null;
    area: string;
    city: string;
    pincodePrefix: string;
    searchOutcome: SearchOutcome;
    searchSource: SearchSource;
    dedupHash: string;
    dedupTtlSeconds: number;
  }): Promise<{ recorded: boolean; deduplicated: boolean }> {
    const nowMs = Date.now();
    const existingExpiry = this.dedup.get(params.dedupHash);
    if (existingExpiry && existingExpiry > nowMs) {
      return { recorded: false, deduplicated: true };
    }
    this.dedup.set(params.dedupHash, nowMs + params.dedupTtlSeconds * 1000);

    const existing = this.aggregates.find(
      (a) =>
        a.bucketDate === params.bucketDate &&
        a.medicineId === params.medicineId &&
        a.area.toLowerCase() === params.area.toLowerCase() &&
        a.city.toLowerCase() === params.city.toLowerCase() &&
        a.pincodePrefix === params.pincodePrefix &&
        a.searchOutcome === params.searchOutcome &&
        a.searchSource === params.searchSource
    );

    if (existing) {
      existing.signalCount += 1;
    } else {
      this.aggregates.push({
        bucketDate: params.bucketDate,
        medicineId: params.medicineId,
        medicineName: params.medicineId ? (this.medicines.get(params.medicineId) ?? null) : null,
        area: params.area,
        city: params.city,
        pincodePrefix: params.pincodePrefix,
        searchOutcome: params.searchOutcome,
        searchSource: params.searchSource,
        signalCount: 1,
      });
    }

    return { recorded: true, deduplicated: false };
  }

  async listAggregates(params: {
    fromDate: string;
    toDate: string;
    area?: string;
    city?: string;
    medicineId?: string;
    outcomes?: SearchOutcome[];
  }): Promise<DemandAggregateRecord[]> {
    return this.aggregates.filter((a) => {
      if (a.bucketDate < params.fromDate || a.bucketDate > params.toDate) return false;
      if (params.area && a.area.toLowerCase() !== params.area.toLowerCase()) return false;
      if (params.city && a.city.toLowerCase() !== params.city.toLowerCase()) return false;
      if (params.medicineId && a.medicineId !== params.medicineId) return false;
      if (params.outcomes && !params.outcomes.includes(a.searchOutcome)) return false;
      return true;
    });
  }

  async listEligibleInventorySlots(params: {
    area?: string;
    city?: string;
    medicineId?: string;
  }): Promise<EligibleInventorySlot[]> {
    return this.inventorySlots.filter((s) => {
      if (s.quantityAvailable <= 0) return false;
      if (params.area && s.area.toLowerCase() !== params.area.toLowerCase()) return false;
      if (params.city && s.city.toLowerCase() !== params.city.toLowerCase()) return false;
      if (params.medicineId && s.medicineId !== params.medicineId) return false;
      return true;
    });
  }

  async getLatestAggregationRun() {
    if (!this.lastCleanupAt) return null;
    return {
      runType: 'RETENTION_CLEANUP' as const,
      status: 'COMPLETED' as const,
      recordsProcessed: 1,
      recordsPurged: 1,
      completedAt: this.lastCleanupAt,
    };
  }

  async cleanupExpiredData(retentionDays: number) {
    const today = getIndianTimeParts().dateStr;
    const cutoffDate = shiftDays(today, -retentionDays);
    const nowMs = Date.now();
    let dedupPurged = 0;
    for (const [k, exp] of this.dedup.entries()) {
      if (exp <= nowMs) {
        this.dedup.delete(k);
        dedupPurged += 1;
      }
    }
    const beforeLen = this.aggregates.length;
    this.aggregates = this.aggregates.filter((a) => a.bucketDate >= cutoffDate);
    const aggregatesPurged = beforeLen - this.aggregates.length;
    this.lastCleanupAt = new Date().toISOString();
    return { dedupPurged, aggregatesPurged, cutoffDate };
  }
}

const mockPharmacies: Record<string, PharmacyProfileRecord> = {
  [USER_A]: {
    id: PHARM_A,
    ownerUserId: USER_A,
    name: 'Arogya Care Pharmacy',
    licenseNumber: 'MP-BPL-101',
    isLicensedVerified: true,
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
    createdAt: '2026-11-20T00:00:00Z',
    updatedAt: '2026-11-20T00:00:00Z',
  },
  [USER_B]: {
    id: PHARM_B,
    ownerUserId: USER_B,
    name: 'CityMed MP Nagar',
    licenseNumber: 'MP-BPL-202',
    isLicensedVerified: true,
    phone: '+91-9876543211',
    email: 'citymed@example.com',
    isActive: true,
    is24x7: true,
    tier: 'hub',
    isDemo: false,
    location: {
      address: 'Plot 8 MP Nagar Zone-1',
      area: 'MP Nagar',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462011',
      lat: 23.2313,
      lng: 77.4326,
    },
    createdAt: '2026-11-20T00:00:00Z',
    updatedAt: '2026-11-20T00:00:00Z',
  },
};

const mockPharmRepo = {
  findPharmacyByUserId: async (userId: string) => mockPharmacies[userId] ?? null,
} as unknown as IPharmacyRepository;

const mockTokenVerifier: TokenVerifier = async (token: string) => {
  if (token === 'token-a') return { id: USER_A, email: 'a@example.com' };
  if (token === 'token-b') return { id: USER_B, email: 'b@example.com' };
  if (token === 'token-nopharm') return { id: USER_NO_PHARM, email: 'no@example.com' };
  return null;
};

let server: http.Server;
let baseUrl: string;
const store = new InMemoryIntelligenceStore();
const service = new IntelligenceService(store, mockPharmRepo, {
  minThreshold: 5,
  dedupTtlSeconds: 900,
  retentionDays: 90,
  signalSalt: 'test-salt-1234',
});

before(async () => {
  const app = createApp({
    intelligenceService: service,
    tokenVerifier: mockTokenVerifier,
    signalRateLimitMax: 7,
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
  store.reset();
});

test('Signal collection, canonical medicine validation, geo normalization & deduplication', async () => {
  // 1. Rejects client-supplied arbitrary count (.strict() schema)
  const countInject = await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicineId: MED_DOLO,
      searchOutcome: 'MATCH_FOUND',
      area: 'Arera Colony',
      count: 999,
    }),
  });
  assert.equal(countInject.status, 400);

  // 2. Rejects invalid search outcome
  const badOutcome = await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicineId: MED_DOLO,
      searchOutcome: 'CONFIRMED_PURCHASE',
    }),
  });
  assert.equal(badOutcome.status, 400);

  // 3. Rejects non-existent canonical medicineId
  const badMed = await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicineId: MED_UNKNOWN,
      searchOutcome: 'MATCH_FOUND',
    }),
  });
  assert.equal(badMed.status, 400);

  // 4. Rejects invalid Indian PIN code
  const badPin = await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicineId: MED_DOLO,
      searchOutcome: 'MATCH_FOUND',
      pincode: '01234',
    }),
  });
  assert.equal(badPin.status, 400);

  // 5. Valid signal with Indian PIN records once, duplicate within TTL is deduplicated
  const ok1 = await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicineId: MED_DOLO,
      searchOutcome: 'MATCH_FOUND',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincode: '462016',
    }),
  });
  assert.equal(ok1.status, 202);
  const ok1Json = await ok1.json();
  assert.equal(ok1Json.data.recorded, true);
  assert.equal(store.aggregates[0].pincodePrefix, '462xxx');

  const dup = await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicineId: MED_DOLO,
      searchOutcome: 'MATCH_FOUND',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincode: '462016',
    }),
  });
  assert.equal(dup.status, 202);
  const dupJson = await dup.json();
  assert.equal(dupJson.data.deduplicated, true);
  assert.equal(store.aggregates[0].signalCount, 1);

  // 6. Rate limiting triggers 429 on burst (>7 requests/min in test config)
  for (let i = 0; i < 1; i++) {
    await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicineId: null,
        searchOutcome: 'NO_MATCH',
      }),
    });
  }
  const limited = await fetch(`${baseUrl}/api/v1/intelligence/demand/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicineId: null,
      searchOutcome: 'NO_MATCH',
    }),
  });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});

test('K-anonymity suppression, differencing protection, supply exclusion & insufficient data', async () => {
  const today = getIndianTimeParts().dateStr;
  // Seed MED_DOLO above threshold (8 signals) and MED_AZITHRO below threshold (3 signals -> MUST be suppressed)
  store.aggregates.push(
    {
      bucketDate: today,
      medicineId: MED_DOLO,
      medicineName: 'Paracetamol 650 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'NO_ELIGIBLE_NEARBY_STOCK',
      searchSource: 'AVAILABILITY_CHECK',
      signalCount: 8,
    },
    {
      bucketDate: today,
      medicineId: MED_AZITHRO,
      medicineName: 'Azithromycin 500 mg Tablet',
      area: 'Arera Colony',
      city: 'Bhopal',
      pincodePrefix: '462xxx',
      searchOutcome: 'PARTIAL_AVAILABILITY',
      searchSource: 'AVAILABILITY_CHECK',
      signalCount: 3, // Below threshold 5!
    }
  );

  const res = await fetch(`${baseUrl}/api/v1/intelligence/demand/overview`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();

  // MED_AZITHRO suppressed; searchVolume === 8 (NOT 11, preventing differencing!)
  assert.equal(body.data.popularMedicines.length, 1);
  assert.equal(body.data.popularMedicines[0].medicineId, MED_DOLO);
  assert.equal(body.data.searchVolume, 8);
  assert.equal(body.data.privacy.suppressedGroups, 1);

  // Supply excludes expired (100), inactive (90), and reserved (15) -> only 40 eligible!
  assert.equal(body.data.currentEligibleSupply.eligibleTotalAvailable, 40);
  assert.equal(body.data.currentEligibleSupply.participatingPharmaciesCount, 1);

  // No raw PII or raw event timestamps in serialized payload
  const rawJson = JSON.stringify(body.data);
  assert.equal(rawJson.includes('"ip"'), false);
  assert.equal(rawJson.includes('"ipAddress"'), false);
  assert.equal(rawJson.includes('"email"'), false);
  assert.equal(rawJson.includes('"phone"'), false);
  assert.equal(rawJson.includes('"rawQuery"'), false);

  // Medicine below threshold returns INSUFFICIENT_DATA with 0 visible volume
  const medInsuff = await fetch(
    `${baseUrl}/api/v1/intelligence/demand/medicines/${MED_AZITHRO}`,
    { headers: { Authorization: 'Bearer token-a' } }
  );
  assert.equal(medInsuff.status, 200);
  const medInsuffJson = await medInsuff.json();
  assert.equal(medInsuffJson.data.isSufficientData, false);
  assert.equal(medInsuffJson.data.localDemandLevel, 'INSUFFICIENT_DATA');
  assert.equal(medInsuffJson.data.searchVolume, 0);
});

test('Auth, cross-pharmacy isolation, date-range/pagination validation & retention cleanup', async () => {
  const today = getIndianTimeParts().dateStr;
  store.aggregates.push({
    bucketDate: today,
    medicineId: MED_DOLO,
    medicineName: 'Paracetamol 650 mg Tablet',
    area: 'Arera Colony',
    city: 'Bhopal',
    pincodePrefix: '462xxx',
    searchOutcome: 'NO_ELIGIBLE_NEARBY_STOCK',
    searchSource: 'AVAILABILITY_CHECK',
    signalCount: 6,
  });

  // Unauthenticated -> 401
  const unauth = await fetch(`${baseUrl}/api/v1/intelligence/demand/overview`);
  assert.equal(unauth.status, 401);

  // Authenticated user without pharmacy profile -> 403
  const noPharm = await fetch(`${baseUrl}/api/v1/intelligence/demand/overview`, {
    headers: { Authorization: 'Bearer token-nopharm' },
  });
  assert.equal(noPharm.status, 403);

  // Pharmacy B cannot query Pharmacy A's area -> 403
  const crossArea = await fetch(
    `${baseUrl}/api/v1/intelligence/demand/overview?area=Arera%20Colony`,
    { headers: { Authorization: 'Bearer token-b' } }
  );
  assert.equal(crossArea.status, 403);

  // /pharmacies/me/intelligence/demand strictly scopes to Pharmacy A's area
  const myIntel = await fetch(`${baseUrl}/api/v1/pharmacies/me/intelligence/demand`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(myIntel.status, 200);
  const myIntelJson = await myIntel.json();
  assert.equal(myIntelJson.data.pharmacyId, PHARM_A);
  assert.equal(myIntelJson.data.permittedArea, 'Arera Colony');

  // Invalid date range (fromDate > toDate) -> 400
  const badDates = await fetch(
    `${baseUrl}/api/v1/intelligence/demand/trends?fromDate=2026-11-28&toDate=2026-11-01`,
    { headers: { Authorization: 'Bearer token-a' } }
  );
  assert.equal(badDates.status, 400);

  // Unmet demand & areas endpoints work with pagination
  const unmet = await fetch(`${baseUrl}/api/v1/intelligence/demand/unmet?page=1&limit=10`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(unmet.status, 200);
  const unmetJson = await unmet.json();
  assert.equal(unmetJson.data.items.length, 1);

  const areas = await fetch(`${baseUrl}/api/v1/intelligence/demand/areas?page=1&limit=10`, {
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(areas.status, 200);
  const areasJson = await areas.json();
  assert.equal(areasJson.data.items.length, 1);

  // Retention cleanup purges aged aggregates (> 90 days) & expired dedup keys
  store.aggregates.push({
    bucketDate: shiftDays(today, -120),
    medicineId: MED_DOLO,
    medicineName: 'Paracetamol 650 mg Tablet',
    area: 'Arera Colony',
    city: 'Bhopal',
    pincodePrefix: '462xxx',
    searchOutcome: 'MATCH_FOUND',
    searchSource: 'MEDICINE_SEARCH',
    signalCount: 10,
  });
  store.dedup.set('expired-hash', Date.now() - 1000);
  const cleanup = await service.runRetentionCleanup();
  assert.equal(cleanup.aggregatesPurged, 1);
  assert.equal(cleanup.dedupPurged, 1);
});
