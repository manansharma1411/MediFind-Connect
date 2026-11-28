-- ==============================================================================
-- MediFind Connect Migration: Pharmacy License Verification Workflow & Audit Log
-- Migration: 20261128000006_pharmacy_verification_audit.sql
-- Author: Person B (Backend & Database Architect)
--
-- Rollback Guidance:
--   DROP FUNCTION IF EXISTS verify_pharmacy_license_atomic, prevent_verification_events_mutation;
--   DROP TABLE IF EXISTS pharmacy_verification_events CASCADE;
--   ALTER TABLE pharmacies
--     DROP COLUMN IF EXISTS verification_rejection_reason,
--     DROP COLUMN IF EXISTS verified_at,
--     DROP COLUMN IF EXISTS verified_by_user_id;
-- ==============================================================================

BEGIN;

-- 1. Extend pharmacies with verification metadata (does NOT auto-approve existing rows)
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Immutable Pharmacy Verification Audit Log
CREATE TABLE IF NOT EXISTS pharmacy_verification_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  previous_status VARCHAR(30) CHECK (
    previous_status IS NULL OR previous_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED')
  ),
  new_status VARCHAR(30) NOT NULL CHECK (
    new_status IN ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED')
  ),
  action VARCHAR(30) NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'SUSPEND', 'REOPEN')),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_verification_events_pharmacy
  ON pharmacy_verification_events (pharmacy_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_verification_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'pharmacy_verification_events is immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_verification_events_update ON pharmacy_verification_events;
CREATE TRIGGER trg_prevent_verification_events_update
  BEFORE UPDATE OR DELETE ON pharmacy_verification_events
  FOR EACH ROW EXECUTE FUNCTION prevent_verification_events_mutation();

-- 3. Atomic Admin Verification RPC (Row-locked, blocks self-approval, writes audit log)
CREATE OR REPLACE FUNCTION verify_pharmacy_license_atomic(
  p_pharmacy_id UUID,
  p_admin_user_id UUID,
  p_action VARCHAR,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_pharm pharmacies%ROWTYPE;
  v_new_status VARCHAR(30);
  v_is_verified BOOLEAN;
BEGIN
  IF p_action NOT IN ('APPROVE', 'REJECT') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: action must be APPROVE or REJECT';
  END IF;

  SELECT * INTO v_pharm
  FROM pharmacies
  WHERE id = p_pharmacy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHARMACY_NOT_FOUND: Pharmacy % not found', p_pharmacy_id;
  END IF;

  IF v_pharm.owner_user_id = p_admin_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Pharmacy owner cannot verify or reject their own pharmacy';
  END IF;

  IF p_action = 'APPROVE' THEN
    IF v_pharm.license_number IS NULL OR length(trim(v_pharm.license_number)) < 4 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Pharmacy must have a valid license_number before approval';
    END IF;
    v_new_status := 'VERIFIED';
    v_is_verified := true;

    UPDATE pharmacies
    SET verification_status = v_new_status,
        is_licensed_verified = v_is_verified,
        verification_rejection_reason = NULL,
        verified_at = now(),
        verified_by_user_id = p_admin_user_id,
        updated_at = now()
    WHERE id = p_pharmacy_id;
  ELSE
    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Rejection reason (at least 5 characters) is required';
    END IF;
    v_new_status := 'REJECTED';
    v_is_verified := false;

    UPDATE pharmacies
    SET verification_status = v_new_status,
        is_licensed_verified = v_is_verified,
        verification_rejection_reason = trim(p_reason),
        verified_at = NULL,
        verified_by_user_id = p_admin_user_id,
        updated_at = now()
    WHERE id = p_pharmacy_id;
  END IF;

  INSERT INTO pharmacy_verification_events (
    pharmacy_id, previous_status, new_status, action, admin_user_id, reason
  ) VALUES (
    p_pharmacy_id, v_pharm.verification_status, v_new_status, p_action, p_admin_user_id,
    CASE WHEN p_action = 'REJECT' THEN trim(p_reason) ELSE COALESCE(NULLIF(trim(p_reason), ''), 'License verified by administrator') END
  );

  RETURN jsonb_build_object(
    'pharmacyId', p_pharmacy_id,
    'previousStatus', v_pharm.verification_status,
    'verificationStatus', v_new_status,
    'isLicensedVerified', v_is_verified,
    'rejectionReason', CASE WHEN p_action = 'REJECT' THEN trim(p_reason) ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Strict RLS (No public/anon access; service_role only)
ALTER TABLE pharmacy_verification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pharmacy_verification_events FROM anon, authenticated;
GRANT ALL ON TABLE pharmacy_verification_events TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION verify_pharmacy_license_atomic TO service_role;

COMMIT;
