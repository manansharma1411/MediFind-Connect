/**
 * Canonical Domain Types for Patient Medicine Discovery.
 * Aligned with docs/api-contracts/models.ts and openapi.yaml.
 */

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type MedicineForm =
  | "Tablet"
  | "Capsule"
  | "Syrup"
  | "Injection"
  | "Ointment"
  | "Inhaler"
  | "Drops"
  | "Other";

export type StorageCondition =
  | "Ambient"
  | "Refrigerated (2-8C)"
  | "Cold Storage"
  | "Controlled Substance";

export interface MedicineBrand {
  id: string;
  brandName: string;
  manufacturer: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  primaryBrand: string | null;
  brands: MedicineBrand[];
  therapeuticClass: string | null;
  form: MedicineForm;
  strength: string;
  packSize: string;
  isPrescriptionRequired: boolean;
  storageCondition: StorageCondition;
  createdAt: string;
  updatedAt: string;
}

export type PharmacyTier = "standard" | "hub" | "hospital_attached";

export interface PharmacyLocation {
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface PublicPharmacy {
  id: string;
  name: string;
  location: PharmacyLocation;
  phone: string;
  isActive: boolean;
  is24x7: boolean;
  operatingHoursLabel?: string | null;
  isOpenNow?: boolean | null;
  tier: PharmacyTier;
  updatedAt: string;
}

export interface MedicineAvailability {
  pharmacyId: string;
  pharmacyName: string;
  area: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  distanceKm: number | null;
  is24x7: boolean;
  isOpenNow?: boolean | null;
  operatingHoursLabel?: string | null;
  status: StockStatus;
  sellingPrice: number;
  mrp: number;
  isApproximateStockHigh: boolean;
  lastUpdatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface MedicineSearchResult {
  items: Medicine[];
  pagination: PaginationMeta;
  didYouMean: string | null;
  suggestions: string[];
  source: "live" | "demo";
  notice?: string;
}

export interface AvailabilityFilters {
  availableNow: boolean;
  openNow: boolean;
  maxDistanceKm: number | null;
  sortBy: "distance" | "price" | "availability";
}

export interface UserLocationState {
  status: "idle" | "requesting" | "granted" | "denied" | "unavailable";
  coords: { lat: number; lng: number } | null;
  label: string;
  source: "gps" | "manual" | "none";
  errorMessage?: string;
}
