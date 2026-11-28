import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { createApp } from '../src/app.js';
import { TokenVerifier } from '../src/middleware/auth.js';
import { IAuthAdminService } from '../src/services/authAdminService.js';
import { PharmacyService } from '../src/services/pharmacyService.js';
import { CollaborationService } from '../src/services/collaborationService.js';
import { ICollaborationRepository } from '../src/repositories/collaborationRepository.js';
import {
  IPharmacyRepository,
  OperatingHourEntry,
  PharmacyProfileRecord,
  RegisterPharmacyInput,
} from '../src/repositories/pharmacyRepository.js';
import { AppError } from '../src/types/index.js';

class InMemoryRegistrationEnv implements IAuthAdminService {
  authUsers = new Map<string, { id: string; email: string }>(); // email -> user
  deletedUserIds: string[] = [];
  failNextAuthCreate = false;
  failNextDbInsert = false;
  pharmacies: PharmacyProfileRecord[] = [];
  operatingHours = new Map<string, OperatingHourEntry[]>();
  private seq = 1;

  reset() {
    this.authUsers.clear();
    this.deletedUserIds = [];
    this.failNextAuthCreate = false;
    this.failNextDbInsert = false;
    this.pharmacies = [];
    this.operatingHours.clear();
    this.seq = 1;
  }

  async createOwnerAccount(params: { email: string; password: string }) {
    if (this.failNextAuthCreate) {
      this.failNextAuthCreate = false;
      throw new AppError(502, 'AUTH_CREATION_FAILED', 'Simulated Auth failure');
    }
    const lower = params.email.toLowerCase();
    if (this.authUsers.has(lower)) {
      throw new AppError(409, 'CONFLICT', 'An account with this email is already registered.');
    }
    const id = `00000000-0000-4000-8000-00000000000${this.seq++}`;
    this.authUsers.set(lower, { id, email: lower });
    return { userId: id };
  }

  async deleteOwnerAccount(userId: string) {
    this.deletedUserIds.push(userId);
    for (const [email, u] of this.authUsers.entries()) {
      if (u.id === userId) {
        this.authUsers.delete(email);
      }
    }
  }
}

const envStore = new InMemoryRegistrationEnv();

const mockPharmacyRepo = {
  findPharmacyByUserId: async (userId: string) =>
    envStore.pharmacies.find((p) => p.ownerUserId === userId) ?? null,
  createPharmacyForUser: async (userId: string, input: RegisterPharmacyInput) => {
    if (envStore.failNextDbInsert) {
      envStore.failNextDbInsert = false;
      throw new AppError(500, 'DATABASE_ERROR', 'Simulated DB failure');
    }
    if (envStore.pharmacies.some((p) => p.ownerUserId === userId)) {
      throw new AppError(409, 'CONFLICT', 'Authenticated user already has a registered pharmacy.');
    }
    if (
      input.licenseNumber &&
      envStore.pharmacies.some(
        (p) => p.licenseNumber?.toUpperCase() === input.licenseNumber?.toUpperCase()
      )
    ) {
      throw new AppError(409, 'CONFLICT', 'Duplicate pharmacy registration or license number.');
    }
    const pharm: PharmacyProfileRecord = {
      id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${envStore.pharmacies.length + 1}`,
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
      location: input.location,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    envStore.pharmacies.push(pharm);
    return pharm;
  },
  upsertOperatingHours: async (pharmacyId: string, hours: OperatingHourEntry[]) => {
    envStore.operatingHours.set(pharmacyId, hours);
    return hours;
  },
} as unknown as IPharmacyRepository;

const mockCollabRepo = {} as ICollaborationRepository;
const pharmacyService = new PharmacyService(mockPharmacyRepo, envStore);
const collaborationService = new CollaborationService(mockCollabRepo, mockPharmacyRepo);

const mockTokenVerifier: TokenVerifier = async (token: string) => {
  if (token.startsWith('owner:')) {
    const email = token.slice('owner:'.length);
    const u = envStore.authUsers.get(email);
    return u ? { id: u.id, email: u.email } : null;
  }
  return null;
};

let server: http.Server;
let baseUrl: string;

before(async () => {
  const app = createApp({
    pharmacyService,
    collaborationService,
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
  envStore.reset();
});

const validPayload = {
  name: 'MedCare Wellness Pharmacy',
  licenseNumber: 'MP-BPL-2026-991',
  phone: '+91-9826012345',
  email: 'medcare@example.com',
  password: 'StrongPassword#2026',
  address: 'Shop 12, Sector C, Arera Colony',
  area: 'Arera Colony',
  city: 'Bhopal',
  state: 'Madhya Pradesh',
  pincode: '462016',
  is24x7: false,
  operatingHours: [
    { dayOfWeek: 1, openTime: '09:00', closeTime: '21:00', isClosed: false, timezone: 'Asia/Kolkata' },
  ],
};

test('Registration: valid self-service signup, idempotency retry, owner login & unverified permission gate', async () => {
  const res = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'reg-key-1',
    },
    body: JSON.stringify(validPayload),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data.pharmacyId);
  assert.equal(body.data.status, 'PENDING_VERIFICATION');
  assert.equal(body.data.isLicensedVerified, false);

  // Never leak password or auth secrets
  const raw = JSON.stringify(body);
  assert.equal(raw.includes('StrongPassword#2026'), false);
  assert.equal(raw.includes('password'), false);

  // Retry with same Idempotency-Key returns same 201 without creating duplicate
  const retry = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'reg-key-1',
    },
    body: JSON.stringify(validPayload),
  });
  assert.equal(retry.status, 201);
  const retryBody = await retry.json();
  assert.equal(retryBody.data.pharmacyId, body.data.pharmacyId);
  assert.equal(envStore.pharmacies.length, 1);

  // Registered owner can log in / access /api/v1/pharmacies/me
  const meRes = await fetch(`${baseUrl}/api/v1/pharmacies/me`, {
    headers: { Authorization: 'Bearer owner:medcare@example.com' },
  });
  assert.equal(meRes.status, 200);
  const meJson = await meRes.json();
  assert.equal(meJson.data.id, body.data.pharmacyId);

  // Unverified pharmacy is blocked from peer-to-peer collaboration
  const collabRes = await fetch(`${baseUrl}/api/v1/collaboration/stock`, {
    headers: { Authorization: 'Bearer owner:medcare@example.com' },
  });
  assert.equal(collabRes.status, 403);
  const collabJson = await collabRes.json();
  assert.equal(collabJson.error.code, 'PHARMACY_NOT_VERIFIED');
});

test('Registration: invalid form data, malformed auth, duplicate email & partial-failure compensation', async () => {
  // 1. Invalid PIN & short password -> 400
  const invalidRes = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validPayload, pincode: '000011', password: '123' }),
  });
  assert.equal(invalidRes.status, 400);

  // 2. Malformed Bearer token -> 401
  const badAuthRes = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid-token',
    },
    body: JSON.stringify(validPayload),
  });
  assert.equal(badAuthRes.status, 401);

  // 3. Unauthenticated request to legacy alias POST /api/v1/pharmacies -> 401
  const unauthAlias = await fetch(`${baseUrl}/api/v1/pharmacies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(unauthAlias.status, 401);

  // 4. Failed Auth account creation -> 502, zero pharmacies created
  envStore.failNextAuthCreate = true;
  const authFailRes = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(authFailRes.status, 502);
  assert.equal(envStore.pharmacies.length, 0);

  // 5. Failed DB insert after Auth creation -> 500 AND Auth account rolled back (no orphan!)
  envStore.failNextDbInsert = true;
  const dbFailRes = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(dbFailRes.status, 500);
  assert.equal(envStore.authUsers.size, 0);
  assert.equal(envStore.deletedUserIds.length, 1);

  // 6. Seed 1 valid pharmacy, then test duplicate email (409) & duplicate license (409 + Auth rollback)
  const firstRes = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(firstRes.status, 201);

  const dupEmailRes = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validPayload, licenseNumber: 'MP-BPL-OTHER-002' }),
  });
  assert.equal(dupEmailRes.status, 409);

  const dupLicenseRes = await fetch(`${baseUrl}/api/v1/pharmacies/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validPayload, email: 'second@example.com' }),
  });
  assert.equal(dupLicenseRes.status, 409);
  // second@example.com auth user was rolled back on license conflict!
  assert.equal(envStore.authUsers.has('second@example.com'), false);
});
