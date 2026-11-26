import type { AvailabilityStatus } from "@/components/ui/Badge";

export interface SampleInventoryRow {
  id: string;
  medicineName: string;
  brand: string;
  quantity: number;
  priceInr: number;
  availability: AvailabilityStatus;
  lastUpdated: string;
}

/**
 * Isolated sample inventory rows for Pharmacy Portal UI layout preview only.
 */
export const SAMPLE_INVENTORY_ROWS: SampleInventoryRow[] = [
  {
    id: "inv-1",
    medicineName: "Paracetamol 650 mg",
    brand: "Dolo 650",
    quantity: 48,
    priceInr: 30,
    availability: "in_stock",
    lastUpdated: "Sample • Today, 10:15 AM",
  },
  {
    id: "inv-2",
    medicineName: "Amoxicillin + Clavulanic Acid 625 mg",
    brand: "Augmentin 625 Duo",
    quantity: 4,
    priceInr: 195,
    availability: "low_stock",
    lastUpdated: "Sample • Today, 09:40 AM",
  },
  {
    id: "inv-3",
    medicineName: "Pantoprazole + Domperidone",
    brand: "Pan-D",
    quantity: 26,
    priceInr: 198,
    availability: "in_stock",
    lastUpdated: "Sample • Yesterday",
  },
  {
    id: "inv-4",
    medicineName: "Azithromycin 500 mg",
    brand: "Azithral 500",
    quantity: 0,
    priceInr: 120,
    availability: "out_of_stock",
    lastUpdated: "Sample • 2 days ago",
  },
];

export const SAMPLE_RECENT_ACTIVITY = [
  {
    id: "act-1",
    action: "Stock threshold alert triggered",
    detail: "Augmentin 625 Duo fell below 5 strips (Sample)",
    time: "Sample entry",
  },
  {
    id: "act-2",
    action: "Inventory count updated",
    detail: "Dolo 650 adjusted to 48 strips (Sample)",
    time: "Sample entry",
  },
  {
    id: "act-3",
    action: "Out-of-stock flag recorded",
    detail: "Azithral 500 marked unavailable (Sample)",
    time: "Sample entry",
  },
];
