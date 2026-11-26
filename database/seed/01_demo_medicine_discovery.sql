-- ==============================================================================
-- MediFind Connect: Development Demo Seed (Medicine Discovery)
-- File: database/seed/01_demo_medicine_discovery.sql
--
-- IMPORTANT:
--   1. FOR DEVELOPMENT & TESTING ONLY. Do NOT execute against production data.
--   2. All pharmacies are clearly labeled [DEMO] with is_demo = true.
--   3. License numbers are NULL and is_licensed_verified = false (no fabricated licenses).
--   4. Idempotent inserts (ON CONFLICT DO NOTHING) — never deletes existing rows.
-- ==============================================================================

BEGIN;

-- 1. Demo Indian Medicines
INSERT INTO medicines (id, generic_name, display_name, therapeutic_class, dosage_form, strength, pack_size, is_prescription_required, storage_condition)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'Paracetamol', 'Paracetamol 650 mg Tablet', 'Analgesic & Antipyretic', 'Tablet', '650 mg', 'Strip of 15 Tablets', false, 'Ambient'),
  ('11111111-1111-4111-8111-111111111102', 'Paracetamol', 'Paracetamol 500 mg Tablet', 'Analgesic & Antipyretic', 'Tablet', '500 mg', 'Strip of 10 Tablets', false, 'Ambient'),
  ('11111111-1111-4111-8111-111111111103', 'Amoxicillin + Clavulanic Acid', 'Amoxycillin & Potassium Clavulanate 625 mg', 'Antibiotic', 'Tablet', '625 mg', 'Strip of 10 Tablets', true, 'Ambient'),
  ('11111111-1111-4111-8111-111111111104', 'Azithromycin', 'Azithromycin 500 mg Tablet', 'Macrolide Antibiotic', 'Tablet', '500 mg', 'Strip of 5 Tablets', true, 'Ambient'),
  ('11111111-1111-4111-8111-111111111105', 'Metformin', 'Metformin Hydrochloride 500 mg SR', 'Antidiabetic', 'Tablet', '500 mg', 'Strip of 20 Tablets', true, 'Ambient'),
  ('11111111-1111-4111-8111-111111111106', 'Salbutamol', 'Salbutamol 100 mcg Inhaler', 'Bronchodilator', 'Inhaler', '100 mcg/actuation', '1 Inhaler (200 MD)', true, 'Ambient'),
  ('11111111-1111-4111-8111-111111111107', 'Insulin Glargine', 'Insulin Glargine 100 IU/mL Cartridge', 'Antidiabetic (Biologic)', 'Injection', '100 IU/mL', '1 x 3 mL Cartridge', true, 'Refrigerated (2-8C)')
ON CONFLICT (id) DO NOTHING;

-- 2. Demo Indian Brands
INSERT INTO medicine_brands (medicine_id, brand_name, manufacturer)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'Dolo 650', 'Micro Labs Ltd'),
  ('11111111-1111-4111-8111-111111111101', 'Calpol 650', 'GSK India'),
  ('11111111-1111-4111-8111-111111111102', 'Crocin Advance', 'Haleon India'),
  ('11111111-1111-4111-8111-111111111103', 'Augmentin 625 Duo', 'GSK India'),
  ('11111111-1111-4111-8111-111111111103', 'Moxikind-CV 625', 'Mankind Pharma'),
  ('11111111-1111-4111-8111-111111111104', 'Azithral 500', 'Alembic Pharmaceuticals'),
  ('11111111-1111-4111-8111-111111111105', 'Glycomet-SR 500', 'USV Pvt Ltd'),
  ('11111111-1111-4111-8111-111111111106', 'Asthalin Inhaler', 'Cipla Ltd'),
  ('11111111-1111-4111-8111-111111111107', 'Lantus SoloStar', 'Sanofi India')
ON CONFLICT DO NOTHING;

-- 3. Demo Pharmacies (Unlicensed/Demo flagged, multi-city India)
INSERT INTO pharmacies (id, name, license_number, is_licensed_verified, phone, email, is_active, is_24x7, tier, is_demo)
VALUES
  ('22222222-2222-4222-8222-222222222201', '[DEMO] Bhopal Central Chemist', NULL, false, '+91-755-0000101', NULL, true, true, 'hub', true),
  ('22222222-2222-4222-8222-222222222202', '[DEMO] Arera Care Pharmacy', NULL, false, '+91-755-0000102', NULL, true, false, 'standard', true),
  ('22222222-2222-4222-8222-222222222203', '[DEMO] Indore Health Hub', NULL, false, '+91-731-0000103', NULL, true, false, 'standard', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Demo Locations (Indian PIN codes & coordinates)
INSERT INTO pharmacy_locations (pharmacy_id, address, area, city, state, pincode, lat, lng, is_location_verified)
VALUES
  ('22222222-2222-4222-8222-222222222201', 'Plot 14, Zone-I, Maharana Pratap Nagar', 'MP Nagar', 'Bhopal', 'Madhya Pradesh', '462011', 23.2323000, 77.4332000, false),
  ('22222222-2222-4222-8222-222222222202', 'E-4/22, 10 Number Market', 'Arera Colony', 'Bhopal', 'Madhya Pradesh', '462016', 23.2136000, 77.4344000, false),
  ('22222222-2222-4222-8222-222222222203', 'Shop 8, Scheme 54, Vijay Nagar', 'Vijay Nagar', 'Indore', 'Madhya Pradesh', '452010', 22.7533000, 75.8937000, false)
ON CONFLICT (pharmacy_id) DO NOTHING;

-- 5. Demo Operating Hours (Asia/Kolkata)
INSERT INTO pharmacy_operating_hours (pharmacy_id, day_of_week, open_time, close_time, is_closed, timezone)
SELECT '22222222-2222-4222-8222-222222222201', d, '00:00:00'::TIME, '23:59:59'::TIME, false, 'Asia/Kolkata'
FROM generate_series(0, 6) AS d
ON CONFLICT (pharmacy_id, day_of_week) DO NOTHING;

INSERT INTO pharmacy_operating_hours (pharmacy_id, day_of_week, open_time, close_time, is_closed, timezone)
SELECT '22222222-2222-4222-8222-222222222202', d, '08:30:00'::TIME, '22:00:00'::TIME, false, 'Asia/Kolkata'
FROM generate_series(0, 6) AS d
ON CONFLICT (pharmacy_id, day_of_week) DO NOTHING;

-- 6. Demo Inventory (Including normal, low stock, reserved, expired, and out-of-stock edge cases)
INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, batch_number, expiry_date, quantity_available, quantity_reserved, mrp, selling_price, unit_cost_price, reorder_threshold)
VALUES
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'DEMO-B01', '2028-06-30', 45, 5, 34.00, 30.00, 21.00, 10),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101', 'DEMO-B02', '2028-03-31', 4, 2, 34.00, 32.00, 22.00, 10),
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111103', 'DEMO-B03', '2027-12-31', 0, 10, 205.00, 190.00, 140.00, 10), -- Out of available stock (10 reserved)
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111103', 'DEMO-EXP', '2025-01-01', 20, 0, 205.00, 185.00, 138.00, 10), -- Expired batch
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111101', 'DEMO-B04', '2028-08-31', 60, 0, 34.00, 28.50, 20.00, 10)
ON CONFLICT (pharmacy_id, medicine_id, batch_number) DO NOTHING;

COMMIT;
