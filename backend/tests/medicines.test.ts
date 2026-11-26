import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { createApp } from '../src/app.js';
import {
  IMedicineRepository,
  MedicineRecord,
  MedicineSearchRawResult,
  RawPharmacyStockRecord,
} from '../src/repositories/medicineRepository.js';
import {
  MedicineService,
  calculateDistanceKm,
  evaluateIsOpenNow,
} from '../src/services/medicineService.js';

const MED_PARACETAMOL_650 = '11111111-1111-4111-8111-111111111101';
const MED_AMOXICILLIN_625 = '11111111-1111-4111-8111-111111111103';
const MED_MISSING = '99999999-9999-4999-8999-999999999999';

const DEMO_MEDICINES: MedicineRecord[] = [
  {
    id: MED_PARACETAMOL_650,
    name: 'Paracetamol 650 mg Tablet',
    genericName: 'Paracetamol',
    displayName: 'Paracetamol 650 mg Tablet',
    primaryBrand: 'Dolo 650',
    therapeuticClass: 'Analgesic & Antipyretic',
    form: 'Tablet',
    dosageForm: 'Tablet',
    strength: '650 mg',
    packSize: 'Strip of 15 Tablets',
    isPrescriptionRequired: false,
    storageCondition: 'Ambient',
    brands: [
      { id: 'b1', brandName: 'Dolo 650', manufacturer: 'Micro Labs Ltd' },
      { id: 'b2', brandName: 'Calpol 650', manufacturer: 'GSK India' },
    ],
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
  },
  {
    id: MED_AMOXICILLIN_625,
    name: 'Amoxycillin & Potassium Clavulanate 625 mg',
    genericName: 'Amoxicillin + Clavulanic Acid',
    displayName: 'Amoxycillin & Potassium Clavulanate 625 mg',
    primaryBrand: 'Augmentin 625 Duo',
    therapeuticClass: 'Antibiotic',
    form: 'Tablet',
    dosageForm: 'Tablet',
    strength: '625 mg',
    packSize: 'Strip of 10 Tablets',
    isPrescriptionRequired: true,
    storageCondition: 'Ambient',
    brands: [
      { id: 'b3', brandName: 'Augmentin 625 Duo', manufacturer: 'GSK India' },
    ],
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
  },
];

const DEMO_STOCKS: Record<string, RawPharmacyStockRecord[]> = {
  [MED_PARACETAMOL_650]: [
    {
      pharmacyId: '22222222-2222-4222-8222-222222222201',
      pharmacyName: '[DEMO] Bhopal Central Chemist',
      isActive: true,
      is24x7: true,
      isDemo: true,
      address: 'Plot 14, Zone-I, MP Nagar',
      area: 'MP Nagar',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462011',
      lat: 23.2323,
      lng: 77.4332,
      expiryDate: '2028-06-30',
      quantityAvailable: 45,
      quantityReserved: 5,
      mrp: 34.0,
      sellingPrice: 30.0,
      reorderThreshold: 10,
      updatedAt: '2026-11-26T10:00:00.000Z',
      operatingHours: [],
      exceptionalClosures: [],
    },
    {
      pharmacyId: '22222222-2222-4222-8222-222222222202',
      pharmacyName: '[DEMO] Arera Care Pharmacy',
      isActive: true,
      is24x7: false,
      isDemo: true,
      address: 'E-4/22, 10 Number Market',
      area: 'Arera Colony',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462016',
      lat: 23.2136,
      lng: 77.4344,
      expiryDate: '2028-03-31',
      quantityAvailable: 4, // Low stock
      quantityReserved: 2,
      mrp: 34.0,
      sellingPrice: 28.0,
      reorderThreshold: 10,
      updatedAt: '2026-11-26T09:00:00.000Z',
      operatingHours: [], // Missing operating hours -> isOpenNow must be null
      exceptionalClosures: [],
    },
    {
      // Expired batch at another pharmacy — MUST be excluded from availability & prices
      pharmacyId: '22222222-2222-4222-8222-222222222203',
      pharmacyName: '[DEMO] Expired Batch Pharmacy',
      isActive: true,
      is24x7: false,
      isDemo: true,
      address: 'Old Market',
      area: 'New Market',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462003',
      lat: 23.235,
      lng: 77.402,
      expiryDate: '2024-01-01', // Expired!
      quantityAvailable: 50,
      quantityReserved: 0,
      mrp: 34.0,
      sellingPrice: 25.0,
      reorderThreshold: 10,
      updatedAt: '2026-11-26T08:00:00.000Z',
      operatingHours: [],
      exceptionalClosures: [],
    },
  ],
  [MED_AMOXICILLIN_625]: [
    {
      // 0 available, 10 reserved -> MUST show OUT_OF_STOCK
      pharmacyId: '22222222-2222-4222-8222-222222222201',
      pharmacyName: '[DEMO] Bhopal Central Chemist',
      isActive: true,
      is24x7: true,
      isDemo: true,
      address: 'Plot 14, Zone-I, MP Nagar',
      area: 'MP Nagar',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462011',
      lat: 23.2323,
      lng: 77.4332,
      expiryDate: '2028-12-31',
      quantityAvailable: 0,
      quantityReserved: 10,
      mrp: 205.0,
      sellingPrice: 190.0,
      reorderThreshold: 10,
      updatedAt: '2026-11-26T10:00:00.000Z',
      operatingHours: [],
      exceptionalClosures: [],
    },
  ],
};

class InMemoryMedicineRepository implements IMedicineRepository {
  async searchMedicines(
    query: string,
    form: string | undefined,
    page: number,
    limit: number
  ): Promise<MedicineSearchRawResult> {
    const q = query.toLowerCase();
    let pool = DEMO_MEDICINES;
    if (form) {
      pool = pool.filter((m) => m.dosageForm.toLowerCase() === form.toLowerCase());
    }

    if (!q) {
      const start = (page - 1) * limit;
      return {
        matches: pool.slice(start, start + limit),
        suggestions: [],
        total: pool.length,
      };
    }

    const exactOrPartial = pool.filter(
      (m) =>
        m.genericName.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.brands.some((b) => b.brandName.toLowerCase().includes(q))
    );

    if (exactOrPartial.length > 0) {
      const start = (page - 1) * limit;
      return {
        matches: exactOrPartial.slice(start, start + limit),
        suggestions: [],
        total: exactOrPartial.length,
      };
    }

    // Typo simulation: "paracetmol" or "dolo650" -> suggestion without substituting items
    if (q.includes('paracet') || q.includes('dolo')) {
      return {
        matches: [],
        suggestions: [DEMO_MEDICINES[0]],
        total: 0,
      };
    }

    return { matches: [], suggestions: [], total: 0 };
  }

  async findMedicineById(id: string): Promise<MedicineRecord | null> {
    return DEMO_MEDICINES.find((m) => m.id === id) || null;
  }

  async findStockForMedicine(medicineId: string): Promise<RawPharmacyStockRecord[]> {
    return DEMO_STOCKS[medicineId] || [];
  }
}

let server: Server;
let baseUrl: string;

test.before(() => {
  const service = new MedicineService(new InMemoryMedicineRepository());
  const app = createApp({ medicineService: service });
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

test.after(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test('Search: exact generic name & case-insensitive matching', async () => {
  const res = await fetch(`${baseUrl}/api/v1/medicines?q=pArAcEtAmOl`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.items[0].genericName, 'Paracetamol');
  assert.equal(body.data.items[0].name, 'Paracetamol 650 mg Tablet');
  assert.equal(body.data.items[0].form, 'Tablet');
  assert.equal(body.data.items[0].primaryBrand, 'Dolo 650');
  assert.equal(body.data.didYouMean, null);
  assert.equal(body.data.suggestions.length, 0);
});

test('Search: brand search (Dolo 650) & partial search (Augmen)', async () => {
  const brandRes = await fetch(`${baseUrl}/api/v1/medicines?q=Dolo%20650`);
  const brandBody = await brandRes.json();
  assert.equal(brandBody.data.items.length, 1);
  assert.equal(brandBody.data.items[0].id, MED_PARACETAMOL_650);

  const partialRes = await fetch(`${baseUrl}/api/v1/medicines?q=Augmen`);
  const partialBody = await partialRes.json();
  assert.equal(partialBody.data.items.length, 1);
  assert.equal(partialBody.data.items[0].id, MED_AMOXICILLIN_625);
});

test('Search: typo suggestions separated from empty confirmed items', async () => {
  const res = await fetch(`${baseUrl}/api/v1/medicines?q=paracetmol`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.items.length, 0);
  assert.equal(body.data.hasExactOrPartialMatch, false);
  assert.equal(body.data.didYouMean, 'Paracetamol 650 mg Tablet');
  assert.equal(body.data.suggestions.length, 1);
  assert.equal(body.data.suggestions[0].genericName, 'Paracetamol');
  assert.equal(body.data.pagination.total, 0);
});

test('Search: empty search returns paginated catalog', async () => {
  const res = await fetch(`${baseUrl}/api/v1/medicines?page=1&limit=1`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.pagination.page, 1);
  assert.equal(body.data.pagination.limit, 1);
  assert.equal(body.data.pagination.total, 2);
  assert.equal(body.data.pagination.totalPages, 2);
});

test('Medicine Details: invalid UUID returns 400 and missing UUID returns 404', async () => {
  const invalidRes = await fetch(`${baseUrl}/api/v1/medicines/not-a-uuid`);
  assert.equal(invalidRes.status, 400);
  const invalidBody = await invalidRes.json();
  assert.equal(invalidBody.success, false);
  assert.equal(invalidBody.error.code, 'VALIDATION_ERROR');

  const missingRes = await fetch(`${baseUrl}/api/v1/medicines/${MED_MISSING}`);
  assert.equal(missingRes.status, 404);
  const missingBody = await missingRes.json();
  assert.equal(missingBody.success, false);
  assert.equal(missingBody.error.code, 'RESOURCE_NOT_FOUND');
});

test('Availability: calculates distance, excludes expired stock, hides private fields, and handles null hours', async () => {
  // User at MP Nagar Bhopal (23.2323, 77.4332)
  const res = await fetch(
    `${baseUrl}/api/v1/medicines/${MED_PARACETAMOL_650}/availability?lat=23.2323&lng=77.4332&radiusKm=10`
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);

  const pharmacies = body.data.pharmacies as Array<Record<string, unknown>>;
  // Only 2 non-expired pharmacies should be returned (Expired Batch Pharmacy excluded!)
  assert.equal(pharmacies.length, 2);
  assert.equal(pharmacies[0].distanceKm, 0);
  assert.equal(pharmacies[0].status, 'IN_STOCK');
  assert.equal(pharmacies[0].isOpenNow, true);

  // Second pharmacy has missing operating hours -> isOpenNow must be null (never guessed true)
  assert.equal(pharmacies[1].status, 'LOW_STOCK');
  assert.equal(pharmacies[1].isOpenNow, null);
  assert.ok(Number(pharmacies[1].distanceKm) > 1.5 && Number(pharmacies[1].distanceKm) < 3);

  // Private fields MUST NOT exist on public availability objects
  assert.equal(pharmacies[0].unitCostPrice, undefined);
  assert.equal(pharmacies[0].licenseNumber, undefined);
  assert.equal(pharmacies[0].quantityAvailable, undefined);
});

test('Availability: reserved stock with 0 available reports OUT_OF_STOCK', async () => {
  const res = await fetch(`${baseUrl}/api/v1/medicines/${MED_AMOXICILLIN_625}/availability`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.pharmacies.length, 1);
  assert.equal(body.data.pharmacies[0].status, 'OUT_OF_STOCK');
});

test('Price Comparison: sorts by sellingPrice ascending, excludes expired & out-of-stock', async () => {
  const res = await fetch(
    `${baseUrl}/api/v1/medicines/${MED_PARACETAMOL_650}/prices?lat=23.2323&lng=77.4332&sortBy=price_asc`
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.medicine.currency, 'INR');
  assert.equal(body.data.comparisons.length, 2);
  // Cheapest non-expired (28.00) must come first; expired (25.00) must NOT appear
  assert.equal(body.data.comparisons[0].sellingPrice, 28);
  assert.equal(body.data.comparisons[1].sellingPrice, 30);

  // Out-of-stock medicine has 0 active price comparisons
  const outRes = await fetch(`${baseUrl}/api/v1/medicines/${MED_AMOXICILLIN_625}/prices`);
  const outBody = await outRes.json();
  assert.equal(outBody.data.comparisons.length, 0);
});

test('Security: private inventory endpoint blocks unauthenticated (401) and unauthorized (403) access', async () => {
  const unauthRes = await fetch(
    `${baseUrl}/api/v1/pharmacies/22222222-2222-4222-8222-222222222201/inventory`
  );
  assert.equal(unauthRes.status, 401);
  const unauthBody = await unauthRes.json();
  assert.equal(unauthBody.error.code, 'UNAUTHORIZED');

  const unprivRes = await fetch(
    `${baseUrl}/api/v1/pharmacies/22222222-2222-4222-8222-222222222201/inventory`,
    { headers: { Authorization: 'Bearer fake-user-token' } }
  );
  assert.equal(unprivRes.status, 403);
  const unprivBody = await unprivRes.json();
  assert.equal(unprivBody.error.code, 'FORBIDDEN');
});

test('Unit: Haversine distance & Asia/Kolkata operating hours evaluation', () => {
  const dist = calculateDistanceKm(23.2323, 77.4332, 23.2136, 77.4344);
  assert.ok(dist > 2.0 && dist < 2.2);

  // Test IST exceptional closure overrides 24x7
  const closed = evaluateIsOpenNow(
    {
      isActive: true,
      is24x7: true,
      operatingHours: [],
      exceptionalClosures: [
        {
          closureDate: '2026-11-26',
          isClosed: true,
          customOpenTime: null,
          customCloseTime: null,
        },
      ],
    },
    new Date('2026-11-26T12:00:00+05:30')
  );
  assert.equal(closed, false);
});
