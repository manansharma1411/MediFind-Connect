-- ==============================================================================
-- MediFind Connect Migration: Medicine Discovery Core Schema
-- Migration: 20261126000001_medicine_discovery_schema.sql
-- Author: Person B (Backend & Database Architect)
--
-- Rollback Guidance:
--   Forward-fix migrations are preferred in production. To roll back in dev:
--   DROP TABLE IF EXISTS inventory_audit_history, pharmacy_inventory,
--     pharmacy_exceptional_closures, pharmacy_operating_hours,
--     pharmacy_locations, pharmacies, medicine_brands, medicines CASCADE;
-- ==============================================================================

BEGIN;

-- 1. Medicines Master Catalog
CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name VARCHAR(250) NOT NULL,
  display_name VARCHAR(250) NOT NULL,
  therapeutic_class VARCHAR(150),
  dosage_form VARCHAR(50) NOT NULL CHECK (
    dosage_form IN ('Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Inhaler', 'Drops', 'Other')
  ),
  strength VARCHAR(100) NOT NULL,
  pack_size VARCHAR(100) NOT NULL,
  is_prescription_required BOOLEAN NOT NULL DEFAULT false,
  storage_condition VARCHAR(100) NOT NULL DEFAULT 'Ambient' CHECK (
    storage_condition IN ('Ambient', 'Refrigerated (2-8C)', 'Cold Storage', 'Controlled Substance')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_medicines_formulation
  ON medicines (lower(generic_name), lower(dosage_form), lower(strength), lower(pack_size));

CREATE INDEX IF NOT EXISTS idx_medicines_generic_trgm
  ON medicines USING GIN (generic_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_medicines_display_trgm
  ON medicines USING GIN (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_medicines_dosage_form
  ON medicines (dosage_form);

CREATE TRIGGER set_medicines_timestamp
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 2. Medicine Brands (Multiple brands per generic medicine)
CREATE TABLE IF NOT EXISTS medicine_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  brand_name VARCHAR(200) NOT NULL,
  manufacturer VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_medicine_brands_med_brand_mfg
  ON medicine_brands (medicine_id, lower(brand_name), lower(manufacturer));

CREATE INDEX IF NOT EXISTS idx_medicine_brands_name_trgm
  ON medicine_brands USING GIN (brand_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_medicine_brands_medicine_id
  ON medicine_brands (medicine_id);

-- 3. Pharmacies (Separates internal licensing from public responses)
CREATE TABLE IF NOT EXISTS pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  license_number VARCHAR(100) UNIQUE, -- Nullable for unverified/demo; NEVER exposed publicly
  is_licensed_verified BOOLEAN NOT NULL DEFAULT false,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_24x7 BOOLEAN NOT NULL DEFAULT false,
  tier VARCHAR(30) NOT NULL DEFAULT 'standard' CHECK (
    tier IN ('standard', 'hub', 'hospital_attached')
  ),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_active
  ON pharmacies (is_active) WHERE is_active = true;

CREATE TRIGGER set_pharmacies_timestamp
  BEFORE UPDATE ON pharmacies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 4. Pharmacy Locations (India-focused addresses, 6-digit PIN, PostGIS geography)
CREATE TABLE IF NOT EXISTS pharmacy_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL UNIQUE REFERENCES pharmacies(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  area VARCHAR(120) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(6) NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  lat DECIMAL(10, 7) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DECIMAL(10, 7) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  ) STORED,
  is_location_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_locations_geo
  ON pharmacy_locations USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_pharmacy_locations_pincode
  ON pharmacy_locations (pincode);

CREATE INDEX IF NOT EXISTS idx_pharmacy_locations_city_lower
  ON pharmacy_locations (lower(city));

CREATE TRIGGER set_pharmacy_locations_timestamp
  BEFORE UPDATE ON pharmacy_locations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 5. Pharmacy Operating Hours & Exceptional Closures (Asia/Kolkata default)
CREATE TABLE IF NOT EXISTS pharmacy_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday .. 6=Saturday
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  CONSTRAINT chk_open_close_times CHECK (
    is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL)
  ),
  UNIQUE (pharmacy_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS pharmacy_exceptional_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  closure_date DATE NOT NULL,
  reason TEXT,
  is_closed BOOLEAN NOT NULL DEFAULT true,
  custom_open_time TIME,
  custom_close_time TIME,
  UNIQUE (pharmacy_id, closure_date)
);

-- 6. Pharmacy Inventory (Batch-aware, non-negative stock, confidential wholesale cost)
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_number VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  quantity_available INT NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_reserved INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  mrp NUMERIC(12, 2) NOT NULL CHECK (mrp >= 0),
  selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0 AND selling_price <= mrp),
  unit_cost_price NUMERIC(12, 2) CHECK (unit_cost_price >= 0), -- CONFIDENTIAL
  reorder_threshold INT NOT NULL DEFAULT 10 CHECK (reorder_threshold >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, medicine_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_med_avail
  ON pharmacy_inventory (medicine_id, expiry_date)
  WHERE quantity_available > 0;

CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_pharm
  ON pharmacy_inventory (pharmacy_id);

CREATE TRIGGER set_pharmacy_inventory_timestamp
  BEFORE UPDATE ON pharmacy_inventory
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 7. Inventory Audit History (Immutable append-only ledger)
CREATE TABLE IF NOT EXISTS inventory_audit_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  delta_quantity INT NOT NULL,
  resulting_quantity INT NOT NULL CHECK (resulting_quantity >= 0),
  reason VARCHAR(50) NOT NULL CHECK (
    reason IN (
      'INITIAL_STOCK',
      'SALE',
      'SALE_RETURN',
      'RESERVATION_HOLD',
      'RESERVATION_RELEASE',
      'TRANSFER_DISPATCH',
      'TRANSFER_RECEIPT',
      'STOCK_AUDIT',
      'EXPIRY_DISPOSAL'
    )
  ),
  actor_id UUID, -- Maps to auth.users(id) when authentication is wired
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_pharm_created
  ON inventory_audit_history (pharmacy_id, created_at DESC);

COMMIT;
