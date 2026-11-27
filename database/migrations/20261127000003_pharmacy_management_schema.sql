-- ==============================================================================
-- MediFind Connect Migration: Phase 6A Pharmacy Management & Ownership
-- Migration: 20261127000003_pharmacy_management_schema.sql
-- Author: Person B (Backend & Database Architect)
--
-- Rollback Guidance:
--   DROP FUNCTION IF EXISTS adjust_pharmacy_inventory_atomic;
--   DROP TABLE IF EXISTS pharmacy_staff CASCADE;
--   ALTER TABLE pharmacies DROP COLUMN IF EXISTS owner_user_id, DROP COLUMN IF EXISTS verification_status;
--   ALTER TABLE inventory_audit_history DROP COLUMN IF EXISTS previous_quantity, DROP COLUMN IF EXISTS movement_type;
-- ==============================================================================

BEGIN;

-- 1. Extend pharmacies with owner_user_id and verification_status
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'));

-- Prevent duplicate pharmacy registrations by the same owner
CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacies_owner_user_id
  ON pharmacies (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- 2. Pharmacy Staff Membership Table (supports multi-staff & owner authorization)
CREATE TABLE IF NOT EXISTS pharmacy_staff (
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_role VARCHAR(30) NOT NULL DEFAULT 'owner'
    CHECK (staff_role IN ('owner', 'manager', 'dispenser')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pharmacy_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_staff_user_id
  ON pharmacy_staff (user_id);

-- 3. Extend inventory_audit_history with previous_quantity and movement_type
ALTER TABLE inventory_audit_history
  ADD COLUMN IF NOT EXISTS previous_quantity INT CHECK (previous_quantity >= 0),
  ADD COLUMN IF NOT EXISTS movement_type VARCHAR(30)
    CHECK (movement_type IN ('ADD', 'RESTOCK', 'SALE', 'ADJUSTMENT', 'RETURN', 'EXPIRY_DISPOSAL', 'RESERVATION'));

-- 4. Atomic Stock Adjustment Function (Row-level lock prevents race conditions & negative stock)
CREATE OR REPLACE FUNCTION adjust_pharmacy_inventory_atomic(
  p_pharmacy_id UUID,
  p_inventory_id UUID,
  p_delta_quantity INT,
  p_reason VARCHAR,
  p_movement_type VARCHAR,
  p_actor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  inventory_id UUID,
  previous_quantity INT,
  new_quantity INT,
  audit_id BIGINT
) AS $$
DECLARE
  v_prev_qty INT;
  v_new_qty INT;
  v_med_id UUID;
  v_audit_id BIGINT;
BEGIN
  -- Lock the specific inventory row owned by this pharmacy
  SELECT pi.quantity_available, pi.medicine_id
  INTO v_prev_qty, v_med_id
  FROM pharmacy_inventory pi
  WHERE pi.id = p_inventory_id
    AND pi.pharmacy_id = p_pharmacy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_NOT_FOUND: Inventory item % not found for pharmacy %', p_inventory_id, p_pharmacy_id;
  END IF;

  v_new_qty := v_prev_qty + p_delta_quantity;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: Adjustment would result in negative stock (current: %, delta: %)', v_prev_qty, p_delta_quantity;
  END IF;

  UPDATE pharmacy_inventory
  SET quantity_available = v_new_qty,
      updated_at = now()
  WHERE id = p_inventory_id
    AND pharmacy_id = p_pharmacy_id;

  INSERT INTO inventory_audit_history (
    inventory_id,
    pharmacy_id,
    medicine_id,
    delta_quantity,
    previous_quantity,
    resulting_quantity,
    movement_type,
    reason,
    actor_id,
    notes
  )
  VALUES (
    p_inventory_id,
    p_pharmacy_id,
    v_med_id,
    p_delta_quantity,
    v_prev_qty,
    v_new_qty,
    p_movement_type,
    p_reason,
    p_actor_id,
    p_notes
  )
  RETURNING id INTO v_audit_id;

  RETURN QUERY SELECT p_inventory_id, v_prev_qty, v_new_qty, v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Enable RLS on pharmacy_staff and add tenant-isolated policies
ALTER TABLE pharmacy_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own pharmacy staff memberships" ON pharmacy_staff;
CREATE POLICY "Users view own pharmacy staff memberships"
  ON pharmacy_staff FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authorized staff manage own pharmacy" ON pharmacies;
CREATE POLICY "Authorized staff manage own pharmacy"
  ON pharmacies FOR ALL
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR id IN (SELECT ps.pharmacy_id FROM pharmacy_staff ps WHERE ps.user_id = auth.uid())
  )
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Authorized staff manage own pharmacy inventory" ON pharmacy_inventory;
CREATE POLICY "Authorized staff manage own pharmacy inventory"
  ON pharmacy_inventory FOR ALL
  TO authenticated
  USING (
    pharmacy_id IN (
      SELECT p.id FROM pharmacies p WHERE p.owner_user_id = auth.uid()
      UNION
      SELECT ps.pharmacy_id FROM pharmacy_staff ps WHERE ps.user_id = auth.uid()
    )
  )
  WITH CHECK (
    pharmacy_id IN (
      SELECT p.id FROM pharmacies p WHERE p.owner_user_id = auth.uid()
      UNION
      SELECT ps.pharmacy_id FROM pharmacy_staff ps WHERE ps.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authorized staff view own inventory audit history" ON inventory_audit_history;
CREATE POLICY "Authorized staff view own inventory audit history"
  ON inventory_audit_history FOR SELECT
  TO authenticated
  USING (
    pharmacy_id IN (
      SELECT p.id FROM pharmacies p WHERE p.owner_user_id = auth.uid()
      UNION
      SELECT ps.pharmacy_id FROM pharmacy_staff ps WHERE ps.user_id = auth.uid()
    )
  );

-- Grant service_role access to newly added objects
GRANT ALL ON TABLE pharmacy_staff TO service_role;
GRANT SELECT ON TABLE pharmacy_staff TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_pharmacy_inventory_atomic TO service_role;

COMMIT;
