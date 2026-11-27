import type { StockStatus, MedicineForm } from "./medicine.ts";

export type EffectiveInventoryStatus = StockStatus | "EXPIRED";

export type StockAdjustmentReason =
  | "INITIAL_STOCK"
  | "SALE"
  | "SALE_RETURN"
  | "STOCK_AUDIT"
  | "EXPIRY_DISPOSAL";

export type StockAdjustmentMode = "add" | "remove" | "correct";

export type PharmacyUserRole =
  | "pharmacy_staff"
  | "pharmacy_admin"
  | "network_admin";

export interface PharmacySession {
  accessToken: string;
  userId: string;
  email: string;
  displayName: string;
  role: PharmacyUserRole;
  pharmacyId: string;
  pharmacyName: string;
  isPreviewSession?: boolean;
}

export interface PharmacyInventoryItem {
  id: string;
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  brandName: string;
  strength: string;
  form: MedicineForm;
  packSize: string;
  batchNumber: string | null;
  expiryDate: string;
  quantityAvailable: number;
  quantityReserved: number;
  mrp: number;
  sellingPrice: number;
  reorderThreshold: number;
  status: StockStatus;
  updatedAt: string;
}

export interface StockMovementRecord {
  id: string;
  pharmacyId: string;
  medicineId: string;
  medicineName: string;
  movementType: "INWARD" | "OUTWARD" | "ADJUSTMENT" | "DISPOSAL";
  quantityChanged: number;
  previousQuantity: number;
  newQuantity: number;
  reason: StockAdjustmentReason;
  notes: string | null;
  actorName: string;
  createdAt: string;
}

export type PharmacyAlertType =
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "NEAR_EXPIRY"
  | "EXPIRED";

export interface PharmacyAlertItem {
  id: string;
  type: PharmacyAlertType;
  inventoryItemId: string;
  medicineId: string;
  medicineName: string;
  detail: string;
  createdAt: string;
}

export interface PharmacyDashboardData {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringCount: number;
  statusDistribution: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
    expired: number;
  };
  recentActivity: StockMovementRecord[];
  lowStockItems: PharmacyInventoryItem[];
  expiringItems: PharmacyInventoryItem[];
}

export interface PharmacyOperatingHours {
  is24x7: boolean;
  weekdays: string;
  saturday: string;
  sunday: string;
}

export interface PharmacyProfileData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  licenseNumber: string;
  verificationStatus: "VERIFIED" | "PENDING" | "SUSPENDED";
  operatingHours: PharmacyOperatingHours;
  updatedAt: string;
}
