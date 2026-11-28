-- ==============================================================================
-- MediFind Connect Migration: Platform Administrators Role Table
-- Migration: 20261128000007_platform_administrators.sql
-- Author: Person B (Backend & Database Architect)
--
-- Security Notes:
--   - Stores explicitly authorized platform administrators by immutable auth.users(id).
--   - Never relies on email text alone or user-editable user_metadata.
--   - Strict RLS: anon and authenticated roles have ZERO direct table access.
--
-- Rollback Guidance:
--   DROP TABLE IF EXISTS platform_administrators CASCADE;
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS platform_administrators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'super_admin' CHECK (
    role IN ('super_admin', 'network_admin', 'admin')
  ),
  is_active BOOLEAN NOT NULL DEFAULT true,
  granted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_platform_administrators_timestamp ON platform_administrators;
CREATE TRIGGER set_platform_administrators_timestamp
  BEFORE UPDATE ON platform_administrators
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Strict RLS (service_role only)
ALTER TABLE platform_administrators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform_administrators FROM anon, authenticated;
GRANT ALL ON TABLE platform_administrators TO service_role;

-- Assign initial super_admin role to the explicitly authorized account (admin676@gmail.com)
-- Bound to its immutable auth.users.id UUID and sets app_metadata.role for JWT verification.
INSERT INTO platform_administrators (user_id, role, is_active, notes)
SELECT id, 'super_admin', true, 'Initial authorized platform super administrator'
FROM auth.users
WHERE lower(email) = 'admin676@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET role = 'super_admin',
    is_active = true,
    updated_at = now();

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'::jsonb
WHERE lower(email) = 'admin676@gmail.com';

COMMIT;
