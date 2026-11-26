import type {
  Medicine,
  MedicineAvailability,
  PublicPharmacy,
} from "../types/medicine.ts";
import { calculateDistanceKm } from "../lib/medicineUtils.ts";

/**
 * Isolated Demo Data for Patient Medicine Discovery UI.
 * Used ONLY when Person B's planned /api/v1/medicines* and /api/v1/pharmacies*
 * endpoints are not yet operational. Never mixed with live backend results.
 */

export const DEMO_MANUAL_AREAS = [
  { id: "area-mp-nagar", label: "MP Nagar Zone-I, Bhopal", lat: 23.2323, lng: 77.4332 },
  { id: "area-arera", label: "Arera Colony, Bhopal", lat: 23.2086, lng: 77.4348 },
  { id: "area-new-market", label: "New Market (TT Nagar), Bhopal", lat: 23.2369, lng: 77.4011 },
  { id: "area-indrapuri", label: "Indrapuri BHEL, Bhopal", lat: 23.2514, lng: 77.4665 },
];

export const DEMO_PHARMACIES: PublicPharmacy[] = [
  {
    id: "demo-pharm-1",
    name: "CarePlus Community Pharmacy (Demo)",
    location: {
      address: "Plot 14, Zone-I, Maharana Pratap Nagar",
      area: "MP Nagar Zone-I",
      city: "Bhopal",
      state: "Madhya Pradesh",
      pincode: "462011",
      lat: 23.2323,
      lng: 77.4332,
    },
    phone: "+91 755 000 0101",
    isActive: true,
    is24x7: true,
    operatingHoursLabel: "Open 24 Hours",
    isOpenNow: true,
    tier: "hub",
    updatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-pharm-2",
    name: "GreenCross Medicos (Demo)",
    location: {
      address: "E-4/22, Bittan Market Road",
      area: "Arera Colony",
      city: "Bhopal",
      state: "Madhya Pradesh",
      pincode: "462016",
      lat: 23.2086,
      lng: 77.4348,
    },
    phone: "+91 755 000 0102",
    isActive: true,
    is24x7: false,
    operatingHoursLabel: "08:00 AM – 11:00 PM",
    isOpenNow: true,
    tier: "standard",
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-pharm-3",
    name: "CityMed Wellness Store (Demo)",
    location: {
      address: "Shop 8, TT Nagar Main Road",
      area: "New Market",
      city: "Bhopal",
      state: "Madhya Pradesh",
      pincode: "462003",
      lat: 23.2369,
      lng: 77.4011,
    },
    phone: "+91 755 000 0103",
    isActive: true,
    is24x7: false,
    operatingHoursLabel: "09:00 AM – 10:00 PM",
    isOpenNow: false,
    tier: "standard",
    updatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEMO_MEDICINES: Medicine[] = [
  {
    id: "demo-med-1",
    name: "Paracetamol 650 mg",
    genericName: "Paracetamol",
    primaryBrand: "Dolo 650",
    brands: [
      { id: "b-1", brandName: "Dolo 650", manufacturer: "Micro Labs Ltd." },
      { id: "b-2", brandName: "Calpol 650", manufacturer: "GlaxoSmithKline" },
    ],
    therapeuticClass: "Analgesic & Antipyretic",
    form: "Tablet",
    strength: "650 mg",
    packSize: "Strip of 15 Tablets",
    isPrescriptionRequired: false,
    storageCondition: "Ambient",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-26T10:00:00.000Z",
  },
  {
    id: "demo-med-2",
    name: "Amoxicillin + Clavulanic Acid 625 mg",
    genericName: "Amoxicillin + Clavulanic Acid",
    primaryBrand: "Augmentin 625 Duo",
    brands: [
      { id: "b-3", brandName: "Augmentin 625 Duo", manufacturer: "GlaxoSmithKline" },
      { id: "b-4", brandName: "Moxikind-CV 625", manufacturer: "Mankind Pharma" },
    ],
    therapeuticClass: "Antibiotic",
    form: "Tablet",
    strength: "500 mg + 125 mg",
    packSize: "Strip of 10 Tablets",
    isPrescriptionRequired: true,
    storageCondition: "Ambient",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-26T09:00:00.000Z",
  },
  {
    id: "demo-med-3",
    name: "Pantoprazole + Domperidone SR",
    genericName: "Pantoprazole + Domperidone",
    primaryBrand: "Pan-D",
    brands: [
      { id: "b-5", brandName: "Pan-D", manufacturer: "Alkem Laboratories" },
      { id: "b-6", brandName: "Pantocid-D SR", manufacturer: "Sun Pharma" },
    ],
    therapeuticClass: "Gastrointestinal",
    form: "Capsule",
    strength: "40 mg + 30 mg",
    packSize: "Strip of 15 Capsules",
    isPrescriptionRequired: true,
    storageCondition: "Ambient",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-25T16:00:00.000Z",
  },
  {
    id: "demo-med-4",
    name: "Azithromycin 500 mg",
    genericName: "Azithromycin",
    primaryBrand: "Azithral 500",
    brands: [
      { id: "b-7", brandName: "Azithral 500", manufacturer: "Alembic Pharmaceuticals" },
      { id: "b-8", brandName: "Azee 500", manufacturer: "Cipla Ltd." },
    ],
    therapeuticClass: "Antibiotic",
    form: "Tablet",
    strength: "500 mg",
    packSize: "Strip of 5 Tablets",
    isPrescriptionRequired: true,
    storageCondition: "Ambient",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-24T12:00:00.000Z",
  },
];

const DEMO_AVAILABILITY_MATRIX: Record<
  string,
  Array<{
    pharmacyId: string;
    status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
    sellingPrice: number;
    mrp: number;
    isApproximateStockHigh: boolean;
    lastUpdatedAt: string;
  }>
> = {
  "demo-med-1": [
    {
      pharmacyId: "demo-pharm-1",
      status: "IN_STOCK",
      sellingPrice: 29.0,
      mrp: 33.76,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      pharmacyId: "demo-pharm-2",
      status: "IN_STOCK",
      sellingPrice: 31.5,
      mrp: 33.76,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    {
      pharmacyId: "demo-pharm-3",
      status: "LOW_STOCK",
      sellingPrice: 33.0,
      mrp: 33.76,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
    },
  ],
  "demo-med-2": [
    {
      pharmacyId: "demo-pharm-1",
      status: "LOW_STOCK",
      sellingPrice: 188.0,
      mrp: 204.65,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
      pharmacyId: "demo-pharm-2",
      status: "IN_STOCK",
      sellingPrice: 192.0,
      mrp: 204.65,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    },
  ],
  "demo-med-3": [
    {
      pharmacyId: "demo-pharm-1",
      status: "IN_STOCK",
      sellingPrice: 194.0,
      mrp: 210.0,
      isApproximateStockHigh: true,
      lastUpdatedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    },
    {
      pharmacyId: "demo-pharm-3",
      status: "OUT_OF_STOCK",
      sellingPrice: 205.0,
      mrp: 210.0,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    },
  ],
  "demo-med-4": [
    {
      pharmacyId: "demo-pharm-1",
      status: "OUT_OF_STOCK",
      sellingPrice: 118.0,
      mrp: 131.93,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      pharmacyId: "demo-pharm-2",
      status: "LOW_STOCK",
      sellingPrice: 122.0,
      mrp: 131.93,
      isApproximateStockHigh: false,
      lastUpdatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

export function getDemoAvailabilityForMedicine(
  medicineId: string,
  userCoords?: { lat: number; lng: number } | null
): MedicineAvailability[] {
  const rows = DEMO_AVAILABILITY_MATRIX[medicineId] ?? [];
  return rows.map((row) => {
    const pharm = DEMO_PHARMACIES.find((p) => p.id === row.pharmacyId);
    const distanceKm =
      userCoords && pharm
        ? calculateDistanceKm(
            userCoords.lat,
            userCoords.lng,
            pharm.location.lat,
            pharm.location.lng
          )
        : null;

    return {
      pharmacyId: row.pharmacyId,
      pharmacyName: pharm?.name ?? "Demo Pharmacy",
      area: pharm?.location.area ?? "Bhopal",
      address: pharm?.location.address,
      lat: pharm?.location.lat ?? null,
      lng: pharm?.location.lng ?? null,
      distanceKm,
      is24x7: pharm?.is24x7 ?? false,
      isOpenNow: pharm?.isOpenNow ?? null,
      operatingHoursLabel: pharm?.operatingHoursLabel ?? null,
      status: row.status,
      sellingPrice: row.sellingPrice,
      mrp: row.mrp,
      isApproximateStockHigh: row.isApproximateStockHigh,
      lastUpdatedAt: row.lastUpdatedAt,
    };
  });
}
