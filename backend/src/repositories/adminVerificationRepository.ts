import { getServiceSupabaseClient } from '../config/supabase.js';
import { AppError } from '../types/index.js';
import { VerificationStatus } from './pharmacyRepository.js';

export interface AdminPharmacyVerificationRecord {
  id: string;
  ownerUserId: string | null;
  name: string;
  phone: string;
  email: string | null;
  licenseNumber: string | null;
  isLicensedVerified: boolean;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  isActive: boolean;
  is24x7: boolean;
  tier: string;
  location: {
    address: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PharmacyVerificationEventRecord {
  id: number;
  pharmacyId: string;
  previousStatus: VerificationStatus | null;
  newStatus: VerificationStatus;
  action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REOPEN';
  adminUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface VerifyPharmacyAtomicResult {
  pharmacyId: string;
  previousStatus: VerificationStatus;
  verificationStatus: VerificationStatus;
  isLicensedVerified: boolean;
  rejectionReason: string | null;
}

export interface UpdatePharmacyStatusAtomicResult {
  pharmacyId: string;
  previousStatus: VerificationStatus;
  verificationStatus: VerificationStatus;
  isActive: boolean;
  isLicensedVerified: boolean;
  reason: string;
}

export interface IAdminVerificationRepository {
  listAllPharmacies(params: {
    q?: string;
    status: 'ALL' | VerificationStatus;
    isActive: 'all' | 'true' | 'false';
    sortBy: 'createdAt' | 'name' | 'verificationStatus';
    sortOrder: 'asc' | 'desc';
    page: number;
    limit: number;
  }): Promise<{ items: AdminPharmacyVerificationRecord[]; total: number }>;
  listPharmaciesByVerificationStatus(params: {
    status: VerificationStatus;
    page: number;
    limit: number;
  }): Promise<{ items: AdminPharmacyVerificationRecord[]; total: number }>;
  getPharmacyVerificationById(
    pharmacyId: string
  ): Promise<AdminPharmacyVerificationRecord | null>;
  listVerificationEvents(
    pharmacyId: string
  ): Promise<PharmacyVerificationEventRecord[]>;
  verifyPharmacyAtomic(params: {
    pharmacyId: string;
    adminUserId: string;
    action: 'APPROVE' | 'REJECT';
    reason?: string;
    isVerifiedAdmin?: boolean;
  }): Promise<VerifyPharmacyAtomicResult>;
  updatePharmacyOperationalStatusAtomic(params: {
    pharmacyId: string;
    adminUserId: string;
    action: 'SUSPEND' | 'REACTIVATE';
    reason: string;
    isVerifiedAdmin?: boolean;
  }): Promise<UpdatePharmacyStatusAtomicResult>;
}

export class SupabaseAdminVerificationRepository
  implements IAdminVerificationRepository
{
  private getClient() {
    const client = getServiceSupabaseClient();
    if (!client) {
      throw new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'Admin database client is not configured.'
      );
    }
    return client;
  }

  private mapRow(row: Record<string, any>): AdminPharmacyVerificationRecord {
    const locRaw = row.pharmacy_locations;
    const loc = Array.isArray(locRaw) ? locRaw[0] : locRaw;
    return {
      id: String(row.id),
      ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
      name: String(row.name),
      phone: String(row.phone),
      email: row.email ? String(row.email) : null,
      licenseNumber: row.license_number ? String(row.license_number) : null,
      isLicensedVerified: Boolean(row.is_licensed_verified),
      verificationStatus: (row.verification_status ?? 'PENDING') as VerificationStatus,
      rejectionReason: row.verification_rejection_reason
        ? String(row.verification_rejection_reason)
        : null,
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
      verifiedByUserId: row.verified_by_user_id
        ? String(row.verified_by_user_id)
        : null,
      isActive: Boolean(row.is_active),
      is24x7: Boolean(row.is_24x7),
      tier: String(row.tier ?? 'standard'),
      location: loc
        ? {
            address: String(loc.address),
            area: String(loc.area),
            city: String(loc.city),
            state: String(loc.state),
            pincode: String(loc.pincode),
          }
        : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async listAllPharmacies(params: {
    q?: string;
    status: 'ALL' | VerificationStatus;
    isActive: 'all' | 'true' | 'false';
    sortBy: 'createdAt' | 'name' | 'verificationStatus';
    sortOrder: 'asc' | 'desc';
    page: number;
    limit: number;
  }): Promise<{ items: AdminPharmacyVerificationRecord[]; total: number }> {
    const client = this.getClient();
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;

    const sortColumnMap: Record<string, string> = {
      createdAt: 'created_at',
      name: 'name',
      verificationStatus: 'verification_status',
    };
    const orderCol = sortColumnMap[params.sortBy] ?? 'created_at';

    let query = client
      .from('pharmacies')
      .select('*, pharmacy_locations(address, area, city, state, pincode)', {
        count: 'exact',
      });

    if (params.status !== 'ALL') {
      query = query.eq('verification_status', params.status);
    }
    if (params.isActive === 'true') {
      query = query.eq('is_active', true);
    } else if (params.isActive === 'false') {
      query = query.eq('is_active', false);
    }
    if (params.q && params.q.trim().length > 0) {
      query = query.ilike('name', `%${params.q.trim()}%`);
    }

    const { data, error, count } = await query
      .order(orderCol, { ascending: params.sortOrder === 'asc' })
      .range(from, to);

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    return {
      items: (data ?? []).map((r) => this.mapRow(r as Record<string, any>)),
      total: Number(count ?? 0),
    };
  }

  async listPharmaciesByVerificationStatus(params: {
    status: VerificationStatus;
    page: number;
    limit: number;
  }): Promise<{ items: AdminPharmacyVerificationRecord[]; total: number }> {
    const client = this.getClient();
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;

    const { data, error, count } = await client
      .from('pharmacies')
      .select('*, pharmacy_locations(address, area, city, state, pincode)', {
        count: 'exact',
      })
      .eq('verification_status', params.status)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    return {
      items: (data ?? []).map((r) => this.mapRow(r as Record<string, any>)),
      total: Number(count ?? 0),
    };
  }

  async getPharmacyVerificationById(
    pharmacyId: string
  ): Promise<AdminPharmacyVerificationRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('pharmacies')
      .select('*, pharmacy_locations(address, area, city, state, pincode)')
      .eq('id', pharmacyId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }
    return data ? this.mapRow(data as Record<string, any>) : null;
  }

  async listVerificationEvents(
    pharmacyId: string
  ): Promise<PharmacyVerificationEventRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('pharmacy_verification_events')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    return (data ?? []).map((row: Record<string, any>) => ({
      id: Number(row.id),
      pharmacyId: String(row.pharmacy_id),
      previousStatus: row.previous_status
        ? (String(row.previous_status) as VerificationStatus)
        : null,
      newStatus: String(row.new_status) as VerificationStatus,
      action: String(row.action) as PharmacyVerificationEventRecord['action'],
      adminUserId: String(row.admin_user_id),
      reason: row.reason ? String(row.reason) : null,
      createdAt: String(row.created_at),
    }));
  }

  async verifyPharmacyAtomic(params: {
    pharmacyId: string;
    adminUserId: string;
    action: 'APPROVE' | 'REJECT';
    reason?: string;
    isVerifiedAdmin?: boolean;
  }): Promise<VerifyPharmacyAtomicResult> {
    const client = this.getClient();
    const { data, error } = await client.rpc('verify_pharmacy_license_atomic', {
      p_pharmacy_id: params.pharmacyId,
      p_admin_user_id: params.adminUserId,
      p_action: params.action,
      p_reason: params.reason ?? null,
      p_is_verified_admin: params.isVerifiedAdmin ?? false,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('PHARMACY_NOT_FOUND')) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', msg);
      }
      if (msg.includes('FORBIDDEN')) {
        throw new AppError(403, 'FORBIDDEN', msg);
      }
      if (msg.includes('VALIDATION_ERROR')) {
        throw new AppError(400, 'VALIDATION_ERROR', msg);
      }
      throw new AppError(500, 'DATABASE_ERROR', msg);
    }

    return data as VerifyPharmacyAtomicResult;
  }

  async updatePharmacyOperationalStatusAtomic(params: {
    pharmacyId: string;
    adminUserId: string;
    action: 'SUSPEND' | 'REACTIVATE';
    reason: string;
    isVerifiedAdmin?: boolean;
  }): Promise<UpdatePharmacyStatusAtomicResult> {
    const client = this.getClient();
    const { data, error } = await client.rpc('update_pharmacy_operational_status_atomic', {
      p_pharmacy_id: params.pharmacyId,
      p_admin_user_id: params.adminUserId,
      p_action: params.action,
      p_reason: params.reason,
      p_is_verified_admin: params.isVerifiedAdmin ?? false,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('PHARMACY_NOT_FOUND')) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', msg);
      }
      if (msg.includes('FORBIDDEN')) {
        throw new AppError(403, 'FORBIDDEN', msg);
      }
      if (msg.includes('VALIDATION_ERROR')) {
        throw new AppError(400, 'VALIDATION_ERROR', msg);
      }
      throw new AppError(500, 'DATABASE_ERROR', msg);
    }

    return data as UpdatePharmacyStatusAtomicResult;
  }
}

export const adminVerificationRepository = new SupabaseAdminVerificationRepository();
