import type { AvailabilityStatus } from "@/components/ui/Badge";

export interface SampleMedicine {
  id: string;
  brandName: string;
  genericName: string;
  strength: string;
  form: string;
  category: string;
  manufacturer: string;
  prescriptionRequired: boolean;
  priceRangeInr: { min: number; max: number };
  samplePharmacyCount: number;
  nearestDistanceKm: number;
  availability: AvailabilityStatus;
  dosageNote: string;
}

/**
 * Isolated sample data for UI layout preview only.
 * Not connected to live pharmacy stock.
 */
export const SAMPLE_MEDICINES: SampleMedicine[] = [
  {
    id: "sample-med-1",
    brandName: "Dolo 650",
    genericName: "Paracetamol",
    strength: "650 mg",
    form: "Tablet (Strip of 15)",
    category: "Analgesic & Antipyretic",
    manufacturer: "Micro Labs Ltd.",
    prescriptionRequired: false,
    priceRangeInr: { min: 28, max: 34 },
    samplePharmacyCount: 4,
    nearestDistanceKm: 1.1,
    availability: "in_stock",
    dosageNote: "Commonly stocked OTC fever and pain relief tablet.",
  },
  {
    id: "sample-med-2",
    brandName: "Augmentin 625 Duo",
    genericName: "Amoxicillin + Clavulanic Acid",
    strength: "500 mg + 125 mg",
    form: "Tablet (Strip of 10)",
    category: "Antibiotic",
    manufacturer: "GlaxoSmithKline",
    prescriptionRequired: true,
    priceRangeInr: { min: 185, max: 205 },
    samplePharmacyCount: 2,
    nearestDistanceKm: 1.8,
    availability: "low_stock",
    dosageNote: "Requires a valid registered medical practitioner prescription.",
  },
  {
    id: "sample-med-3",
    brandName: "Pan-D",
    genericName: "Pantoprazole + Domperidone",
    strength: "40 mg + 30 mg",
    form: "Capsule SR (Strip of 15)",
    category: "Gastrointestinal",
    manufacturer: "Alkem Laboratories",
    prescriptionRequired: true,
    priceRangeInr: { min: 190, max: 210 },
    samplePharmacyCount: 3,
    nearestDistanceKm: 2.4,
    availability: "in_stock",
    dosageNote: "Sustained-release capsule; verify prescription at counter.",
  },
  {
    id: "sample-med-4",
    brandName: "Azithral 500",
    genericName: "Azithromycin",
    strength: "500 mg",
    form: "Tablet (Strip of 5)",
    category: "Antibiotic",
    manufacturer: "Alembic Pharmaceuticals",
    prescriptionRequired: true,
    priceRangeInr: { min: 115, max: 132 },
    samplePharmacyCount: 0,
    nearestDistanceKm: 4.2,
    availability: "out_of_stock",
    dosageNote: "Currently unavailable in sample radius; transfer check pending.",
  },
];
