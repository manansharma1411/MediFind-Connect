import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { createApp } from '../src/app.js';
import { TokenVerifier } from '../src/middleware/auth.js';
import {
  AdminPharmacyVerificationRecord,
  IAdminVerificationRepository,
  PharmacyVerificationEventRecord,
  UpdatePharmacyStatusAtomicResult,
  VerifyPharmacyAtomicResult,
} from '../src/repositories/adminVerificationRepository.js';
import { AdminVerificationService } from '../src/services/adminVerificationService.js';
import { CollaborationService } from '../src/services/collaborationService.js';
import { ICollaborationRepository } from '../src/repositories/collaborationRepository.js';
import {
  IPharmacyRepository,
  PharmacyProfileRecord,
  VerificationStatus,
} from '../src/repositories/pharmacyRepository.js';
import { AppError } from '../src/types/index.js';

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const DB_ADMIN_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const PATIENT_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
const PHARM_ID = '11111111-1111-4111-8111-1111111111a1';
const PHARM_OWNED_BY_ADMIN = '22222222-2222-4222-8222-2222222222b2';

class InMemoryAdminVerificationStore implements IAdminVerificationRepository {
  pharmacies: AdminPharmacyVerificationRecord[] = [];
  events: PharmacyVerificationEventRecord[] = [];
  private seq = 1;

  reset() {
    this.events = [];
    this.seq = 1;
    this.pharmacies = [
      {
        id: PHARM_ID,
        ownerUserId: OWNER_ID,
        name: 'CarePlus Bhopal',
        phone: '+91-9826012345',
        email: 'owner@careplus.example.com',
        licenseNumber: 'MP-BPL-2026-101',
        isLicensedVerified: false,
        verificationStatus: 'PENDING',
        rejectionReason: null,
        verifiedAt: null,
        verifiedByUserId: null,
        isActive: true,
        is24x7: false,
        tier: 'standard',
        location: {
          address: 'Plot 8 MP Nagar',
          area: 'MP Nagar',
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          pincode: '462011',
        },
        createdAt: '2026-11-28T00:00:00Z',
        updatedAt: '2026-11-28T00:00:00Z',
      },
      {
        id: PHARM_OWNED_BY_ADMIN,
        ownerUserId: ADMIN_ID,
        name: 'Admin Owned Store',
        phone: '+91-9826012346',
        email: 'adminstore@example.com',
        licenseNumber: 'MP-BPL-2026-999',
        isLicensedVerified: false,
        verificationStatus: 'PENDING',
        rejectionReason: null,
        verifiedAt: null,
        verifiedByUserId: null,
        isActive: true,
        is24x7: false,
        tier: 'standard',
        location: {
          address: 'Plot 9 Arera Colony',
          area: 'Arera Colony',
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          pincode: '462016',
        },
        createdAt: '2026-11-28T00:00:00Z',
        updatedAt: '2026-11-28T00:00:00Z',
      },
    ];
  }

  async listAllPharmacies(params: {
    q?: string;
    status: 'ALL' | VerificationStatus;
    isActive: 'all' | 'true' | 'false';
    sortBy: 'createdAt' | 'name' | 'verificationStatus';
    sortOrder: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    let items = [...this.pharmacies];
    if (params.status !== 'ALL') {
      items = items.filter((p) => p.verificationStatus === params.status);
    }
    if (params.isActive === 'true') items = items.filter((p) => p.isActive);
    if (params.isActive === 'false') items = items.filter((p) => !p.isActive);
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      const av =
        params.sortBy === 'name'
          ? a.name
          : params.sortBy === 'verificationStatus'
            ? a.verificationStatus
            : a.createdAt;
      const bv =
        params.sortBy === 'name'
          ? b.name
          : params.sortBy === 'verificationStatus'
            ? b.verificationStatus
            : b.createdAt;
      return params.sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    const start = (params.page - 1) * params.limit;
    return { items: items.slice(start, start + params.limit), total: items.length };
  }

  async listPharmaciesByVerificationStatus(params: {
    status: VerificationStatus;
    page: number;
    limit: number;
  }) {
    const filtered = this.pharmacies.filter((p) => p.verificationStatus === params.status);
    const start = (params.page - 1) * params.limit;
    return {
      items: filtered.slice(start, start + params.limit),
      total: filtered.length,
    };
  }

  async getPharmacyVerificationById(pharmacyId: string) {
    return this.pharmacies.find((p) => p.id === pharmacyId) ?? null;
  }

  async listVerificationEvents(pharmacyId: string) {
    return this.events
      .filter((e) => e.pharmacyId === pharmacyId)
      .sort((a, b) => b.id - a.id);
  }

  async verifyPharmacyAtomic(params: {
    pharmacyId: string;
    adminUserId: string;
    action: 'APPROVE' | 'REJECT';
    reason?: string;
    isVerifiedAdmin?: boolean;
  }): Promise<VerifyPharmacyAtomicResult> {
    const p = this.pharmacies.find((x) => x.id === params.pharmacyId);
    if (!p) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Pharmacy not found');
    if (!params.isVerifiedAdmin && p.ownerUserId === params.adminUserId) {
      throw new AppError(403, 'FORBIDDEN', 'Self-approval forbidden');
    }

    const prev = p.verificationStatus;
    if (params.action === 'APPROVE') {
      p.verificationStatus = 'VERIFIED';
      p.isLicensedVerified = true;
      p.rejectionReason = null;
      p.verifiedAt = new Date().toISOString();
      p.verifiedByUserId = params.adminUserId;
    } else {
      p.verificationStatus = 'REJECTED';
      p.isLicensedVerified = false;
      p.rejectionReason = params.reason ?? null;
      p.verifiedAt = null;
      p.verifiedByUserId = params.adminUserId;
    }
    p.updatedAt = new Date().toISOString();

    this.events.push({
      id: this.seq++,
      pharmacyId: p.id,
      previousStatus: prev,
      newStatus: p.verificationStatus,
      action: params.action,
      adminUserId: params.adminUserId,
      reason:
        params.action === 'REJECT'
          ? (params.reason ?? null)
          : (params.reason ?? 'License verified by administrator'),
      createdAt: new Date().toISOString(),
    });

    return {
      pharmacyId: p.id,
      previousStatus: prev,
      verificationStatus: p.verificationStatus,
      isLicensedVerified: p.isLicensedVerified,
      rejectionReason: p.rejectionReason,
    };
  }

  async updatePharmacyOperationalStatusAtomic(params: {
    pharmacyId: string;
    adminUserId: string;
    action: 'SUSPEND' | 'REACTIVATE';
    reason: string;
  }): Promise<UpdatePharmacyStatusAtomicResult> {
    const p = this.pharmacies.find((x) => x.id === params.pharmacyId);
    if (!p) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Pharmacy not found');
    const prev = p.verificationStatus;
    if (params.action === 'SUSPEND') {
      p.isActive = false;
      p.verificationStatus = 'SUSPENDED';
      p.rejectionReason = params.reason;
    } else {
      p.isActive = true;
      p.verificationStatus = p.isLicensedVerified ? 'VERIFIED' : 'PENDING';
      p.rejectionReason = null;
    }
    p.updatedAt = new Date().toISOString();

    this.events.push({
      id: this.seq++,
      pharmacyId: p.id,
      previousStatus: prev,
      newStatus: p.verificationStatus,
      action: params.action === 'SUSPEND' ? 'SUSPEND' : 'REOPEN',
      adminUserId: params.adminUserId,
      reason: params.reason,
      createdAt: new Date().toISOString(),
    });

    return {
      pharmacyId: p.id,
      previousStatus: prev,
      verificationStatus: p.verificationStatus,
      isActive: p.isActive,
      isLicensedVerified: p.isLicensedVerified,
      reason: params.reason,
    };
  }
}

const store = new InMemoryAdminVerificationStore();
const adminService = new AdminVerificationService(store);

const mockPharmRepo = {
  findPharmacyByUserId: async (userId: string): Promise<PharmacyProfileRecord | null> => {
    const found = store.pharmacies.find((p) => p.ownerUserId === userId);
    if (!found) return null;
    return {
      id: found.id,
      ownerUserId: found.ownerUserId,
      name: found.name,
      licenseNumber: found.licenseNumber,
      isLicensedVerified: found.isLicensedVerified,
      verificationStatus: found.verificationStatus,
      phone: found.phone,
      email: found.email,
      isActive: found.isActive,
      is24x7: found.is24x7,
      tier: found.tier as 'standard',
      isDemo: false,
      location: found.location
        ? { ...found.location, lat: 23.2313, lng: 77.4326, isLocationVerified: false }
        : {
            address: 'N/A',
            area: 'MP Nagar',
            city: 'Bhopal',
            state: 'MP',
            pincode: '462011',
            lat: 23.2313,
            lng: 77.4326,
            isLocationVerified: false,
          },
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    };
  },
} as unknown as IPharmacyRepository;

const mockCollabRepo = {
  findEligibleStockCandidates: async () => [],
} as unknown as ICollaborationRepository;

const collabService = new CollaborationService(mockCollabRepo, mockPharmRepo);

const mockTokenVerifier: TokenVerifier = async (token: string) => {
  if (token === 'token-admin') {
    return { id: ADMIN_ID, email: 'admin676@gmail.com', appRole: 'super_admin' };
  }
  if (token === 'token-db-admin') {
    return { id: DB_ADMIN_ID, email: 'dbadmin@medifind.in', appRole: null };
  }
  if (token === 'token-owner') {
    return { id: OWNER_ID, email: 'owner@careplus.example.com', appRole: null };
  }
  if (token === 'token-patient') {
    return { id: PATIENT_ID, email: 'patient@example.com', appRole: null };
  }
  return null;
};

let server: http.Server;
let baseUrl: string;

before(async () => {
  const app = createApp({
    adminVerificationService: adminService,
    collaborationService: collabService,
    tokenVerifier: mockTokenVerifier,
    adminRoleChecker: async (userId: string) =>
      userId === DB_ADMIN_ID ? 'super_admin' : null,
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

test('Admin verification: pending list, authz (401/403), self-approval block, reject, approve & collaboration unlock', async () => {
  // 1. Unauthenticated -> 401
  const unauth = await fetch(`${baseUrl}/api/v1/admin/pharmacies/pending`);
  assert.equal(unauth.status, 401);

  // 2. Non-admin pharmacy owner -> 403
  const nonAdmin = await fetch(`${baseUrl}/api/v1/admin/pharmacies/pending`, {
    headers: { Authorization: 'Bearer token-owner' },
  });
  assert.equal(nonAdmin.status, 403);

  // 2b. Patient user -> 403 on /admin/me and /admin/pharmacies/pending
  const patientMe = await fetch(`${baseUrl}/api/v1/admin/me`, {
    headers: { Authorization: 'Bearer token-patient' },
  });
  assert.equal(patientMe.status, 403);

  // 2c. Authorized super_admin (app_metadata) & DB-backed admin (platform_administrators) -> 200 on /admin/me
  const adminMe = await fetch(`${baseUrl}/api/v1/admin/me`, {
    headers: { Authorization: 'Bearer token-admin' },
  });
  assert.equal(adminMe.status, 200);
  const adminMeJson = await adminMe.json();
  assert.equal(adminMeJson.data.role, 'super_admin');
  assert.equal(adminMeJson.data.isSuperAdmin, true);

  const dbAdminPending = await fetch(`${baseUrl}/api/v1/admin/pharmacies/pending`, {
    headers: { Authorization: 'Bearer token-db-admin' },
  });
  assert.equal(dbAdminPending.status, 200);

  // 3. Unverified pharmacy is blocked from collaboration -> 403 PHARMACY_NOT_VERIFIED
  const unverifiedCollab = await fetch(`${baseUrl}/api/v1/collaboration/stock`, {
    headers: { Authorization: 'Bearer token-owner' },
  });
  assert.equal(unverifiedCollab.status, 403);

  // 4. Admin lists pending pharmacies -> sees CarePlus Bhopal & licenseNumber
  const pendingRes = await fetch(`${baseUrl}/api/v1/admin/pharmacies/pending`, {
    headers: { Authorization: 'Bearer token-admin' },
  });
  assert.equal(pendingRes.status, 200);
  const pendingJson = await pendingRes.json();
  assert.equal(pendingJson.data.items.length, 2);
  assert.equal(pendingJson.data.items[0].licenseNumber, 'MP-BPL-2026-101');

  // 5. Verified super_admin who also owns a pharmacy CAN reject/approve via admin endpoint (admin role precedence),
  //    while a non-admin pharmacy owner CANNOT reject/approve any pharmacy -> 403
  const adminRejectOwned = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies/${PHARM_OWNED_BY_ADMIN}/verification`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'REJECT',
        reason: 'Incomplete state license scan on admin-owned test store.',
      }),
    }
  );
  assert.equal(adminRejectOwned.status, 200);
  const adminRejectOwnedJson = await adminRejectOwned.json();
  assert.equal(adminRejectOwnedJson.data.verificationStatus, 'REJECTED');
  assert.equal(adminRejectOwnedJson.data.isLicensedVerified, false);

  const ownerRejectOther = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies/${PHARM_OWNED_BY_ADMIN}/verification`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-owner',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'REJECT',
        reason: 'Unauthorized owner attempting rejection',
      }),
    }
  );
  assert.equal(ownerRejectOther.status, 403);

  const ownerRejectOwn = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/verification`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-owner',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    }
  );
  assert.equal(ownerRejectOwn.status, 403);

  // 6. Reject without reason -> 400
  const badReject = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/verification`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'REJECT' }),
    }
  );
  assert.equal(badReject.status, 400);

  // 7. Reject with valid reason -> 200, status REJECTED, isLicensedVerified false
  const rejectRes = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/verification`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'REJECT',
        reason: 'Drug license document number does not match state registry.',
      }),
    }
  );
  assert.equal(rejectRes.status, 200);
  const rejectJson = await rejectRes.json();
  assert.equal(rejectJson.data.verificationStatus, 'REJECTED');
  assert.equal(rejectJson.data.isLicensedVerified, false);

  // 8. Approve -> 200, status VERIFIED, isLicensedVerified true
  const approveRes = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/verification`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'APPROVE',
        reason: 'Verified against MP State Pharmacy Council registry.',
      }),
    }
  );
  assert.equal(approveRes.status, 200);
  const approveJson = await approveRes.json();
  assert.equal(approveJson.data.verificationStatus, 'VERIFIED');
  assert.equal(approveJson.data.isLicensedVerified, true);

  // 9. Verification details & audit history contain both REJECT and APPROVE events
  const detailRes = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/verification`,
    { headers: { Authorization: 'Bearer token-admin' } }
  );
  assert.equal(detailRes.status, 200);
  const detailJson = await detailRes.json();
  assert.equal(detailJson.data.history.length, 2);
  assert.equal(detailJson.data.history[0].action, 'APPROVE');
  assert.equal(detailJson.data.history[0].adminUserId, ADMIN_ID);
  assert.equal(detailJson.data.history[1].action, 'REJECT');

  // 10. Verified pharmacy now has collaboration access -> 200 OK
  const verifiedCollab = await fetch(`${baseUrl}/api/v1/collaboration/stock`, {
    headers: { Authorization: 'Bearer token-owner' },
  });
  assert.equal(verifiedCollab.status, 200);
});

test('Admin Pharmacy Management: list, search, filter, sort, pagination, details, suspend & reactivate', async () => {
  // Unauthorized -> 401 / 403
  assert.equal((await fetch(`${baseUrl}/api/v1/admin/pharmacies`)).status, 401);
  assert.equal(
    (
      await fetch(`${baseUrl}/api/v1/admin/pharmacies`, {
        headers: { Authorization: 'Bearer token-owner' },
      })
    ).status,
    403
  );

  // List all with pagination & sortBy name asc
  const listRes = await fetch(
    `${baseUrl}/api/v1/admin/pharmacies?sortBy=name&sortOrder=asc&page=1&limit=1`,
    { headers: { Authorization: 'Bearer token-admin' } }
  );
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.equal(listJson.data.items.length, 1);
  assert.equal(listJson.data.items[0].name, 'Admin Owned Store');
  assert.equal(listJson.data.pagination.total, 2);
  assert.equal(listJson.data.pagination.totalPages, 2);

  // Search by name
  const searchRes = await fetch(`${baseUrl}/api/v1/admin/pharmacies?q=CarePlus`, {
    headers: { Authorization: 'Bearer token-admin' },
  });
  assert.equal(searchRes.status, 200);
  const searchJson = await searchRes.json();
  assert.equal(searchJson.data.items.length, 1);
  assert.equal(searchJson.data.items[0].id, PHARM_ID);

  // Approve CarePlus first, then filter by status=VERIFIED
  await fetch(`${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/verification`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer token-admin', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' }),
  });

  const verifiedList = await fetch(`${baseUrl}/api/v1/admin/pharmacies?status=VERIFIED`, {
    headers: { Authorization: 'Bearer token-admin' },
  });
  const verifiedJson = await verifiedList.json();
  assert.equal(verifiedJson.data.items.length, 1);

  // Get Pharmacy Details
  const detailRes = await fetch(`${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}`, {
    headers: { Authorization: 'Bearer token-admin' },
  });
  assert.equal(detailRes.status, 200);
  const detailJson = await detailRes.json();
  assert.equal(detailJson.data.pharmacy.licenseNumber, 'MP-BPL-2026-101');
  assert.equal(detailJson.data.history.length, 1);

  // Suspend pharmacy -> isActive false, status SUSPENDED
  const suspendRes = await fetch(`${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/status`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer token-admin', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'SUSPEND',
      reason: 'Temporary cold-chain compliance audit hold.',
    }),
  });
  assert.equal(suspendRes.status, 200);
  const suspendJson = await suspendRes.json();
  assert.equal(suspendJson.data.isActive, false);
  assert.equal(suspendJson.data.verificationStatus, 'SUSPENDED');

  // Reactivate pharmacy -> restores VERIFIED because isLicensedVerified is true
  const reactivateRes = await fetch(`${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}/status`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer token-admin', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'REACTIVATE',
      reason: 'Compliance inspection passed and cleared.',
    }),
  });
  assert.equal(reactivateRes.status, 200);
  const reactivateJson = await reactivateRes.json();
  assert.equal(reactivateJson.data.isActive, true);
  assert.equal(reactivateJson.data.verificationStatus, 'VERIFIED');

  // Audit log records APPROVE, SUSPEND, and REOPEN
  const afterDetail = await (
    await fetch(`${baseUrl}/api/v1/admin/pharmacies/${PHARM_ID}`, {
      headers: { Authorization: 'Bearer token-admin' },
    })
  ).json();
  assert.equal(afterDetail.data.history.length, 3);
  assert.equal(afterDetail.data.history[0].action, 'REOPEN');
  assert.equal(afterDetail.data.history[1].action, 'SUSPEND');
});
