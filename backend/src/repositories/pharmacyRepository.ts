import { getServiceSupabaseClient } from '../config/supabase.js';
import { AppError } from '../types/index.js';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export interface PharmacyProfileRecord {
  id: string;
  ownerUserId: string | null;
  name: string;
  licenseNumber: string | null;
  isLicensedVerified: boolean;
  verificationStatus: VerificationStatus;
  phone: string;
  email: string | null;
  isActive: boolean;
  is24x7: boolean;
  tier: string;
  isDemo: boolean;
  location: {
    address: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    lat: number;
    lng: number;
    isLocationVerified: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OperatingHourEntry {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  timezone: string;
}

export interface PrivateInventoryItemRecord {
  id: string;
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  brands: string[];
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  quantityReserved: number;
  mrp: number;
  sellingPrice: number;
  unitCostPrice: number | null;
  reorderThreshold: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  isExpired: boolean;
  updatedAt: string;
}

export interface InventoryMovementRecord {
  id: number;
  inventoryId: string;
  pharmacyId: string;
  medicineId: string;
  medicineName?: string;
  movementType: string | null;
  deltaQuantity: number;
  previousQuantity: number | null;
  resultingQuantity: number;
  reason: string;
  actorId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RegisterPharmacyInput {
  name: string;
  phone: string;
  email?: string | null;
  licenseNumber?: string | null;
  is24x7: boolean;
  tier: 'standard' | 'hub' | 'hospital_attached';
  location: {
    address: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    lat: number;
    lng: number;
  };
}

export interface UpdatePharmacyProfileInput {
  name?: string;
  phone?: string;
  email?: string | null;
  licenseNumber?: string | null;
  is24x7?: boolean;
  location?: Partial<RegisterPharmacyInput['location']>;
}

export interface AddInventoryItemInput {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  quantityReserved: number;
  mrp: number;
  sellingPrice: number;
  unitCostPrice?: number | null;
  reorderThreshold: number;
}

export interface UpdateInventoryItemInput {
  expiryDate?: string;
  mrp?: number;
  sellingPrice?: number;
  unitCostPrice?: number | null;
  reorderThreshold?: number;
}

export interface AdjustInventoryInput {
  deltaQuantity: number;
  movementType: string;
  reason: string;
  notes?: string | null;
}

export interface IPharmacyRepository {
  findPharmacyByUserId(userId: string): Promise<PharmacyProfileRecord | null>;
  createPharmacyForUser(userId: string, input: RegisterPharmacyInput): Promise<PharmacyProfileRecord>;
  updatePharmacyProfile(
    pharmacyId: string,
    input: UpdatePharmacyProfileInput
  ): Promise<PharmacyProfileRecord>;
  getOperatingHours(pharmacyId: string): Promise<OperatingHourEntry[]>;
  upsertOperatingHours(
    pharmacyId: string,
    hours: OperatingHourEntry[]
  ): Promise<OperatingHourEntry[]>;
  listAllInventory(pharmacyId: string): Promise<PrivateInventoryItemRecord[]>;
  getInventoryItem(
    pharmacyId: string,
    itemId: string
  ): Promise<PrivateInventoryItemRecord | null>;
  addInventoryItem(
    pharmacyId: string,
    userId: string,
    input: AddInventoryItemInput
  ): Promise<PrivateInventoryItemRecord>;
  updateInventoryItem(
    pharmacyId: string,
    itemId: string,
    input: UpdateInventoryItemInput
  ): Promise<PrivateInventoryItemRecord>;
  adjustInventoryAtomic(
    pharmacyId: string,
    itemId: string,
    userId: string,
    input: AdjustInventoryInput
  ): Promise<{
    inventoryId: string;
    previousQuantity: number;
    newQuantity: number;
    auditId: number;
  }>;
  getItemHistory(pharmacyId: string, itemId: string): Promise<InventoryMovementRecord[]>;
  getRecentMovements(pharmacyId: string, limit: number): Promise<InventoryMovementRecord[]>;
}

function getTodayIstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function deriveStockStatus(
  quantityAvailable: number,
  reorderThreshold: number
): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
  if (quantityAvailable <= 0) return 'OUT_OF_STOCK';
  if (quantityAvailable <= reorderThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export class SupabasePharmacyRepository implements IPharmacyRepository {
  private getClient() {
    const client = getServiceSupabaseClient();
    if (!client) {
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database connection is not configured.');
    }
    return client;
  }

  private mapProfile(row: Record<string, unknown>): PharmacyProfileRecord {
    const rawLoc = row.pharmacy_locations;
    const loc = (Array.isArray(rawLoc) ? rawLoc[0] : rawLoc) as Record<string, unknown>;
    return {
      id: String(row.id),
      ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
      name: String(row.name),
      licenseNumber: row.license_number ? String(row.license_number) : null,
      isLicensedVerified: Boolean(row.is_licensed_verified),
      verificationStatus: (row.verification_status as VerificationStatus) || 'PENDING',
      phone: String(row.phone),
      email: row.email ? String(row.email) : null,
      isActive: Boolean(row.is_active),
      is24x7: Boolean(row.is_24x7),
      tier: String(row.tier),
      isDemo: Boolean(row.is_demo),
      location: {
        address: String(loc?.address ?? ''),
        area: String(loc?.area ?? ''),
        city: String(loc?.city ?? ''),
        state: String(loc?.state ?? ''),
        pincode: String(loc?.pincode ?? ''),
        lat: Number(loc?.lat ?? 0),
        lng: Number(loc?.lng ?? 0),
        isLocationVerified: Boolean(loc?.is_location_verified),
      },
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapInventoryRow(row: Record<string, unknown>): PrivateInventoryItemRecord {
    const med = row.medicines as Record<string, unknown>;
    const rawBrands = Array.isArray(med?.medicine_brands) ? med.medicine_brands : [];
    const qtyAvail = Number(row.quantity_available);
    const threshold = Number(row.reorder_threshold);
    const expiryDate = String(row.expiry_date);
    const today = getTodayIstDate();

    return {
      id: String(row.id),
      pharmacyId: String(row.pharmacy_id),
      medicineId: String(row.medicine_id),
      medicineName: String(med?.display_name ?? ''),
      genericName: String(med?.generic_name ?? ''),
      dosageForm: String(med?.dosage_form ?? ''),
      strength: String(med?.strength ?? ''),
      packSize: String(med?.pack_size ?? ''),
      brands: rawBrands.map((b: Record<string, unknown>) => String(b.brand_name)),
      batchNumber: String(row.batch_number),
      expiryDate,
      quantityAvailable: qtyAvail,
      quantityReserved: Number(row.quantity_reserved),
      mrp: Number(row.mrp),
      sellingPrice: Number(row.selling_price),
      unitCostPrice: row.unit_cost_price !== null && row.unit_cost_price !== undefined ? Number(row.unit_cost_price) : null,
      reorderThreshold: threshold,
      status: deriveStockStatus(qtyAvail, threshold),
      isExpired: expiryDate <= today,
      updatedAt: String(row.updated_at),
    };
  }

  async findPharmacyByUserId(userId: string): Promise<PharmacyProfileRecord | null> {
    const client = this.getClient();

    // 1. Check direct ownership first
    const { data: owned, error: ownedErr } = await client
      .from('pharmacies')
      .select('*, pharmacy_locations(*)')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (ownedErr) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to look up pharmacy: ${ownedErr.message}`);
    }
    if (owned) return this.mapProfile(owned as Record<string, unknown>);

    // 2. Check pharmacy_staff membership
    const { data: staff, error: staffErr } = await client
      .from('pharmacy_staff')
      .select('pharmacy_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (staffErr) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to look up staff membership: ${staffErr.message}`);
    }
    if (!staff) return null;

    const { data: memberPharm, error: memErr } = await client
      .from('pharmacies')
      .select('*, pharmacy_locations(*)')
      .eq('id', staff.pharmacy_id)
      .maybeSingle();

    if (memErr) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load pharmacy: ${memErr.message}`);
    }
    return memberPharm ? this.mapProfile(memberPharm as Record<string, unknown>) : null;
  }

  async createPharmacyForUser(
    userId: string,
    input: RegisterPharmacyInput
  ): Promise<PharmacyProfileRecord> {
    const client = this.getClient();

    const existing = await this.findPharmacyByUserId(userId);
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Authenticated user already has a registered pharmacy.');
    }

    const { data: pharm, error: pharmErr } = await client
      .from('pharmacies')
      .insert({
        owner_user_id: userId,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        license_number: input.licenseNumber ?? null,
        is_licensed_verified: false,
        verification_status: 'PENDING',
        is_active: true,
        is_24x7: input.is24x7,
        tier: input.tier,
        is_demo: false,
      })
      .select('*')
      .single();

    if (pharmErr) {
      if (pharmErr.code === '23505') {
        throw new AppError(409, 'CONFLICT', 'Duplicate pharmacy registration or license number.');
      }
      throw new AppError(500, 'DATABASE_ERROR', `Failed to create pharmacy: ${pharmErr.message}`);
    }

    const { error: locErr } = await client.from('pharmacy_locations').insert({
      pharmacy_id: pharm.id,
      address: input.location.address,
      area: input.location.area,
      city: input.location.city,
      state: input.location.state,
      pincode: input.location.pincode,
      lat: input.location.lat,
      lng: input.location.lng,
      is_location_verified: false,
    });

    if (locErr) {
      await client.from('pharmacies').delete().eq('id', pharm.id);
      throw new AppError(500, 'DATABASE_ERROR', `Failed to save pharmacy location: ${locErr.message}`);
    }

    await client.from('pharmacy_staff').insert({
      pharmacy_id: pharm.id,
      user_id: userId,
      staff_role: 'owner',
    });

    const created = await this.findPharmacyByUserId(userId);
    if (!created) {
      throw new AppError(500, 'DATABASE_ERROR', 'Pharmacy created but could not be reloaded.');
    }
    return created;
  }

  async updatePharmacyProfile(
    pharmacyId: string,
    input: UpdatePharmacyProfileInput
  ): Promise<PharmacyProfileRecord> {
    const client = this.getClient();

    const pharmPatch: Record<string, unknown> = {};
    if (input.name !== undefined) pharmPatch.name = input.name;
    if (input.phone !== undefined) pharmPatch.phone = input.phone;
    if (input.email !== undefined) pharmPatch.email = input.email;
    if (input.licenseNumber !== undefined) pharmPatch.license_number = input.licenseNumber;
    if (input.is24x7 !== undefined) pharmPatch.is_24x7 = input.is24x7;

    if (Object.keys(pharmPatch).length > 0) {
      const { error } = await client
        .from('pharmacies')
        .update(pharmPatch)
        .eq('id', pharmacyId);
      if (error) {
        if (error.code === '23505') {
          throw new AppError(409, 'CONFLICT', 'License number already registered to another pharmacy.');
        }
        throw new AppError(500, 'DATABASE_ERROR', `Failed to update pharmacy: ${error.message}`);
      }
    }

    if (input.location && Object.keys(input.location).length > 0) {
      const locPatch: Record<string, unknown> = {};
      if (input.location.address !== undefined) locPatch.address = input.location.address;
      if (input.location.area !== undefined) locPatch.area = input.location.area;
      if (input.location.city !== undefined) locPatch.city = input.location.city;
      if (input.location.state !== undefined) locPatch.state = input.location.state;
      if (input.location.pincode !== undefined) locPatch.pincode = input.location.pincode;
      if (input.location.lat !== undefined) locPatch.lat = input.location.lat;
      if (input.location.lng !== undefined) locPatch.lng = input.location.lng;

      const { error: locErr } = await client
        .from('pharmacy_locations')
        .update(locPatch)
        .eq('pharmacy_id', pharmacyId);
      if (locErr) {
        throw new AppError(500, 'DATABASE_ERROR', `Failed to update location: ${locErr.message}`);
      }
    }

    const { data, error } = await client
      .from('pharmacies')
      .select('*, pharmacy_locations(*)')
      .eq('id', pharmacyId)
      .single();

    if (error || !data) {
      throw new AppError(500, 'DATABASE_ERROR', 'Failed to reload updated pharmacy.');
    }
    return this.mapProfile(data as Record<string, unknown>);
  }

  async getOperatingHours(pharmacyId: string): Promise<OperatingHourEntry[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('pharmacy_operating_hours')
      .select('day_of_week, open_time, close_time, is_closed, timezone')
      .eq('pharmacy_id', pharmacyId)
      .order('day_of_week', { ascending: true });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load operating hours: ${error.message}`);
    }

    return (data || []).map((r: Record<string, unknown>) => ({
      dayOfWeek: Number(r.day_of_week),
      openTime: r.open_time ? String(r.open_time) : null,
      closeTime: r.close_time ? String(r.close_time) : null,
      isClosed: Boolean(r.is_closed),
      timezone: String(r.timezone || 'Asia/Kolkata'),
    }));
  }

  async upsertOperatingHours(
    pharmacyId: string,
    hours: OperatingHourEntry[]
  ): Promise<OperatingHourEntry[]> {
    const client = this.getClient();
    const rows = hours.map((h) => ({
      pharmacy_id: pharmacyId,
      day_of_week: h.dayOfWeek,
      open_time: h.isClosed ? null : h.openTime,
      close_time: h.isClosed ? null : h.closeTime,
      is_closed: h.isClosed,
      timezone: h.timezone || 'Asia/Kolkata',
    }));

    const { error } = await client
      .from('pharmacy_operating_hours')
      .upsert(rows, { onConflict: 'pharmacy_id,day_of_week' });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to update operating hours: ${error.message}`);
    }
    return this.getOperatingHours(pharmacyId);
  }

  async listAllInventory(pharmacyId: string): Promise<PrivateInventoryItemRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('pharmacy_inventory')
      .select(`
        id, pharmacy_id, medicine_id, batch_number, expiry_date,
        quantity_available, quantity_reserved, mrp, selling_price,
        unit_cost_price, reorder_threshold, updated_at,
        medicines!inner (
          display_name, generic_name, dosage_form, strength, pack_size,
          medicine_brands ( brand_name )
        )
      `)
      .eq('pharmacy_id', pharmacyId);

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load inventory: ${error.message}`);
    }

    return (data || []).map((row) => this.mapInventoryRow(row as Record<string, unknown>));
  }

  async getInventoryItem(
    pharmacyId: string,
    itemId: string
  ): Promise<PrivateInventoryItemRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('pharmacy_inventory')
      .select(`
        id, pharmacy_id, medicine_id, batch_number, expiry_date,
        quantity_available, quantity_reserved, mrp, selling_price,
        unit_cost_price, reorder_threshold, updated_at,
        medicines!inner (
          display_name, generic_name, dosage_form, strength, pack_size,
          medicine_brands ( brand_name )
        )
      `)
      .eq('id', itemId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load inventory item: ${error.message}`);
    }
    return data ? this.mapInventoryRow(data as Record<string, unknown>) : null;
  }

  async addInventoryItem(
    pharmacyId: string,
    userId: string,
    input: AddInventoryItemInput
  ): Promise<PrivateInventoryItemRecord> {
    const client = this.getClient();

    // Ensure medicine exists
    const { data: med } = await client
      .from('medicines')
      .select('id')
      .eq('id', input.medicineId)
      .maybeSingle();

    if (!med) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Medicine ${input.medicineId} does not exist.`);
    }

    const { data: created, error } = await client
      .from('pharmacy_inventory')
      .insert({
        pharmacy_id: pharmacyId,
        medicine_id: input.medicineId,
        batch_number: input.batchNumber,
        expiry_date: input.expiryDate,
        quantity_available: input.quantityAvailable,
        quantity_reserved: input.quantityReserved,
        mrp: input.mrp,
        selling_price: input.sellingPrice,
        unit_cost_price: input.unitCostPrice ?? null,
        reorder_threshold: input.reorderThreshold,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError(
          409,
          'CONFLICT',
          'An inventory record for this medicine and batch number already exists.'
        );
      }
      throw new AppError(500, 'DATABASE_ERROR', `Failed to add inventory item: ${error.message}`);
    }

    // Record initial stock in immutable audit history
    if (input.quantityAvailable > 0) {
      await client.from('inventory_audit_history').insert({
        inventory_id: created.id,
        pharmacy_id: pharmacyId,
        medicine_id: input.medicineId,
        delta_quantity: input.quantityAvailable,
        previous_quantity: 0,
        resulting_quantity: input.quantityAvailable,
        movement_type: 'ADD',
        reason: 'INITIAL_STOCK',
        actor_id: userId,
        notes: `Initial batch ${input.batchNumber}`,
      });
    }

    const loaded = await this.getInventoryItem(pharmacyId, created.id);
    if (!loaded) {
      throw new AppError(500, 'DATABASE_ERROR', 'Inventory item created but could not be reloaded.');
    }
    return loaded;
  }

  async updateInventoryItem(
    pharmacyId: string,
    itemId: string,
    input: UpdateInventoryItemInput
  ): Promise<PrivateInventoryItemRecord> {
    const client = this.getClient();
    const existing = await this.getInventoryItem(pharmacyId, itemId);
    if (!existing) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', `Inventory item ${itemId} not found.`);
    }

    const nextMrp = input.mrp ?? existing.mrp;
    const nextPrice = input.sellingPrice ?? existing.sellingPrice;
    if (nextPrice > nextMrp) {
      throw new AppError(400, 'VALIDATION_ERROR', 'sellingPrice cannot exceed MRP.');
    }

    const patch: Record<string, unknown> = {};
    if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
    if (input.mrp !== undefined) patch.mrp = input.mrp;
    if (input.sellingPrice !== undefined) patch.selling_price = input.sellingPrice;
    if (input.unitCostPrice !== undefined) patch.unit_cost_price = input.unitCostPrice;
    if (input.reorderThreshold !== undefined) patch.reorder_threshold = input.reorderThreshold;

    if (Object.keys(patch).length > 0) {
      const { error } = await client
        .from('pharmacy_inventory')
        .update(patch)
        .eq('id', itemId)
        .eq('pharmacy_id', pharmacyId);

      if (error) {
        throw new AppError(500, 'DATABASE_ERROR', `Failed to update inventory item: ${error.message}`);
      }
    }

    const updated = await this.getInventoryItem(pharmacyId, itemId);
    if (!updated) {
      throw new AppError(500, 'DATABASE_ERROR', 'Updated inventory item could not be reloaded.');
    }
    return updated;
  }

  async adjustInventoryAtomic(
    pharmacyId: string,
    itemId: string,
    userId: string,
    input: AdjustInventoryInput
  ): Promise<{
    inventoryId: string;
    previousQuantity: number;
    newQuantity: number;
    auditId: number;
  }> {
    const client = this.getClient();
    const { data, error } = await client.rpc('adjust_pharmacy_inventory_atomic', {
      p_pharmacy_id: pharmacyId,
      p_inventory_id: itemId,
      p_delta_quantity: input.deltaQuantity,
      p_reason: input.reason,
      p_movement_type: input.movementType,
      p_actor_id: userId,
      p_notes: input.notes ?? null,
    });

    if (error) {
      if (error.message.includes('INVENTORY_NOT_FOUND')) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', `Inventory item ${itemId} not found.`);
      }
      if (error.message.includes('INSUFFICIENT_STOCK')) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', error.message);
      }
      throw new AppError(500, 'DATABASE_ERROR', `Stock adjustment failed: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
    return {
      inventoryId: String(row.inventory_id),
      previousQuantity: Number(row.previous_quantity),
      newQuantity: Number(row.new_quantity),
      auditId: Number(row.audit_id),
    };
  }

  async getItemHistory(pharmacyId: string, itemId: string): Promise<InventoryMovementRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('inventory_audit_history')
      .select(`
        id, inventory_id, pharmacy_id, medicine_id, movement_type,
        delta_quantity, previous_quantity, resulting_quantity,
        reason, actor_id, notes, created_at
      `)
      .eq('pharmacy_id', pharmacyId)
      .eq('inventory_id', itemId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load item history: ${error.message}`);
    }

    return (data || []).map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      inventoryId: String(r.inventory_id),
      pharmacyId: String(r.pharmacy_id),
      medicineId: String(r.medicine_id),
      movementType: r.movement_type ? String(r.movement_type) : null,
      deltaQuantity: Number(r.delta_quantity),
      previousQuantity: r.previous_quantity !== null && r.previous_quantity !== undefined ? Number(r.previous_quantity) : null,
      resultingQuantity: Number(r.resulting_quantity),
      reason: String(r.reason),
      actorId: r.actor_id ? String(r.actor_id) : null,
      notes: r.notes ? String(r.notes) : null,
      createdAt: String(r.created_at),
    }));
  }

  async getRecentMovements(pharmacyId: string, limit: number): Promise<InventoryMovementRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('inventory_audit_history')
      .select(`
        id, inventory_id, pharmacy_id, medicine_id, movement_type,
        delta_quantity, previous_quantity, resulting_quantity,
        reason, actor_id, notes, created_at,
        medicines ( display_name )
      `)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load recent movements: ${error.message}`);
    }

    return (data || []).map((r: Record<string, unknown>) => {
      const med = r.medicines as Record<string, unknown> | null;
      return {
        id: Number(r.id),
        inventoryId: String(r.inventory_id),
        pharmacyId: String(r.pharmacy_id),
        medicineId: String(r.medicine_id),
        medicineName: med?.display_name ? String(med.display_name) : undefined,
        movementType: r.movement_type ? String(r.movement_type) : null,
        deltaQuantity: Number(r.delta_quantity),
        previousQuantity: r.previous_quantity !== null && r.previous_quantity !== undefined ? Number(r.previous_quantity) : null,
        resultingQuantity: Number(r.resulting_quantity),
        reason: String(r.reason),
        actorId: r.actor_id ? String(r.actor_id) : null,
        notes: r.notes ? String(r.notes) : null,
        createdAt: String(r.created_at),
      };
    });
  }
}
