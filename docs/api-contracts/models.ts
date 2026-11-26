/**
 * MediFind Connect — Canonical Shared Domain Contracts
 * Ownership: Person B (Backend Architect)
 * Consumer: Person A (Frontend Lead)
 *
 * Conventions:
 * - All IDs are UUID v4 strings unless noted.
 * - All timestamps are ISO-8601 UTC strings (e.g., "2026-11-26T17:00:00.000Z").
 * - All monetary values are in INR (Indian Rupees), numeric with 2 decimal precision.
 * - All distances are in kilometers (km).
 */

// ============================================================================
// 1. COMMON ENVELOPES & PAGINATION
// ============================================================================

export interface ApiSuccessEnvelope<T> {
  success: true;
  status?: 'ok' | 'ready' | 'degraded';
  message?: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'RESOURCE_NOT_FOUND'
      | 'CONFLICT'
      | 'INSUFFICIENT_STOCK'
      | 'INVALID_STATE_TRANSITION'
      | 'INTERNAL_SERVER_ERROR';
    message: string;
    details?: ApiErrorDetail[];
  };
  timestamp: string;
}

export interface PaginationMeta {
  page: number; // 1-based index
  limit: number; // Max 100
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ============================================================================
// 2. MEDICINE CATALOG MODELS
// ============================================================================

export type MedicineForm =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Injection'
  | 'Ointment'
  | 'Inhaler'
  | 'Drops'
  | 'Other';

export type StorageCondition =
  | 'Ambient'
  | 'Refrigerated (2-8C)'
  | 'Cold Storage'
  | 'Controlled Substance';

export interface MedicineBrand {
  id: string; // UUID
  brandName: string;
  manufacturer: string;
}

export interface Medicine {
  id: string; // UUID
  name: string; // Alias of displayName for frontend compatibility
  displayName: string;
  genericName: string;
  primaryBrand: string | null;
  brands: MedicineBrand[];
  therapeuticClass: string | null;
  form: MedicineForm; // Alias of dosageForm for frontend compatibility
  dosageForm: MedicineForm;
  strength: string; // e.g., "500 mg"
  packSize: string; // e.g., "Strip of 10 Tablets"
  isPrescriptionRequired: boolean;
  storageCondition: StorageCondition;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
}

// ============================================================================
// 3. PHARMACY & LOCATION MODELS
// ============================================================================

export type PharmacyTier = 'standard' | 'hub' | 'hospital_attached';

export interface PharmacyLocation {
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string; // 6-digit Indian postal code
  lat: number; // Latitude (-90 to 90)
  lng: number; // Longitude (-180 to 180)
  distanceKm?: number; // Computed dynamically during geo-queries
}

/**
 * Public-safe pharmacy profile returned by discovery and search endpoints.
 * Intentionally excludes sensitive regulatory fields (e.g., licenseNumber) and internal email.
 */
export interface PublicPharmacy {
  id: string; // UUID
  name: string;
  location: PharmacyLocation;
  phone: string;
  isActive: boolean;
  is24x7: boolean;
  tier: PharmacyTier;
  updatedAt: string;
}

/**
 * Sensitive internal pharmacy profile restricted to authorized staff of that pharmacy
 * and network administrators. Never expose via public consumer endpoints.
 */
export interface InternalPharmacy extends PublicPharmacy {
  licenseNumber: string; // Drugs & Cosmetics Act license ID — CONFIDENTIAL
  email: string | null;
  createdAt: string;
}

/**
 * @deprecated Use PublicPharmacy or InternalPharmacy explicitly to prevent accidental data exposure.
 */
export type Pharmacy = InternalPharmacy;

// ============================================================================
// 4. INVENTORY & AVAILABILITY MODELS
// ============================================================================

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

/**
 * Private pharmacy inventory record.
 * Restricted exclusively to authorized pharmacy staff of that pharmacy.
 */
export interface InventoryItem {
  id: string; // UUID
  pharmacyId: string;
  medicineId: string;
  medicineName?: string;
  batchNumber: string | null;
  expiryDate: string; // YYYY-MM-DD
  quantityAvailable: number; // Non-negative integer (>= 0)
  quantityReserved: number; // Non-negative integer (>= 0)
  mrp: number; // Maximum Retail Price in INR
  sellingPrice: number; // Customer price in INR
  unitCostPrice?: number; // CONFIDENTIAL: Never exposed to consumers or rival pharmacies
  reorderThreshold: number;
  status: StockStatus;
  updatedAt: string;
}

/**
 * Public-safe projection of stock availability for patients and discovery.
 */
export interface MedicineAvailability {
  pharmacyId: string;
  pharmacyName: string;
  area: string;
  distanceKm: number | null;
  is24x7: boolean;
  status: StockStatus;
  sellingPrice: number; // INR
  mrp: number; // INR
  isApproximateStockHigh: boolean; // Avoids exposing exact internal batch counts if needed
  lastUpdatedAt: string;
}

// ============================================================================
// 5. COLLABORATIVE STOCK TRANSFER MODELS
// ============================================================================

export type TransferStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'CANCELLED';

export type TransferActorRole =
  | 'requesting_pharmacy'
  | 'fulfilling_pharmacy'
  | 'network_admin';

/**
 * Canonical finite state machine for inter-pharmacy stock transfers.
 * Terminal states (REJECTED, RECEIVED, CANCELLED) allow NO further transitions.
 */
export const PERMITTED_TRANSFER_TRANSITIONS: Record<
  TransferStatus,
  ReadonlyArray<{
    nextStatus: TransferStatus;
    allowedActors: ReadonlyArray<TransferActorRole>;
    stockEffect: string;
  }>
> = {
  REQUESTED: [
    {
      nextStatus: 'APPROVED',
      allowedActors: ['fulfilling_pharmacy'],
      stockEffect: 'Moves quantityApproved from quantityAvailable to quantityReserved at fulfilling pharmacy.',
    },
    {
      nextStatus: 'REJECTED',
      allowedActors: ['fulfilling_pharmacy'],
      stockEffect: 'None (Terminal state).',
    },
    {
      nextStatus: 'CANCELLED',
      allowedActors: ['requesting_pharmacy', 'network_admin'],
      stockEffect: 'None; request withdrawn before approval (Terminal state).',
    },
  ],
  APPROVED: [
    {
      nextStatus: 'DISPATCHED',
      allowedActors: ['fulfilling_pharmacy'],
      stockEffect: 'Deducts quantityApproved from quantityReserved at fulfilling pharmacy.',
    },
    {
      nextStatus: 'CANCELLED',
      allowedActors: ['requesting_pharmacy', 'fulfilling_pharmacy', 'network_admin'],
      stockEffect: 'Releases quantityApproved from quantityReserved back to quantityAvailable at fulfilling pharmacy (Terminal state).',
    },
  ],
  DISPATCHED: [
    {
      nextStatus: 'RECEIVED',
      allowedActors: ['requesting_pharmacy'],
      stockEffect: 'Credits quantityApproved to quantityAvailable at requesting pharmacy (Terminal state).',
    },
    {
      nextStatus: 'CANCELLED',
      allowedActors: ['fulfilling_pharmacy', 'network_admin'],
      stockEffect: 'In-transit cancellation (damaged/recalled); requires mandatory audit reason and manual stock reconciliation (Terminal state).',
    },
  ],
  REJECTED: [],
  RECEIVED: [],
  CANCELLED: [],
};

export interface TransferRequest {
  id: string; // UUID
  transferCode: string; // Human-readable, e.g., "TR-2026-9481"
  requestingPharmacyId: string;
  requestingPharmacyName: string;
  fulfillingPharmacyId: string;
  fulfillingPharmacyName: string;
  medicineId: string;
  medicineName: string;
  quantityRequested: number; // Integer > 0
  quantityApproved: number | null; // Integer >= 0
  status: TransferStatus;
  unitTransferPrice: number; // INR
  totalTransferValue: number; // INR
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransferHistoryEntry {
  id: number;
  transferId: string;
  previousStatus: TransferStatus | null;
  newStatus: TransferStatus;
  actorId: string | null;
  comment: string | null;
  createdAt: string;
}

// ============================================================================
// 6. DEMAND & AI INTELLIGENCE MODELS
// ============================================================================

export type SeverityLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';

/**
 * Privacy-preserving regional demand summary.
 * Contains ZERO patient PII.
 */
export interface DemandSignal {
  area: string;
  medicineId: string;
  medicineName: string;
  searchVolume: number;
  unmetDemandCount: number;
  currentLocalStock: number;
  supplyDemandRatio: number; // >= 0
  windowStart: string;
  windowEnd: string;
}

export interface ShortageEvidence {
  daysOfInventoryRemaining: number | null;
  searchSpikePercent: number; // e.g., 140 means +140%
  nearbyStockCount: number;
  sampleSize: number;
}

export interface ShortageSignal {
  id: string;
  medicineId: string;
  medicineName: string;
  area: string;
  riskScore: number; // 0.0 to 1.0
  severity: SeverityLevel;
  confidence: number; // 0.0 to 1.0
  uncertaintyNote: string | null; // e.g., "Low Data Confidence" when sampleSize is small
  evidence: ShortageEvidence;
  generatedAt: string;
}

export type RestockUrgency = 'ROUTINE' | 'ELEVATED' | 'CRITICAL';

export interface RestockRecommendation {
  id: string;
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  recommendedReorderQuantity: number; // Integer > 0
  currentStock: number;
  safetyStockLevel: number;
  estimatedLeadDays: number;
  urgencyLevel: RestockUrgency;
  rationale: string; // Human-readable explanation
  isAcknowledged: boolean;
  generatedAt: string;
}
