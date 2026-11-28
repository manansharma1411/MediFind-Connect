-- ==============================================================================
-- MediFind Connect Migration: Deduplicate verify_pharmacy_license_atomic RPC
-- Migration: 20261128000009_deduplicate_verify_pharmacy_rpc.sql
-- Author: Person B (Backend & Database Architect)
--
-- Problem:
--   20261128000006 created a 4-parameter verify_pharmacy_license_atomic(...).
--   20261128000008 created a 5-parameter overload with DEFAULT false, leaving
--   both overloads in pg_proc and causing PostgREST PGRST203 ambiguity errors.
--
-- Fix:
--   Safely drop ALL existing overloads of public.verify_pharmacy_license_atomic
--   inside a transaction (zero table/audit-log impact) and recreate ONE
--   canonical 5-parameter function matching SupabaseAdminVerificationRepository.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_sig TEXT;
BEGIN
  FOR v_sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'verify_pharmacy_license_atomic'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || v_sig;
  END LOOP;
END $$;

CREATE FUNCTION public.verify_pharmacy_license_atomic(
  p_pharmacy_id UUID,
  p_admin_user_id UUID,
  p_action VARCHAR,
  p_reason TEXT DEFAULT NULL,
  p_is_verified_admin BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_pharm pharmacies%ROWTYPE;
  v_new_status VARCHAR(30);
  v_is_verified BOOLEAN;
  v_is_db_admin BOOLEAN := false;
BEGIN
  IF p_action NOT IN ('APPROVE', 'REJECT') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: action must be APPROVE or REJECT';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM platform_administrators
    WHERE user_id = p_admin_user_id
      AND is_active = true
      AND role IN ('super_admin', 'network_admin', 'admin')
  ) INTO v_is_db_admin;

  IF NOT (v_is_db_admin OR COALESCE(p_is_verified_admin, false)) THEN
    RAISE EXCEPTION 'FORBIDDEN: Administrator privileges are required to verify pharmacies';
  END IF;

  SELECT * INTO v_pharm
  FROM pharmacies
  WHERE id = p_pharmacy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHARMACY_NOT_FOUND: Pharmacy % not found', p_pharmacy_id;
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

GRANT EXECUTE ON FUNCTION public.verify_pharmacy_license_atomic(UUID, UUID, VARCHAR, TEXT, BOOLEAN) TO service_role;

COMMIT;
