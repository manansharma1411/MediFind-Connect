-- ==============================================================================
-- MediFind Connect Migration: Initial Schema Template & PostGIS Setup
-- Migration: 20261125000000_initial_schema_template.sql
-- Author: Person B (Backend Lead)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Audit Trail Trigger Function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Schema definitions for business tables (profiles, pharmacies, inventory, transfers)
-- will be sequentially authored and reviewed in dedicated Phase 3 migrations.
