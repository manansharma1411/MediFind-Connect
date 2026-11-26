import type { TransferStatus } from "@/components/ui/Badge";

export interface SampleTransferRequest {
  id: string;
  direction: "incoming" | "outgoing";
  medicineName: string;
  brand: string;
  quantity: number;
  partnerPharmacy: string;
  partnerArea: string;
  distanceKm: number;
  status: TransferStatus;
  requestedAt: string;
  notes: string;
}

/**
 * Isolated sample collaboration transfer records for UI layout preview only.
 */
export const SAMPLE_TRANSFERS: SampleTransferRequest[] = [
  {
    id: "TR-PREVIEW-101",
    direction: "incoming",
    medicineName: "Paracetamol 650 mg",
    brand: "Dolo 650",
    quantity: 10,
    partnerPharmacy: "GreenCross Medicos",
    partnerArea: "Arera Colony",
    distanceKm: 1.8,
    status: "requested",
    requestedAt: "Sample • 15 mins ago",
    notes: "Urgent patient counter demand; requesting 10 strips.",
  },
  {
    id: "TR-PREVIEW-102",
    direction: "incoming",
    medicineName: "Pantoprazole + Domperidone",
    brand: "Pan-D",
    quantity: 6,
    partnerPharmacy: "CityMed Wellness Store",
    partnerArea: "New Market",
    distanceKm: 2.9,
    status: "approved",
    requestedAt: "Sample • 1 hour ago",
    notes: "Awaiting runner pickup confirmation.",
  },
  {
    id: "TR-PREVIEW-201",
    direction: "outgoing",
    medicineName: "Azithromycin 500 mg",
    brand: "Azithral 500",
    quantity: 8,
    partnerPharmacy: "CarePlus Community Pharmacy",
    partnerArea: "MP Nagar Zone-I",
    distanceKm: 1.1,
    status: "dispatched",
    requestedAt: "Sample • 35 mins ago",
    notes: "Runner en route for counter handoff.",
  },
  {
    id: "TR-PREVIEW-202",
    direction: "outgoing",
    medicineName: "Amoxicillin + Clavulanic Acid 625 mg",
    brand: "Augmentin 625 Duo",
    quantity: 5,
    partnerPharmacy: "GreenCross Medicos",
    partnerArea: "Arera Colony",
    distanceKm: 1.8,
    status: "received",
    requestedAt: "Sample • Yesterday",
    notes: "Verified and added to local stock.",
  },
];
