-- ==============================================================================
-- MediFind Connect Migration: Admin Pharmacy Suspension & Reactivation RPC
-- Migration: 20261128000010_admin_pharmacy_suspension_rpc.sql
-- Author: Person B (Backend & Database Architect)
--
-- Notes:
--   - Reuses existing columns on `pharmacies` (is_active, verification_status,
--     verification_rejection_reason) and `pharmacy_verification_events`
--     (action IN ('SUSPEND', 'REOPEN')). No new tables or columns added.
--   - Never deletes pharmacy records or audit logs.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_pharmacy_operational_status_atomic(
  p_pharmacy_id UUID,
  p_admin_user_id UUID,
  p_action VARCHAR,
  p_reason TEXT,
  p_is_verified_admin BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_pharm pharmacies%ROWTYPE;
  v_new_status VARCHAR(30);
  v_new_active BOOLEAN;
  v_event_action VARCHAR(30);
  v_is_db_admin BOOLEAN := false;
BEGIN
  IF p_action NOT IN ('SUSPEND', 'REACTIVATE') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: action must be SUSPEND or REACTIVATE';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: A reason of at least 5 characters is required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM platform_administrators
    WHERE user_id = p_admin_user_id
      AND is_active = true
      AND role IN ('super_admin', 'network_admin', 'admin')
  ) INTO v_is_db_admin;

  IF NOT (v_is_db_admin OR COALESCE(p_is_verified_admin, false)) THEN
    RAISE EXCEPTION 'FORBIDDEN: Administrator privileges are required';
  END IF;

  SELECT * INTO v_pharm
  FROM pharmacies
  WHERE id = p_pharmacy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHARMACY_NOT_FOUND: Pharmacy % not found', p_pharmacy_id;
  END IF;

  IF p_action = 'SUSPEND' THEN
    v_new_status := 'SUSPENDED';
    v_new_active := false;
    v_event_action := 'SUSPEND';

    UPDATE pharmacies
    SET is_active = false,
        verification_status = 'SUSPENDED',
        verification_rejection_reason = trim(p_reason),
        updated_at = now()
    WHERE id = p_pharmacy_id;
  ELSE
    v_new_status := CASE WHEN v_pharm.is_licensed_verified THEN 'VERIFIED' ELSE 'PENDING' END;
    v_new_active := true;
    v_event_action := 'REOPEN';

    UPDATE pharmacies
    SET is_active = true,
        verification_status = v_new_status,
        verification_rejection_reason = NULL,
        updated_at = now()
    WHERE id = p_pharmacy_id;
  END IF;

  INSERT INTO pharmacy_verification_events (
    pharmacy_id, previous_status, new_status, action, admin_user_id, reason
  ) VALUES (
    p_pharmacy_id, v_pharm.verification_status, v_new_status, v_event_action, p_admin_user_id, trim(p_reason)
  );

  RETURN jsonb_build_object(
    'pharmacyId', p_pharmacy_id,
    'previousStatus', v_pharm.verification_status,
    'verificationStatus', v_new_status,
    'isActive', v_new_active,
    'isLicensedVerified', v_pharm.is_licensed_verified,
    'reason', trim(p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_pharmacy_operational_status_atomic(UUID, UUID, VARCHAR, TEXT, BOOLEAN) TO service_role;

COMMIT;
