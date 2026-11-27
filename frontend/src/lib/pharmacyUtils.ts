import type {
  EffectiveInventoryStatus,
  PharmacyInventoryItem,
  StockAdjustmentMode,
} from "../types/pharmacy.ts";

/**
 * Returns true if expiryDate (YYYY-MM-DD) is strictly before today (UTC date).
 */
export function isMedicineExpired(
  expiryDate: string,
  nowMs = Date.now()
): boolean {
  const parsed = Date.parse(expiryDate);
  if (Number.isNaN(parsed)) return false;
  const today = new Date(nowMs);
  const todayStartUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return parsed < todayStartUtc;
}

/**
 * Returns true if expiryDate is not yet expired and falls within `days` from now.
 */
export function isNearExpiry(
  expiryDate: string,
  days = 30,
  nowMs = Date.now()
): boolean {
  if (isMedicineExpired(expiryDate, nowMs)) return false;
  const parsed = Date.parse(expiryDate);
  if (Number.isNaN(parsed)) return false;
  const diffDays = (parsed - nowMs) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

/**
 * Computes effective display status.
 * Expired stock is NEVER classified as IN_STOCK / available for sale.
 */
export function getEffectiveInventoryStatus(
  item: Pick<
    PharmacyInventoryItem,
    "quantityAvailable" | "reorderThreshold" | "expiryDate"
  >,
  nowMs = Date.now()
): EffectiveInventoryStatus {
  if (isMedicineExpired(item.expiryDate, nowMs)) {
    return "EXPIRED";
  }
  if (item.quantityAvailable <= 0) {
    return "OUT_OF_STOCK";
  }
  if (item.quantityAvailable <= item.reorderThreshold) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}

export interface InventoryFilterOptions {
  query: string;
  statusFilter: "all" | EffectiveInventoryStatus;
  expiryFilter: "all" | "near_expiry" | "expired";
  sortBy: "name" | "quantity" | "expiry" | "price";
}

export function filterAndSortInventory(
  items: PharmacyInventoryItem[],
  options: InventoryFilterOptions,
  nowMs = Date.now()
): PharmacyInventoryItem[] {
  const q = options.query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    const matchesQuery =
      !q ||
      item.medicineName.toLowerCase().includes(q) ||
      item.brandName.toLowerCase().includes(q) ||
      (item.batchNumber?.toLowerCase().includes(q) ?? false);

    if (!matchesQuery) return false;

    const effective = getEffectiveInventoryStatus(item, nowMs);
    if (options.statusFilter !== "all" && effective !== options.statusFilter) {
      return false;
    }

    if (options.expiryFilter === "expired" && !isMedicineExpired(item.expiryDate, nowMs)) {
      return false;
    }

    if (options.expiryFilter === "near_expiry" && !isNearExpiry(item.expiryDate, 30, nowMs)) {
      return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    if (options.sortBy === "quantity") {
      return a.quantityAvailable - b.quantityAvailable;
    }
    if (options.sortBy === "price") {
      return a.sellingPrice - b.sellingPrice;
    }
    if (options.sortBy === "expiry") {
      return Date.parse(a.expiryDate) - Date.parse(b.expiryDate);
    }
    return a.medicineName.localeCompare(b.medicineName);
  });
}

export interface AddMedicineFormInput {
  medicineId: string;
  batchNumber: string;
  quantity: string;
  sellingPrice: string;
  expiryDate: string;
  reorderThreshold: string;
}

export type AddMedicineFormErrors = Partial<
  Record<keyof AddMedicineFormInput, string>
>;

export function validateAddMedicineForm(
  input: AddMedicineFormInput,
  nowMs = Date.now()
): AddMedicineFormErrors {
  const errors: AddMedicineFormErrors = {};

  if (!input.medicineId.trim()) {
    errors.medicineId = "Please select a medicine from the catalogue.";
  }

  const qty = Number(input.quantity);
  if (!input.quantity.trim() || !Number.isInteger(qty) || qty <= 0) {
    errors.quantity = "Quantity must be a positive whole number.";
  }

  const price = Number(input.sellingPrice);
  if (!input.sellingPrice.trim() || Number.isNaN(price) || price <= 0) {
    errors.sellingPrice = "Selling price must be greater than 0.";
  }

  const threshold = Number(input.reorderThreshold);
  if (
    input.reorderThreshold.trim() === "" ||
    !Number.isInteger(threshold) ||
    threshold < 0
  ) {
    errors.reorderThreshold =
      "Minimum stock threshold must be 0 or a positive integer.";
  }

  if (!input.expiryDate.trim()) {
    errors.expiryDate = "Expiry date is required.";
  } else if (Number.isNaN(Date.parse(input.expiryDate))) {
    errors.expiryDate = "Please enter a valid expiry date.";
  } else if (isMedicineExpired(input.expiryDate, nowMs)) {
    errors.expiryDate = "Cannot add already expired stock for sale.";
  }

  return errors;
}

export interface StockAdjustmentPreview {
  deltaQuantity: number;
  resultingQuantity: number;
  isValid: boolean;
  error?: string;
}

export function computeStockAdjustmentPreview(
  currentQuantity: number,
  mode: StockAdjustmentMode,
  rawAmount: string
): StockAdjustmentPreview {
  const parsed = Number(rawAmount);
  if (rawAmount.trim() === "" || !Number.isInteger(parsed) || parsed < 0) {
    return {
      deltaQuantity: 0,
      resultingQuantity: currentQuantity,
      isValid: false,
      error: "Enter a valid non-negative whole number.",
    };
  }

  if (mode === "add") {
    if (parsed === 0) {
      return {
        deltaQuantity: 0,
        resultingQuantity: currentQuantity,
        isValid: false,
        error: "Quantity to add must be at least 1.",
      };
    }
    return {
      deltaQuantity: parsed,
      resultingQuantity: currentQuantity + parsed,
      isValid: true,
    };
  }

  if (mode === "remove") {
    if (parsed === 0) {
      return {
        deltaQuantity: 0,
        resultingQuantity: currentQuantity,
        isValid: false,
        error: "Quantity to remove must be at least 1.",
      };
    }
    const resulting = currentQuantity - parsed;
    if (resulting < 0) {
      return {
        deltaQuantity: -parsed,
        resultingQuantity: resulting,
        isValid: false,
        error: "Resulting stock cannot be negative.",
      };
    }
    return {
      deltaQuantity: -parsed,
      resultingQuantity: resulting,
      isValid: true,
    };
  }

  // mode === "correct" (sets exact target quantity)
  const delta = parsed - currentQuantity;
  if (delta === 0) {
    return {
      deltaQuantity: 0,
      resultingQuantity: currentQuantity,
      isValid: false,
      error: "Corrected quantity matches current stock.",
    };
  }
  return {
    deltaQuantity: delta,
    resultingQuantity: parsed,
    isValid: true,
  };
}
