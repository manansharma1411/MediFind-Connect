-- ==============================================================================
-- MediFind Connect Migration: Discovery Views, Search/Geo RPCs, & RLS Policies
-- Migration: 20261126000002_medicine_discovery_functions_and_rls.sql
-- Author: Person B (Backend & Security Engineer)
--
-- Security Notes:
--   - RLS is enabled on ALL tables.
--   - Direct SELECT on raw `pharmacies`, `pharmacy_inventory`, and
--     `inventory_audit_history` is blocked for `anon` and generic `authenticated`
--     users so `license_number`, `email`, `unit_cost_price`, and audit logs
--     cannot leak.
--   - Pharmacy-staff RLS policies for `pharmacy_inventory` depend on the
--     `pharmacy_staff` membership table (planned for Phase 5B Auth). Until
--     then, private inventory access is strictly denied by default.
-- ==============================================================================

BEGIN;

-- 1. Public-Safe Pharmacy View (excludes license_number & internal email)
CREATE OR REPLACE VIEW public_pharmacies_view AS
SELECT
  p.id,
  p.name,
  p.phone,
  p.is_active,
  p.is_24x7,
  p.tier,
  p.is_demo,
  p.updated_at,
  pl.address,
  pl.area,
  pl.city,
  pl.state,
  pl.pincode,
  pl.lat,
  pl.lng,
  pl.is_location_verified
FROM pharmacies p
JOIN pharmacy_locations pl ON pl.pharmacy_id = p.id
WHERE p.is_active = true;

-- 2. Immutable Audit Guard (prevent UPDATE/DELETE on inventory_audit_history)
CREATE OR REPLACE FUNCTION prevent_audit_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'inventory_audit_history is immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON inventory_audit_history;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE OR DELETE ON inventory_audit_history
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_history_mutation();

-- 3. Enable Row Level Security (RLS) on All Tables
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_exceptional_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audit_history ENABLE ROW LEVEL SECURITY;

-- 4. Public Catalog & Location Policies (Read-only public fields)
DROP POLICY IF EXISTS "Public read medicines" ON medicines;
CREATE POLICY "Public read medicines"
  ON medicines FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read medicine_brands" ON medicine_brands;
CREATE POLICY "Public read medicine_brands"
  ON medicine_brands FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read pharmacy_locations" ON pharmacy_locations;
CREATE POLICY "Public read pharmacy_locations"
  ON pharmacy_locations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read pharmacy_operating_hours" ON pharmacy_operating_hours;
CREATE POLICY "Public read pharmacy_operating_hours"
  ON pharmacy_operating_hours FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read pharmacy_exceptional_closures" ON pharmacy_exceptional_closures;
CREATE POLICY "Public read pharmacy_exceptional_closures"
  ON pharmacy_exceptional_closures FOR SELECT
  TO anon, authenticated
  USING (true);

-- Note: `pharmacies`, `pharmacy_inventory`, and `inventory_audit_history` have
-- NO permissive `anon` or broad `authenticated` policies.
-- Server-side backend API uses the privileged service-role client strictly
-- to project safe public availability fields and enforce authorization.

-- 5. Ranked Medicine Search Function (Exact -> Brand -> Prefix -> Partial -> Trigram)
CREATE OR REPLACE FUNCTION search_medicines_ranked(
  p_query TEXT,
  p_form TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  generic_name VARCHAR,
  display_name VARCHAR,
  therapeutic_class VARCHAR,
  dosage_form VARCHAR,
  strength VARCHAR,
  pack_size VARCHAR,
  is_prescription_required BOOLEAN,
  storage_condition VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  match_rank INT,
  similarity_score REAL,
  total_count BIGINT
) AS $$
DECLARE
  v_clean TEXT := lower(trim(regexp_replace(COALESCE(p_query, ''), '\s+', ' ', 'g')));
BEGIN
  RETURN QUERY
  WITH scored AS (
    SELECT
      m.*,
      CASE
        WHEN v_clean = '' THEN 1
        WHEN lower(m.generic_name) = v_clean THEN 1
        WHEN EXISTS (
          SELECT 1 FROM medicine_brands mb
          WHERE mb.medicine_id = m.id AND lower(mb.brand_name) = v_clean
        ) THEN 2
        WHEN lower(m.generic_name) LIKE v_clean || '%'
          OR lower(m.display_name) LIKE v_clean || '%'
          OR EXISTS (
            SELECT 1 FROM medicine_brands mb
            WHERE mb.medicine_id = m.id AND lower(mb.brand_name) LIKE v_clean || '%'
          ) THEN 3
        WHEN lower(m.generic_name) LIKE '%' || v_clean || '%'
          OR lower(m.display_name) LIKE '%' || v_clean || '%'
          OR EXISTS (
            SELECT 1 FROM medicine_brands mb
            WHERE mb.medicine_id = m.id AND lower(mb.brand_name) LIKE '%' || v_clean || '%'
          ) THEN 4
        ELSE 5
      END AS m_rank,
      GREATEST(
        similarity(lower(m.generic_name), v_clean),
        similarity(lower(m.display_name), v_clean),
        COALESCE((
          SELECT MAX(similarity(lower(mb.brand_name), v_clean))
          FROM medicine_brands mb WHERE mb.medicine_id = m.id
        ), 0::REAL)
      ) AS sim_score
    FROM medicines m
    WHERE (p_form IS NULL OR lower(m.dosage_form) = lower(p_form))
      AND (
        v_clean = ''
        OR lower(m.generic_name) LIKE '%' || v_clean || '%'
        OR lower(m.display_name) LIKE '%' || v_clean || '%'
        OR EXISTS (
          SELECT 1 FROM medicine_brands mb
          WHERE mb.medicine_id = m.id AND lower(mb.brand_name) LIKE '%' || v_clean || '%'
        )
        OR similarity(lower(m.generic_name), v_clean) >= 0.25
        OR similarity(lower(m.display_name), v_clean) >= 0.25
        OR EXISTS (
          SELECT 1 FROM medicine_brands mb
          WHERE mb.medicine_id = m.id AND similarity(lower(mb.brand_name), v_clean) >= 0.25
        )
      )
  )
  SELECT
    s.id,
    s.generic_name,
    s.display_name,
    s.therapeutic_class,
    s.dosage_form,
    s.strength,
    s.pack_size,
    s.is_prescription_required,
    s.storage_condition,
    s.created_at,
    s.updated_at,
    s.m_rank,
    s.sim_score,
    COUNT(*) OVER() AS total_count
  FROM scored s
  ORDER BY s.m_rank ASC, s.sim_score DESC, s.display_name ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMIT;
