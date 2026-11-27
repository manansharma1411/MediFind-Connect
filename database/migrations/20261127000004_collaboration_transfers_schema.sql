-- ==============================================================================
-- MediFind Connect Migration: Phase 7A Pharmacy-to-Pharmacy Collaboration
-- Migration: 20261127000004_collaboration_transfers_schema.sql
-- Author: Person B (Backend & Database Architect)
--
-- Rollback Guidance:
--   DROP FUNCTION IF EXISTS approve_stock_transfer_atomic, reject_stock_transfer_atomic,
--     dispatch_stock_transfer_atomic, receive_stock_transfer_atomic, cancel_stock_transfer_atomic;
--   DROP TABLE IF EXISTS transfer_idempotency_keys, transfer_events, stock_transfers CASCADE;
-- ==============================================================================

BEGIN;

-- 1. Stock Transfers Table
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_code VARCHAR(32) UNIQUE NOT NULL,
  requesting_pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
  supplying_pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE RESTRICT,
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  source_inventory_item_id UUID NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE RESTRICT,
  requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
  approved_quantity INT CHECK (approved_quantity >= 0 AND approved_quantity <= requested_quantity),
  status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (
    status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED', 'CANCELLED')
  ),
  request_reason TEXT,
  rejection_reason TEXT,
  requested_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  dispatched_at TIMESTAMPTZ,
  dispatched_by_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  dispatch_reference VARCHAR(120),
  received_at TIMESTAMPTZ,
  received_by_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  received_quantity INT CHECK (received_quantity >= 0),
  has_discrepancy BOOLEAN NOT NULL DEFAULT false,
  discrepancy_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_no_self_transfer CHECK (requesting_pharmacy_id <> supplying_pharmacy_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_req_pharm
  ON stock_transfers (requesting_pharmacy_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_sup_pharm
  ON stock_transfers (supplying_pharmacy_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_status
  ON stock_transfers (status);

CREATE TRIGGER set_stock_transfers_timestamp
  BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 2. Immutable Transfer Events / Audit History
CREATE TABLE IF NOT EXISTS transfer_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  previous_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL CHECK (
    new_status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED', 'CANCELLED')
  ),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_events_transfer_id
  ON transfer_events (transfer_id, created_at ASC);

CREATE OR REPLACE FUNCTION prevent_transfer_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'transfer_events is immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_transfer_events_update ON transfer_events;
CREATE TRIGGER trg_prevent_transfer_events_update
  BEFORE UPDATE OR DELETE ON transfer_events
  FOR EACH ROW EXECUTE FUNCTION prevent_transfer_events_mutation();

-- 3. Idempotency Protection Table for Sensitive Transfer Actions
CREATE TABLE IF NOT EXISTS transfer_idempotency_keys (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, action, idempotency_key)
);

-- 4. Atomic Approve & Reserve Stock RPC
CREATE OR REPLACE FUNCTION approve_stock_transfer_atomic(
  p_transfer_id UUID,
  p_supplying_pharmacy_id UUID,
  p_actor_id UUID,
  p_approved_qty INT DEFAULT NULL,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cached JSONB;
  v_transfer stock_transfers%ROWTYPE;
  v_inv pharmacy_inventory%ROWTYPE;
  v_qty_to_approve INT;
  v_new_avail INT;
  v_new_res INT;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_payload INTO v_cached
    FROM transfer_idempotency_keys
    WHERE transfer_id = p_transfer_id AND action = 'APPROVE' AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_cached;
    END IF;
  END IF;

  SELECT * INTO v_transfer
  FROM stock_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_NOT_FOUND: Transfer % not found', p_transfer_id;
  END IF;

  IF v_transfer.supplying_pharmacy_id <> p_supplying_pharmacy_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Only supplying pharmacy may approve';
  END IF;

  IF v_transfer.status <> 'REQUESTED' THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot approve transfer in status %', v_transfer.status;
  END IF;

  v_qty_to_approve := COALESCE(p_approved_qty, v_transfer.requested_quantity);
  IF v_qty_to_approve <= 0 OR v_qty_to_approve > v_transfer.requested_quantity THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Approved quantity must be between 1 and %', v_transfer.requested_quantity;
  END IF;

  SELECT * INTO v_inv
  FROM pharmacy_inventory
  WHERE id = v_transfer.source_inventory_item_id
    AND pharmacy_id = p_supplying_pharmacy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_NOT_FOUND: Source inventory item missing';
  END IF;

  IF v_inv.expiry_date <= CURRENT_DATE THEN
    RAISE EXCEPTION 'INELIGIBLE_STOCK: Source batch is expired';
  END IF;

  IF v_inv.quantity_available < v_qty_to_approve THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: Available %, Requested %', v_inv.quantity_available, v_qty_to_approve;
  END IF;

  v_new_avail := v_inv.quantity_available - v_qty_to_approve;
  v_new_res := v_inv.quantity_reserved + v_qty_to_approve;

  UPDATE pharmacy_inventory
  SET quantity_available = v_new_avail,
      quantity_reserved = v_new_res,
      updated_at = now()
  WHERE id = v_inv.id;

  INSERT INTO inventory_audit_history (
    inventory_id, pharmacy_id, medicine_id, delta_quantity, previous_quantity,
    resulting_quantity, movement_type, reason, actor_id, reference_id, notes
  ) VALUES (
    v_inv.id, p_supplying_pharmacy_id, v_transfer.medicine_id, -v_qty_to_approve,
    v_inv.quantity_available, v_new_avail, 'RESERVATION', 'RESERVATION_HOLD',
    p_actor_id, p_transfer_id, 'Reserved for transfer ' || v_transfer.transfer_code
  );

  UPDATE stock_transfers
  SET status = 'APPROVED',
      approved_quantity = v_qty_to_approve,
      approved_by_user_id = p_actor_id,
      updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO transfer_events (transfer_id, previous_status, new_status, actor_user_id, event_type, notes)
  VALUES (p_transfer_id, 'REQUESTED', 'APPROVED', p_actor_id, 'TRANSFER_APPROVED', 'Approved quantity: ' || v_qty_to_approve);

  v_result := jsonb_build_object(
    'transferId', p_transfer_id,
    'status', 'APPROVED',
    'approvedQuantity', v_qty_to_approve
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO transfer_idempotency_keys (transfer_id, action, idempotency_key, response_payload)
    VALUES (p_transfer_id, 'APPROVE', p_idempotency_key, v_result);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic Reject RPC
CREATE OR REPLACE FUNCTION reject_stock_transfer_atomic(
  p_transfer_id UUID,
  p_supplying_pharmacy_id UUID,
  p_actor_id UUID,
  p_reason TEXT,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cached JSONB;
  v_transfer stock_transfers%ROWTYPE;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_payload INTO v_cached
    FROM transfer_idempotency_keys
    WHERE transfer_id = p_transfer_id AND action = 'REJECT' AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_cached; END IF;
  END IF;

  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND: Transfer % not found', p_transfer_id; END IF;
  IF v_transfer.supplying_pharmacy_id <> p_supplying_pharmacy_id THEN RAISE EXCEPTION 'FORBIDDEN: Only supplying pharmacy may reject'; END IF;
  IF v_transfer.status <> 'REQUESTED' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot reject transfer in status %', v_transfer.status; END IF;

  UPDATE stock_transfers
  SET status = 'REJECTED', rejection_reason = p_reason, updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO transfer_events (transfer_id, previous_status, new_status, actor_user_id, event_type, notes)
  VALUES (p_transfer_id, 'REQUESTED', 'REJECTED', p_actor_id, 'TRANSFER_REJECTED', p_reason);

  v_result := jsonb_build_object('transferId', p_transfer_id, 'status', 'REJECTED');
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO transfer_idempotency_keys (transfer_id, action, idempotency_key, response_payload)
    VALUES (p_transfer_id, 'REJECT', p_idempotency_key, v_result);
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atomic Dispatch RPC
CREATE OR REPLACE FUNCTION dispatch_stock_transfer_atomic(
  p_transfer_id UUID,
  p_supplying_pharmacy_id UUID,
  p_actor_id UUID,
  p_dispatch_ref VARCHAR DEFAULT NULL,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cached JSONB;
  v_transfer stock_transfers%ROWTYPE;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_payload INTO v_cached
    FROM transfer_idempotency_keys
    WHERE transfer_id = p_transfer_id AND action = 'DISPATCH' AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_cached; END IF;
  END IF;

  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND: Transfer % not found', p_transfer_id; END IF;
  IF v_transfer.supplying_pharmacy_id <> p_supplying_pharmacy_id THEN RAISE EXCEPTION 'FORBIDDEN: Only supplying pharmacy may dispatch'; END IF;
  IF v_transfer.status <> 'APPROVED' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot dispatch transfer in status %', v_transfer.status; END IF;

  UPDATE stock_transfers
  SET status = 'DISPATCHED',
      dispatched_at = now(),
      dispatched_by_user_id = p_actor_id,
      dispatch_reference = p_dispatch_ref,
      updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO transfer_events (transfer_id, previous_status, new_status, actor_user_id, event_type, notes)
  VALUES (p_transfer_id, 'APPROVED', 'DISPATCHED', p_actor_id, 'TRANSFER_DISPATCHED', COALESCE('Ref: ' || p_dispatch_ref, 'Dispatched'));

  v_result := jsonb_build_object('transferId', p_transfer_id, 'status', 'DISPATCHED', 'dispatchReference', p_dispatch_ref);
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO transfer_idempotency_keys (transfer_id, action, idempotency_key, response_payload)
    VALUES (p_transfer_id, 'DISPATCH', p_idempotency_key, v_result);
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Atomic Confirm Receipt & Settlement RPC (Deducts reserved at sender, credits receiver, handles discrepancy)
CREATE OR REPLACE FUNCTION receive_stock_transfer_atomic(
  p_transfer_id UUID,
  p_requesting_pharmacy_id UUID,
  p_actor_id UUID,
  p_received_qty INT,
  p_discrepancy_notes TEXT DEFAULT NULL,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cached JSONB;
  v_transfer stock_transfers%ROWTYPE;
  v_src_inv pharmacy_inventory%ROWTYPE;
  v_dst_inv_id UUID;
  v_dst_prev_qty INT := 0;
  v_dst_new_qty INT;
  v_has_discrepancy BOOLEAN := false;
  v_shortfall INT := 0;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_payload INTO v_cached
    FROM transfer_idempotency_keys
    WHERE transfer_id = p_transfer_id AND action = 'RECEIVE' AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_cached; END IF;
  END IF;

  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND: Transfer % not found', p_transfer_id; END IF;
  IF v_transfer.requesting_pharmacy_id <> p_requesting_pharmacy_id THEN RAISE EXCEPTION 'FORBIDDEN: Only receiving pharmacy may confirm receipt'; END IF;
  IF v_transfer.status <> 'DISPATCHED' THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot receive transfer in status %', v_transfer.status; END IF;

  IF p_received_qty < 0 OR p_received_qty > v_transfer.approved_quantity THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Received quantity must be between 0 and approved quantity %', v_transfer.approved_quantity;
  END IF;

  IF p_received_qty < v_transfer.approved_quantity THEN
    IF p_discrepancy_notes IS NULL OR length(trim(p_discrepancy_notes)) < 3 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: discrepancyNotes is required when receivedQuantity (%) differs from approvedQuantity (%)', p_received_qty, v_transfer.approved_quantity;
    END IF;
    v_has_discrepancy := true;
    v_shortfall := v_transfer.approved_quantity - p_received_qty;
  END IF;

  -- Lock source inventory and settle reservation
  SELECT * INTO v_src_inv
  FROM pharmacy_inventory
  WHERE id = v_transfer.source_inventory_item_id
  FOR UPDATE;

  IF v_src_inv.quantity_reserved < v_transfer.approved_quantity THEN
    RAISE EXCEPTION 'INVENTORY_INTEGRITY_ERROR: Reserved quantity smaller than approved transfer';
  END IF;

  UPDATE pharmacy_inventory
  SET quantity_reserved = quantity_reserved - v_transfer.approved_quantity,
      updated_at = now()
  WHERE id = v_src_inv.id;

  -- Sender audit record (settlement of dispatched/reserved stock)
  INSERT INTO inventory_audit_history (
    inventory_id, pharmacy_id, medicine_id, delta_quantity, previous_quantity,
    resulting_quantity, movement_type, reason, actor_id, reference_id, notes
  ) VALUES (
    v_src_inv.id, v_transfer.supplying_pharmacy_id, v_transfer.medicine_id,
    -v_transfer.approved_quantity, v_src_inv.quantity_available, v_src_inv.quantity_available,
    'ADJUSTMENT', 'TRANSFER_DISPATCH', p_actor_id, p_transfer_id,
    CASE WHEN v_has_discrepancy THEN 'Settled transfer ' || v_transfer.transfer_code || ' with shortfall ' || v_shortfall ELSE 'Settled transfer ' || v_transfer.transfer_code END
  );

  -- Credit receiving pharmacy inventory if p_received_qty > 0
  IF p_received_qty > 0 THEN
    SELECT id, quantity_available INTO v_dst_inv_id, v_dst_prev_qty
    FROM pharmacy_inventory
    WHERE pharmacy_id = p_requesting_pharmacy_id
      AND medicine_id = v_transfer.medicine_id
      AND batch_number = 'TR-' || v_transfer.transfer_code
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO pharmacy_inventory (
        pharmacy_id, medicine_id, batch_number, expiry_date,
        quantity_available, quantity_reserved, mrp, selling_price, reorder_threshold
      ) VALUES (
        p_requesting_pharmacy_id, v_transfer.medicine_id, 'TR-' || v_transfer.transfer_code,
        v_src_inv.expiry_date, p_received_qty, 0, v_src_inv.mrp, v_src_inv.selling_price, 10
      )
      RETURNING id INTO v_dst_inv_id;
      v_dst_prev_qty := 0;
      v_dst_new_qty := p_received_qty;
    ELSE
      v_dst_new_qty := v_dst_prev_qty + p_received_qty;
      UPDATE pharmacy_inventory
      SET quantity_available = v_dst_new_qty, updated_at = now()
      WHERE id = v_dst_inv_id;
    END IF;

    INSERT INTO inventory_audit_history (
      inventory_id, pharmacy_id, medicine_id, delta_quantity, previous_quantity,
      resulting_quantity, movement_type, reason, actor_id, reference_id, notes
    ) VALUES (
      v_dst_inv_id, p_requesting_pharmacy_id, v_transfer.medicine_id,
      p_received_qty, v_dst_prev_qty, v_dst_new_qty,
      'RESTOCK', 'TRANSFER_RECEIPT', p_actor_id, p_transfer_id,
      'Received transfer ' || v_transfer.transfer_code
    );
  END IF;

  UPDATE stock_transfers
  SET status = 'RECEIVED',
      received_at = now(),
      received_by_user_id = p_actor_id,
      received_quantity = p_received_qty,
      has_discrepancy = v_has_discrepancy,
      discrepancy_notes = p_discrepancy_notes,
      updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO transfer_events (transfer_id, previous_status, new_status, actor_user_id, event_type, notes)
  VALUES (
    p_transfer_id, 'DISPATCHED', 'RECEIVED', p_actor_id,
    CASE WHEN v_has_discrepancy THEN 'TRANSFER_RECEIVED_WITH_DISCREPANCY' ELSE 'TRANSFER_RECEIVED' END,
    COALESCE(p_discrepancy_notes, 'Received full quantity: ' || p_received_qty)
  );

  v_result := jsonb_build_object(
    'transferId', p_transfer_id,
    'status', 'RECEIVED',
    'receivedQuantity', p_received_qty,
    'hasDiscrepancy', v_has_discrepancy
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO transfer_idempotency_keys (transfer_id, action, idempotency_key, response_payload)
    VALUES (p_transfer_id, 'RECEIVE', p_idempotency_key, v_result);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Atomic Cancel & Reservation Release RPC
CREATE OR REPLACE FUNCTION cancel_stock_transfer_atomic(
  p_transfer_id UUID,
  p_actor_pharmacy_id UUID,
  p_actor_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cached JSONB;
  v_transfer stock_transfers%ROWTYPE;
  v_inv pharmacy_inventory%ROWTYPE;
  v_new_avail INT;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_payload INTO v_cached
    FROM transfer_idempotency_keys
    WHERE transfer_id = p_transfer_id AND action = 'CANCEL' AND idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_cached; END IF;
  END IF;

  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND: Transfer % not found', p_transfer_id; END IF;

  IF v_transfer.status = 'REQUESTED' THEN
    IF v_transfer.requesting_pharmacy_id <> p_actor_pharmacy_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Only requesting pharmacy may cancel a REQUESTED transfer';
    END IF;
  ELSIF v_transfer.status = 'APPROVED' THEN
    IF v_transfer.requesting_pharmacy_id <> p_actor_pharmacy_id
       AND v_transfer.supplying_pharmacy_id <> p_actor_pharmacy_id THEN
      RAISE EXCEPTION 'FORBIDDEN: Only participating pharmacies may cancel an APPROVED transfer';
    END IF;

    -- Release reserved stock back to available stock atomically
    SELECT * INTO v_inv FROM pharmacy_inventory WHERE id = v_transfer.source_inventory_item_id FOR UPDATE;
    v_new_avail := v_inv.quantity_available + v_transfer.approved_quantity;

    UPDATE pharmacy_inventory
    SET quantity_available = v_new_avail,
        quantity_reserved = GREATEST(0, quantity_reserved - v_transfer.approved_quantity),
        updated_at = now()
    WHERE id = v_inv.id;

    INSERT INTO inventory_audit_history (
      inventory_id, pharmacy_id, medicine_id, delta_quantity, previous_quantity,
      resulting_quantity, movement_type, reason, actor_id, reference_id, notes
    ) VALUES (
      v_inv.id, v_transfer.supplying_pharmacy_id, v_transfer.medicine_id,
      v_transfer.approved_quantity, v_inv.quantity_available, v_new_avail,
      'RESERVATION', 'RESERVATION_RELEASE', p_actor_id, p_transfer_id,
      'Released reservation due to cancellation of ' || v_transfer.transfer_code
    );
  ELSE
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Cannot cancel transfer in status %', v_transfer.status;
  END IF;

  UPDATE stock_transfers
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO transfer_events (transfer_id, previous_status, new_status, actor_user_id, event_type, notes)
  VALUES (p_transfer_id, v_transfer.status, 'CANCELLED', p_actor_id, 'TRANSFER_CANCELLED', COALESCE(p_reason, 'Cancelled'));

  v_result := jsonb_build_object('transferId', p_transfer_id, 'status', 'CANCELLED');
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO transfer_idempotency_keys (transfer_id, action, idempotency_key, response_payload)
    VALUES (p_transfer_id, 'CANCEL', p_idempotency_key, v_result);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RLS Policies for Collaboration Tables
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view own transfers" ON stock_transfers;
CREATE POLICY "Participants view own transfers"
  ON stock_transfers FOR SELECT
  TO authenticated
  USING (
    requesting_pharmacy_id IN (
      SELECT id FROM pharmacies WHERE owner_user_id = auth.uid()
      UNION SELECT pharmacy_id FROM pharmacy_staff WHERE user_id = auth.uid()
    )
    OR supplying_pharmacy_id IN (
      SELECT id FROM pharmacies WHERE owner_user_id = auth.uid()
      UNION SELECT pharmacy_id FROM pharmacy_staff WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants view own transfer events" ON transfer_events;
CREATE POLICY "Participants view own transfer events"
  ON transfer_events FOR SELECT
  TO authenticated
  USING (
    transfer_id IN (SELECT id FROM stock_transfers)
  );

GRANT ALL ON TABLE stock_transfers, transfer_events, transfer_idempotency_keys TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION
  approve_stock_transfer_atomic,
  reject_stock_transfer_atomic,
  dispatch_stock_transfer_atomic,
  receive_stock_transfer_atomic,
  cancel_stock_transfer_atomic
TO service_role;

COMMIT;
