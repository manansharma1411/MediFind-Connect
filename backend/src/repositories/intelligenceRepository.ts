import { getServiceSupabaseClient } from '../config/supabase.js';
import { AppError } from '../types/index.js';
import {
  EligibleInventorySlot,
  SearchOutcome,
  SearchSource,
} from '../services/demandPrivacyEngine.js';

export interface DemandAggregateRecord {
  bucketDate: string; // YYYY-MM-DD
  medicineId: string | null;
  medicineName: string | null;
  area: string;
  city: string;
  pincodePrefix: string;
  searchOutcome: SearchOutcome;
  searchSource: SearchSource;
  signalCount: number;
}

export interface DemandAggregationRunRecord {
  runType: 'RETENTION_CLEANUP' | 'ROLLUP_VERIFY';
  status: 'COMPLETED' | 'FAILED';
  recordsProcessed: number;
  recordsPurged: number;
  completedAt: string | null;
}

export interface IIntelligenceRepository {
  medicineExists(medicineId: string): Promise<boolean>;
  recordDemandSignal(params: {
    bucketDate: string;
    medicineId: string | null;
    area: string;
    city: string;
    pincodePrefix: string;
    searchOutcome: SearchOutcome;
    searchSource: SearchSource;
    dedupHash: string;
    dedupTtlSeconds: number;
  }): Promise<{ recorded: boolean; deduplicated: boolean }>;
  listAggregates(params: {
    fromDate: string;
    toDate: string;
    area?: string;
    city?: string;
    medicineId?: string;
    outcomes?: SearchOutcome[];
  }): Promise<DemandAggregateRecord[]>;
  listEligibleInventorySlots(params: {
    area?: string;
    city?: string;
    medicineId?: string;
  }): Promise<EligibleInventorySlot[]>;
  getLatestAggregationRun(): Promise<DemandAggregationRunRecord | null>;
  cleanupExpiredData(retentionDays: number): Promise<{
    dedupPurged: number;
    aggregatesPurged: number;
    cutoffDate: string;
  }>;
}

export class SupabaseIntelligenceRepository implements IIntelligenceRepository {
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

  async medicineExists(medicineId: string): Promise<boolean> {
    const client = this.getClient();
    const { data, error } = await client
      .from('medicines')
      .select('id')
      .eq('id', medicineId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }
    return Boolean(data?.id);
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
    const client = this.getClient();
    const { data, error } = await client.rpc('record_demand_signal_atomic', {
      p_bucket_date: params.bucketDate,
      p_medicine_id: params.medicineId,
      p_area: params.area,
      p_city: params.city,
      p_pincode_prefix: params.pincodePrefix,
      p_search_outcome: params.searchOutcome,
      p_search_source: params.searchSource,
      p_dedup_hash: params.dedupHash,
      p_dedup_ttl_seconds: params.dedupTtlSeconds,
    });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    return {
      recorded: Boolean(data?.recorded),
      deduplicated: Boolean(data?.deduplicated),
    };
  }

  async listAggregates(params: {
    fromDate: string;
    toDate: string;
    area?: string;
    city?: string;
    medicineId?: string;
    outcomes?: SearchOutcome[];
  }): Promise<DemandAggregateRecord[]> {
    const client = this.getClient();
    let query = client
      .from('demand_daily_aggregates')
      .select(
        `
        bucket_date,
        medicine_id,
        area,
        city,
        pincode_prefix,
        search_outcome,
        search_source,
        signal_count,
        medicines (
          display_name
        )
      `
      )
      .gte('bucket_date', params.fromDate)
      .lte('bucket_date', params.toDate)
      .order('bucket_date', { ascending: false });

    if (params.medicineId) {
      query = query.eq('medicine_id', params.medicineId);
    }
    if (params.area) {
      query = query.ilike('area', params.area);
    }
    if (params.city) {
      query = query.ilike('city', params.city);
    }
    if (params.outcomes && params.outcomes.length > 0) {
      query = query.in('search_outcome', params.outcomes);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    return (data ?? []).map((row: any) => {
      const med = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines;
      return {
        bucketDate: row.bucket_date,
        medicineId: row.medicine_id ?? null,
        medicineName: med?.display_name ?? null,
        area: row.area,
        city: row.city,
        pincodePrefix: row.pincode_prefix,
        searchOutcome: row.search_outcome,
        searchSource: row.search_source,
        signalCount: Number(row.signal_count ?? 0),
      };
    });
  }

  async listEligibleInventorySlots(params: {
    area?: string;
    city?: string;
    medicineId?: string;
  }): Promise<EligibleInventorySlot[]> {
    const client = this.getClient();
    let query = client
      .from('pharmacy_inventory')
      .select(
        `
        pharmacy_id,
        medicine_id,
        quantity_available,
        quantity_reserved,
        expiry_date,
        pharmacies!inner (
          is_active,
          is_licensed_verified,
          pharmacy_locations (
            area,
            city
          )
        )
      `
      )
      .gt('quantity_available', 0);

    if (params.medicineId) {
      query = query.eq('medicine_id', params.medicineId);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    const slots: EligibleInventorySlot[] = [];
    for (const row of data ?? []) {
      const pharm = Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies;
      const locRaw = pharm?.pharmacy_locations;
      const loc = Array.isArray(locRaw) ? locRaw[0] : locRaw;
      const slotArea = loc?.area ?? 'UNKNOWN_AREA';
      const slotCity = loc?.city ?? 'UNKNOWN';

      if (params.area && slotArea.toLowerCase() !== params.area.toLowerCase()) {
        continue;
      }
      if (params.city && slotCity.toLowerCase() !== params.city.toLowerCase()) {
        continue;
      }

      slots.push({
        pharmacyId: row.pharmacy_id,
        medicineId: row.medicine_id,
        area: slotArea,
        city: slotCity,
        quantityAvailable: Number(row.quantity_available ?? 0),
        quantityReserved: Number(row.quantity_reserved ?? 0),
        expiryDate: row.expiry_date,
        isPharmacyActive: Boolean(pharm?.is_active),
        isPharmacyVerified: Boolean(pharm?.is_licensed_verified),
      });
    }

    return slots;
  }

  async getLatestAggregationRun(): Promise<DemandAggregationRunRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('demand_aggregation_runs')
      .select('run_type, status, records_processed, records_purged, completed_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    if (!data) return null;
    return {
      runType: data.run_type,
      status: data.status,
      recordsProcessed: Number(data.records_processed ?? 0),
      recordsPurged: Number(data.records_purged ?? 0),
      completedAt: data.completed_at ?? null,
    };
  }

  async cleanupExpiredData(retentionDays: number): Promise<{
    dedupPurged: number;
    aggregatesPurged: number;
    cutoffDate: string;
  }> {
    const client = this.getClient();
    const { data, error } = await client.rpc('cleanup_expired_demand_data_atomic', {
      p_retention_days: retentionDays,
    });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', error.message);
    }

    return {
      dedupPurged: Number(data?.dedupPurged ?? 0),
      aggregatesPurged: Number(data?.aggregatesPurged ?? 0),
      cutoffDate: String(data?.cutoffDate ?? ''),
    };
  }
}

export const intelligenceRepository = new SupabaseIntelligenceRepository();
