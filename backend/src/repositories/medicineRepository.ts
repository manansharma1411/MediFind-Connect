import { getServiceSupabaseClient } from '../config/supabase.js';
import { AppError } from '../types/index.js';

export interface MedicineBrandRecord {
  id: string;
  brandName: string;
  manufacturer: string;
}

export interface MedicineRecord {
  id: string;
  name: string; // Alias of displayName for frontend compatibility
  genericName: string;
  displayName: string;
  primaryBrand: string | null;
  therapeuticClass: string | null;
  form: string; // Alias of dosageForm for frontend compatibility
  dosageForm: string;
  strength: string;
  packSize: string;
  isPrescriptionRequired: boolean;
  storageCondition: string;
  brands: MedicineBrandRecord[];
  createdAt: string;
  updatedAt: string;
  matchRank?: number;
  similarityScore?: number;
}

export interface OperatingHourRecord {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  timezone: string;
}

export interface ExceptionalClosureRecord {
  closureDate: string;
  isClosed: boolean;
  customOpenTime: string | null;
  customCloseTime: string | null;
}

export interface RawPharmacyStockRecord {
  pharmacyId: string;
  pharmacyName: string;
  isActive: boolean;
  is24x7: boolean;
  isDemo: boolean;
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  expiryDate: string;
  quantityAvailable: number;
  quantityReserved: number;
  mrp: number;
  sellingPrice: number;
  reorderThreshold: number;
  updatedAt: string;
  operatingHours: OperatingHourRecord[];
  exceptionalClosures: ExceptionalClosureRecord[];
}

export interface MedicineSearchRawResult {
  matches: MedicineRecord[];
  suggestions: MedicineRecord[];
  total: number;
}

export interface IMedicineRepository {
  searchMedicines(
    query: string,
    form: string | undefined,
    page: number,
    limit: number
  ): Promise<MedicineSearchRawResult>;
  findMedicineById(id: string): Promise<MedicineRecord | null>;
  findStockForMedicine(medicineId: string): Promise<RawPharmacyStockRecord[]>;
}

/**
 * Supabase PostgreSQL implementation of IMedicineRepository.
 * Uses server-side service client strictly to project public-safe fields,
 * never exposing `license_number`, `email`, or `unit_cost_price`.
 */
export class SupabaseMedicineRepository implements IMedicineRepository {
  private getClient() {
    const client = getServiceSupabaseClient();
    if (!client) {
      throw new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'Database connection is not configured.'
      );
    }
    return client;
  }

  async searchMedicines(
    query: string,
    form: string | undefined,
    page: number,
    limit: number
  ): Promise<MedicineSearchRawResult> {
    const client = this.getClient();
    const offset = (page - 1) * limit;

    const { data: rpcRows, error } = await client.rpc('search_medicines_ranked', {
      p_query: query,
      p_form: form ?? null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to search medicines: ${error.message}`);
    }

    const rows = (rpcRows || []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      return { matches: [], suggestions: [], total: 0 };
    }

    const medIds = rows.map((r) => String(r.id));
    const { data: brandRows } = await client
      .from('medicine_brands')
      .select('id, medicine_id, brand_name, manufacturer')
      .in('medicine_id', medIds);

    const brandsByMed = new Map<string, MedicineBrandRecord[]>();
    for (const b of brandRows || []) {
      const mId = String(b.medicine_id);
      const list = brandsByMed.get(mId) || [];
      list.push({
        id: String(b.id),
        brandName: String(b.brand_name),
        manufacturer: String(b.manufacturer),
      });
      brandsByMed.set(mId, list);
    }

    const matches: MedicineRecord[] = [];
    const suggestions: MedicineRecord[] = [];
    let total = 0;

    for (const r of rows) {
      total = Number(r.total_count ?? rows.length);
      const brands = brandsByMed.get(String(r.id)) || [];
      const displayName = String(r.display_name);
      const dosageForm = String(r.dosage_form);
      const record: MedicineRecord = {
        id: String(r.id),
        name: displayName,
        genericName: String(r.generic_name),
        displayName,
        primaryBrand: brands[0]?.brandName ?? null,
        therapeuticClass: r.therapeutic_class ? String(r.therapeutic_class) : null,
        form: dosageForm,
        dosageForm,
        strength: String(r.strength),
        packSize: String(r.pack_size),
        isPrescriptionRequired: Boolean(r.is_prescription_required),
        storageCondition: String(r.storage_condition),
        brands,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
        matchRank: Number(r.match_rank ?? 1),
        similarityScore: Number(r.similarity_score ?? 0),
      };

      // Rank 5 indicates trigram similarity suggestion (not an exact/substring match)
      if (query && record.matchRank === 5) {
        suggestions.push(record);
      } else {
        matches.push(record);
      }
    }

    // If only typo suggestions were found, confirmed matches count is 0
    const confirmedTotal = matches.length === 0 && suggestions.length > 0 ? 0 : total;
    return { matches, suggestions, total: confirmedTotal };
  }

  async findMedicineById(id: string): Promise<MedicineRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('medicines')
      .select(`
        id, generic_name, display_name, therapeutic_class,
        dosage_form, strength, pack_size, is_prescription_required,
        storage_condition, created_at, updated_at,
        medicine_brands ( id, brand_name, manufacturer )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to retrieve medicine: ${error.message}`);
    }
    if (!data) return null;

    const rawBrands = Array.isArray(data.medicine_brands) ? data.medicine_brands : [];
    const brands = rawBrands.map((b: Record<string, unknown>) => ({
      id: String(b.id),
      brandName: String(b.brand_name),
      manufacturer: String(b.manufacturer),
    }));
    const displayName = String(data.display_name);
    const dosageForm = String(data.dosage_form);
    return {
      id: String(data.id),
      name: displayName,
      genericName: String(data.generic_name),
      displayName,
      primaryBrand: brands[0]?.brandName ?? null,
      therapeuticClass: data.therapeutic_class ? String(data.therapeutic_class) : null,
      form: dosageForm,
      dosageForm,
      strength: String(data.strength),
      packSize: String(data.pack_size),
      isPrescriptionRequired: Boolean(data.is_prescription_required),
      storageCondition: String(data.storage_condition),
      brands,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  }

  async findStockForMedicine(medicineId: string): Promise<RawPharmacyStockRecord[]> {
    const client = this.getClient();
    // Explicitly select ONLY public-safe columns (NEVER license_number, email, or unit_cost_price)
    const { data, error } = await client
      .from('pharmacy_inventory')
      .select(`
        expiry_date,
        quantity_available,
        quantity_reserved,
        mrp,
        selling_price,
        reorder_threshold,
        updated_at,
        pharmacies!inner (
          id,
          name,
          is_active,
          is_24x7,
          is_demo,
          pharmacy_locations!inner (
            address, area, city, state, pincode, lat, lng
          ),
          pharmacy_operating_hours (
            day_of_week, open_time, close_time, is_closed, timezone
          ),
          pharmacy_exceptional_closures (
            closure_date, is_closed, custom_open_time, custom_close_time
          )
        )
      `)
      .eq('medicine_id', medicineId)
      .eq('pharmacies.is_active', true);

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to query availability: ${error.message}`);
    }

    const results: RawPharmacyStockRecord[] = [];
    for (const row of data || []) {
      const pharm = row.pharmacies as unknown as Record<string, unknown>;
      const loc = (Array.isArray(pharm.pharmacy_locations)
        ? pharm.pharmacy_locations[0]
        : pharm.pharmacy_locations) as Record<string, unknown>;
      if (!loc) continue;

      const hours = Array.isArray(pharm.pharmacy_operating_hours)
        ? pharm.pharmacy_operating_hours
        : [];
      const closures = Array.isArray(pharm.pharmacy_exceptional_closures)
        ? pharm.pharmacy_exceptional_closures
        : [];

      results.push({
        pharmacyId: String(pharm.id),
        pharmacyName: String(pharm.name),
        isActive: Boolean(pharm.is_active),
        is24x7: Boolean(pharm.is_24x7),
        isDemo: Boolean(pharm.is_demo),
        address: String(loc.address),
        area: String(loc.area),
        city: String(loc.city),
        state: String(loc.state),
        pincode: String(loc.pincode),
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        expiryDate: String(row.expiry_date),
        quantityAvailable: Number(row.quantity_available),
        quantityReserved: Number(row.quantity_reserved),
        mrp: Number(row.mrp),
        sellingPrice: Number(row.selling_price),
        reorderThreshold: Number(row.reorder_threshold),
        updatedAt: String(row.updated_at),
        operatingHours: hours.map((h: Record<string, unknown>) => ({
          dayOfWeek: Number(h.day_of_week),
          openTime: h.open_time ? String(h.open_time) : null,
          closeTime: h.close_time ? String(h.close_time) : null,
          isClosed: Boolean(h.is_closed),
          timezone: String(h.timezone || 'Asia/Kolkata'),
        })),
        exceptionalClosures: closures.map((c: Record<string, unknown>) => ({
          closureDate: String(c.closure_date),
          isClosed: Boolean(c.is_closed),
          customOpenTime: c.custom_open_time ? String(c.custom_open_time) : null,
          customCloseTime: c.custom_close_time ? String(c.custom_close_time) : null,
        })),
      });
    }

    return results;
  }
}
