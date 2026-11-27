import { getServiceSupabaseClient } from '../config/supabase.js';
import { AppError } from '../types/index.js';
import { TransferStatus } from '../services/collaborationStateMachine.js';

export interface EligibleStockCandidateRecord {
  inventoryItemId: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyIsActive: boolean;
  pharmacyIsVerified: boolean;
  area: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  medicineId: string;
  medicineName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  storageCondition: string;
  isPrescriptionRequired: boolean;
  expiryDate: string;
  quantityAvailable: number;
  sellingPrice: number;
  mrp: number;
  updatedAt: string;
}

export interface StockTransferRecord {
  id: string;
  transferCode: string;
  requestingPharmacyId: string;
  requestingPharmacyName: string;
  supplyingPharmacyId: string;
  supplyingPharmacyName: string;
  medicineId: string;
  medicineName: string;
  sourceInventoryItemId: string;
  requestedQuantity: number;
  approvedQuantity: number | null;
  status: TransferStatus;
  requestReason: string | null;
  rejectionReason: string | null;
  requestedByUserId: string;
  approvedByUserId: string | null;
  dispatchedAt: string | null;
  dispatchedByUserId: string | null;
  dispatchReference: string | null;
  receivedAt: string | null;
  receivedByUserId: string | null;
  receivedQuantity: number | null;
  hasDiscrepancy: boolean;
  discrepancyNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransferEventRecord {
  id: number;
  transferId: string;
  previousStatus: TransferStatus | null;
  newStatus: TransferStatus;
  actorUserId: string;
  eventType: string;
  notes: string | null;
  createdAt: string;
}

export interface ICollaborationRepository {
  findEligibleStockCandidates(params: {
    excludePharmacyId: string;
    medicineId?: string;
    q?: string;
    area?: string;
  }): Promise<EligibleStockCandidateRecord[]>;
  getSourceInventoryForTransfer(
    supplyingPharmacyId: string,
    medicineId: string,
    sourceInventoryItemId: string
  ): Promise<EligibleStockCandidateRecord | null>;
  createTransfer(params: {
    requestingPharmacyId: string;
    supplyingPharmacyId: string;
    medicineId: string;
    sourceInventoryItemId: string;
    requestedQuantity: number;
    requestReason?: string;
    requestedByUserId: string;
  }): Promise<StockTransferRecord>;
  listTransfersForPharmacy(pharmacyId: string): Promise<StockTransferRecord[]>;
  getTransferById(transferId: string): Promise<StockTransferRecord | null>;
  getTransferEvents(transferId: string): Promise<TransferEventRecord[]>;
  approveTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    approvedQuantity?: number;
    idempotencyKey?: string;
  }): Promise<{ transferId: string; status: TransferStatus; approvedQuantity: number }>;
  rejectTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    reason: string;
    idempotencyKey?: string;
  }): Promise<{ transferId: string; status: TransferStatus }>;
  dispatchTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    dispatchReference?: string;
    idempotencyKey?: string;
  }): Promise<{ transferId: string; status: TransferStatus; dispatchReference: string | null }>;
  receiveTransferAtomic(params: {
    transferId: string;
    requestingPharmacyId: string;
    actorId: string;
    receivedQuantity: number;
    discrepancyNotes?: string;
    idempotencyKey?: string;
  }): Promise<{
    transferId: string;
    status: TransferStatus;
    receivedQuantity: number;
    hasDiscrepancy: boolean;
  }>;
  cancelTransferAtomic(params: {
    transferId: string;
    actorPharmacyId: string;
    actorId: string;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<{ transferId: string; status: TransferStatus }>;
}

export class SupabaseCollaborationRepository implements ICollaborationRepository {
  private getClient() {
    const client = getServiceSupabaseClient();
    if (!client) {
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database connection is not configured.');
    }
    return client;
  }

  private mapTransferRow(r: Record<string, unknown>): StockTransferRecord {
    const reqPharm = r.requesting_pharmacy as Record<string, unknown> | null;
    const supPharm = r.supplying_pharmacy as Record<string, unknown> | null;
    const med = r.medicines as Record<string, unknown> | null;
    return {
      id: String(r.id),
      transferCode: String(r.transfer_code),
      requestingPharmacyId: String(r.requesting_pharmacy_id),
      requestingPharmacyName: String(reqPharm?.name ?? ''),
      supplyingPharmacyId: String(r.supplying_pharmacy_id),
      supplyingPharmacyName: String(supPharm?.name ?? ''),
      medicineId: String(r.medicine_id),
      medicineName: String(med?.display_name ?? ''),
      sourceInventoryItemId: String(r.source_inventory_item_id),
      requestedQuantity: Number(r.requested_quantity),
      approvedQuantity:
        r.approved_quantity !== null && r.approved_quantity !== undefined
          ? Number(r.approved_quantity)
          : null,
      status: r.status as TransferStatus,
      requestReason: r.request_reason ? String(r.request_reason) : null,
      rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
      requestedByUserId: String(r.requested_by_user_id),
      approvedByUserId: r.approved_by_user_id ? String(r.approved_by_user_id) : null,
      dispatchedAt: r.dispatched_at ? String(r.dispatched_at) : null,
      dispatchedByUserId: r.dispatched_by_user_id ? String(r.dispatched_by_user_id) : null,
      dispatchReference: r.dispatch_reference ? String(r.dispatch_reference) : null,
      receivedAt: r.received_at ? String(r.received_at) : null,
      receivedByUserId: r.received_by_user_id ? String(r.received_by_user_id) : null,
      receivedQuantity:
        r.received_quantity !== null && r.received_quantity !== undefined
          ? Number(r.received_quantity)
          : null,
      hasDiscrepancy: Boolean(r.has_discrepancy),
      discrepancyNotes: r.discrepancy_notes ? String(r.discrepancy_notes) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  private mapCandidateRow(row: Record<string, unknown>): EligibleStockCandidateRecord {
    const pharm = row.pharmacies as Record<string, unknown>;
    const rawLoc = pharm.pharmacy_locations;
    const loc = (Array.isArray(rawLoc) ? rawLoc[0] : rawLoc) as Record<string, unknown>;
    const med = row.medicines as Record<string, unknown>;

    return {
      inventoryItemId: String(row.id),
      pharmacyId: String(pharm.id),
      pharmacyName: String(pharm.name),
      pharmacyIsActive: Boolean(pharm.is_active),
      pharmacyIsVerified: Boolean(pharm.is_licensed_verified),
      area: String(loc?.area ?? ''),
      city: String(loc?.city ?? ''),
      state: String(loc?.state ?? ''),
      pincode: String(loc?.pincode ?? ''),
      lat: Number(loc?.lat ?? 0),
      lng: Number(loc?.lng ?? 0),
      medicineId: String(med.id),
      medicineName: String(med.display_name),
      genericName: String(med.generic_name),
      dosageForm: String(med.dosage_form),
      strength: String(med.strength),
      packSize: String(med.pack_size),
      storageCondition: String(med.storage_condition),
      isPrescriptionRequired: Boolean(med.is_prescription_required),
      expiryDate: String(row.expiry_date),
      quantityAvailable: Number(row.quantity_available),
      sellingPrice: Number(row.selling_price),
      mrp: Number(row.mrp),
      updatedAt: String(row.updated_at),
    };
  }

  async findEligibleStockCandidates(params: {
    excludePharmacyId: string;
    medicineId?: string;
    q?: string;
    area?: string;
  }): Promise<EligibleStockCandidateRecord[]> {
    const client = this.getClient();
    let query = client
      .from('pharmacy_inventory')
      .select(`
        id, expiry_date, quantity_available, selling_price, mrp, updated_at,
        pharmacies!inner (
          id, name, is_active, is_licensed_verified,
          pharmacy_locations!inner ( area, city, state, pincode, lat, lng )
        ),
        medicines!inner (
          id, display_name, generic_name, dosage_form, strength, pack_size,
          storage_condition, is_prescription_required
        )
      `)
      .neq('pharmacy_id', params.excludePharmacyId)
      .eq('pharmacies.is_active', true)
      .gt('quantity_available', 0);

    if (params.medicineId) {
      query = query.eq('medicine_id', params.medicineId);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to query collaboration stock: ${error.message}`);
    }

    let list = (data || []).map((r) => this.mapCandidateRow(r as Record<string, unknown>));

    if (params.q) {
      const ql = params.q.toLowerCase();
      list = list.filter(
        (c) =>
          c.medicineName.toLowerCase().includes(ql) ||
          c.genericName.toLowerCase().includes(ql)
      );
    }

    if (params.area) {
      const al = params.area.toLowerCase();
      list = list.filter((c) => c.area.toLowerCase().includes(al));
    }

    return list;
  }

  async getSourceInventoryForTransfer(
    supplyingPharmacyId: string,
    medicineId: string,
    sourceInventoryItemId: string
  ): Promise<EligibleStockCandidateRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('pharmacy_inventory')
      .select(`
        id, expiry_date, quantity_available, selling_price, mrp, updated_at,
        pharmacies!inner (
          id, name, is_active, is_licensed_verified,
          pharmacy_locations!inner ( area, city, state, pincode, lat, lng )
        ),
        medicines!inner (
          id, display_name, generic_name, dosage_form, strength, pack_size,
          storage_condition, is_prescription_required
        )
      `)
      .eq('id', sourceInventoryItemId)
      .eq('pharmacy_id', supplyingPharmacyId)
      .eq('medicine_id', medicineId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to inspect source inventory: ${error.message}`);
    }
    return data ? this.mapCandidateRow(data as Record<string, unknown>) : null;
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
    const client = this.getClient();
    const code = `TR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: created, error } = await client
      .from('stock_transfers')
      .insert({
        transfer_code: code,
        requesting_pharmacy_id: params.requestingPharmacyId,
        supplying_pharmacy_id: params.supplyingPharmacyId,
        medicine_id: params.medicineId,
        source_inventory_item_id: params.sourceInventoryItemId,
        requested_quantity: params.requestedQuantity,
        status: 'REQUESTED',
        request_reason: params.requestReason ?? null,
        requested_by_user_id: params.requestedByUserId,
      })
      .select('id')
      .single();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to create transfer: ${error.message}`);
    }

    await client.from('transfer_events').insert({
      transfer_id: created.id,
      previous_status: null,
      new_status: 'REQUESTED',
      actor_user_id: params.requestedByUserId,
      event_type: 'TRANSFER_REQUESTED',
      notes: params.requestReason ?? 'Stock transfer requested',
    });

    const loaded = await this.getTransferById(created.id);
    if (!loaded) throw new AppError(500, 'DATABASE_ERROR', 'Created transfer could not be loaded.');
    return loaded;
  }

  async listTransfersForPharmacy(pharmacyId: string): Promise<StockTransferRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('stock_transfers')
      .select(`
        *,
        requesting_pharmacy:pharmacies!stock_transfers_requesting_pharmacy_id_fkey(name),
        supplying_pharmacy:pharmacies!stock_transfers_supplying_pharmacy_id_fkey(name),
        medicines(display_name)
      `)
      .or(`requesting_pharmacy_id.eq.${pharmacyId},supplying_pharmacy_id.eq.${pharmacyId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to list transfers: ${error.message}`);
    }
    return (data || []).map((r) => this.mapTransferRow(r as Record<string, unknown>));
  }

  async getTransferById(transferId: string): Promise<StockTransferRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('stock_transfers')
      .select(`
        *,
        requesting_pharmacy:pharmacies!stock_transfers_requesting_pharmacy_id_fkey(name),
        supplying_pharmacy:pharmacies!stock_transfers_supplying_pharmacy_id_fkey(name),
        medicines(display_name)
      `)
      .eq('id', transferId)
      .maybeSingle();

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load transfer: ${error.message}`);
    }
    return data ? this.mapTransferRow(data as Record<string, unknown>) : null;
  }

  async getTransferEvents(transferId: string): Promise<TransferEventRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('transfer_events')
      .select('*')
      .eq('transfer_id', transferId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new AppError(500, 'DATABASE_ERROR', `Failed to load transfer events: ${error.message}`);
    }
    return (data || []).map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      transferId: String(r.transfer_id),
      previousStatus: r.previous_status ? (r.previous_status as TransferStatus) : null,
      newStatus: r.new_status as TransferStatus,
      actorUserId: String(r.actor_user_id),
      eventType: String(r.event_type),
      notes: r.notes ? String(r.notes) : null,
      createdAt: String(r.created_at),
    }));
  }

  private mapRpcError(message: string): never {
    if (message.includes('TRANSFER_NOT_FOUND')) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', message);
    }
    if (message.includes('FORBIDDEN')) {
      throw new AppError(403, 'FORBIDDEN', message);
    }
    if (message.includes('INVALID_STATE_TRANSITION')) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', message);
    }
    if (message.includes('INSUFFICIENT_STOCK')) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', message);
    }
    if (message.includes('VALIDATION_ERROR') || message.includes('INELIGIBLE_STOCK')) {
      throw new AppError(400, 'VALIDATION_ERROR', message);
    }
    throw new AppError(500, 'DATABASE_ERROR', message);
  }

  async approveTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    approvedQuantity?: number;
    idempotencyKey?: string;
  }) {
    const client = this.getClient();
    const { data, error } = await client.rpc('approve_stock_transfer_atomic', {
      p_transfer_id: params.transferId,
      p_supplying_pharmacy_id: params.supplyingPharmacyId,
      p_actor_id: params.actorId,
      p_approved_qty: params.approvedQuantity ?? null,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
    if (error) this.mapRpcError(error.message);
    return data as { transferId: string; status: TransferStatus; approvedQuantity: number };
  }

  async rejectTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    reason: string;
    idempotencyKey?: string;
  }) {
    const client = this.getClient();
    const { data, error } = await client.rpc('reject_stock_transfer_atomic', {
      p_transfer_id: params.transferId,
      p_supplying_pharmacy_id: params.supplyingPharmacyId,
      p_actor_id: params.actorId,
      p_reason: params.reason,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
    if (error) this.mapRpcError(error.message);
    return data as { transferId: string; status: TransferStatus };
  }

  async dispatchTransferAtomic(params: {
    transferId: string;
    supplyingPharmacyId: string;
    actorId: string;
    dispatchReference?: string;
    idempotencyKey?: string;
  }) {
    const client = this.getClient();
    const { data, error } = await client.rpc('dispatch_stock_transfer_atomic', {
      p_transfer_id: params.transferId,
      p_supplying_pharmacy_id: params.supplyingPharmacyId,
      p_actor_id: params.actorId,
      p_dispatch_ref: params.dispatchReference ?? null,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
    if (error) this.mapRpcError(error.message);
    return data as {
      transferId: string;
      status: TransferStatus;
      dispatchReference: string | null;
    };
  }

  async receiveTransferAtomic(params: {
    transferId: string;
    requestingPharmacyId: string;
    actorId: string;
    receivedQuantity: number;
    discrepancyNotes?: string;
    idempotencyKey?: string;
  }) {
    const client = this.getClient();
    const { data, error } = await client.rpc('receive_stock_transfer_atomic', {
      p_transfer_id: params.transferId,
      p_requesting_pharmacy_id: params.requestingPharmacyId,
      p_actor_id: params.actorId,
      p_received_qty: params.receivedQuantity,
      p_discrepancy_notes: params.discrepancyNotes ?? null,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
    if (error) this.mapRpcError(error.message);
    return data as {
      transferId: string;
      status: TransferStatus;
      receivedQuantity: number;
      hasDiscrepancy: boolean;
    };
  }

  async cancelTransferAtomic(params: {
    transferId: string;
    actorPharmacyId: string;
    actorId: string;
    reason?: string;
    idempotencyKey?: string;
  }) {
    const client = this.getClient();
    const { data, error } = await client.rpc('cancel_stock_transfer_atomic', {
      p_transfer_id: params.transferId,
      p_actor_pharmacy_id: params.actorPharmacyId,
      p_actor_id: params.actorId,
      p_reason: params.reason ?? null,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
    if (error) this.mapRpcError(error.message);
    return data as { transferId: string; status: TransferStatus };
  }
}
