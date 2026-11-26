export interface SamplePharmacy {
  id: string;
  name: string;
  area: string;
  address: string;
  hours: string;
  isOpenNow: boolean;
  is24x7: boolean;
  distanceKm: number;
  phone: string;
  verifiedSample: boolean;
}

/**
 * Isolated sample pharmacy records for UI layout preview only.
 */
export const SAMPLE_PHARMACIES: SamplePharmacy[] = [
  {
    id: "sample-pharm-1",
    name: "CarePlus Community Pharmacy",
    area: "MP Nagar Zone-I",
    address: "Plot 14, Maharana Pratap Nagar, Bhopal",
    hours: "Open 24 Hours",
    isOpenNow: true,
    is24x7: true,
    distanceKm: 1.1,
    phone: "+91 755 000 0101",
    verifiedSample: true,
  },
  {
    id: "sample-pharm-2",
    name: "GreenCross Medicos",
    area: "Arera Colony",
    address: "E-4/22, Bittan Market Road, Bhopal",
    hours: "08:00 AM – 11:00 PM",
    isOpenNow: true,
    is24x7: false,
    distanceKm: 1.8,
    phone: "+91 755 000 0102",
    verifiedSample: true,
  },
  {
    id: "sample-pharm-3",
    name: "CityMed Wellness Store",
    area: "New Market",
    address: "Shop 8, TT Nagar Main Road, Bhopal",
    hours: "09:00 AM – 10:00 PM",
    isOpenNow: false,
    is24x7: false,
    distanceKm: 2.9,
    phone: "+91 755 000 0103",
    verifiedSample: true,
  },
];
