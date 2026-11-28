-- ==============================================================================
-- MediFind Connect Migration: Phase 8A Local Demand Intelligence
-- Migration: 20261128000005_demand_intelligence_schema.sql
-- Author: Person B (Backend & Database Architect)
--
-- Privacy & Architecture Notes:
--   - Stores ONLY coarse daily aggregated counts (no patient PII, no raw IP,
--     no user IDs, no raw free-text search queries, no exact event timestamps).
--   - `demand_dedup_window` stores only an ephemeral salted SHA-256 hash with a
--     short TTL (default 15 minutes) to prevent noisy duplicate increments.
--   - `cleanup_expired_demand_data_atomic` enforces retention for both dedup
--     keys and historical daily aggregates (default 90 days).
--
-- Rollback Guidance:
--   DROP FUNCTION IF EXISTS record_demand_signal_atomic, cleanup_expired_demand_data_atomic;
--   DROP TABLE IF EXISTS demand_aggregation_runs, demand_dedup_window, demand_daily_aggregates CASCADE;
-- ==============================================================================

BEGIN;

-- 1. Daily Aggregated Demand Metrics (Zero PII, Coarse Area & Day Bucket)
CREATE TABLE IF NOT EXISTS demand_daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_date DATE NOT NULL,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  area VARCHAR(120) NOT NULL DEFAULT 'UNKNOWN_AREA',
  city VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
  pincode_prefix VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
  search_outcome VARCHAR(32) NOT NULL CHECK (
    search_outcome IN ('MATCH_FOUND', 'NO_MATCH', 'NO_ELIGIBLE_NEARBY_STOCK', 'PARTIAL_AVAILABILITY')
  ),
  search_source VARCHAR(32) NOT NULL DEFAULT 'MEDICINE_SEARCH' CHECK (
    search_source IN ('MEDICINE_SEARCH', 'AVAILABILITY_CHECK', 'PRICE_COMPARISON')
  ),
  signal_count INT NOT NULL DEFAULT 0 CHECK (signal_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demand_daily_bucket_dims
  ON demand_daily_aggregates (
    bucket_date,
    COALESCE(medicine_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(area),
    lower(city),
    pincode_prefix,
    search_outcome,
    search_source
  );

CREATE INDEX IF NOT EXISTS idx_demand_daily_bucket_date
  ON demand_daily_aggregates (bucket_date DESC);

CREATE INDEX IF NOT EXISTS idx_demand_daily_medicine_date
  ON demand_daily_aggregates (medicine_id, bucket_date DESC)
  WHERE medicine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demand_daily_area_date
  ON demand_daily_aggregates (lower(area), lower(city), bucket_date DESC);

CREATE INDEX IF NOT EXISTS idx_demand_daily_outcome_date
  ON demand_daily_aggregates (search_outcome, bucket_date DESC);

DROP TRIGGER IF EXISTS set_demand_daily_aggregates_timestamp ON demand_daily_aggregates;
CREATE TRIGGER set_demand_daily_aggregates_timestamp
  BEFORE UPDATE ON demand_daily_aggregates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 2. Short-Lived Ephemeral Deduplication Window (Opaque Hash Only, Auto-Purged)
CREATE TABLE IF NOT EXISTS demand_dedup_window (
  signal_hash VARCHAR(64) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_dedup_expires_at
  ON demand_dedup_window (expires_at);

-- 3. Aggregation & Retention Run Metadata
CREATE TABLE IF NOT EXISTS demand_aggregation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type VARCHAR(40) NOT NULL CHECK (run_type IN ('RETENTION_CLEANUP', 'ROLLUP_VERIFY')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('COMPLETED', 'FAILED')),
  records_processed INT NOT NULL DEFAULT 0 CHECK (records_processed >= 0),
  records_purged INT NOT NULL DEFAULT 0 CHECK (records_purged >= 0),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 4. Atomic Signal Increment RPC (Always increments by exactly 1; deduplicates via TTL hash)
CREATE OR REPLACE FUNCTION record_demand_signal_atomic(
  p_bucket_date DATE,
  p_medicine_id UUID,
  p_area VARCHAR,
  p_city VARCHAR,
  p_pincode_prefix VARCHAR,
  p_search_outcome VARCHAR,
  p_search_source VARCHAR DEFAULT 'MEDICINE_SEARCH',
  p_dedup_hash VARCHAR DEFAULT NULL,
  p_dedup_ttl_seconds INT DEFAULT 900
)
RETURNS JSONB AS $$
DECLARE
  v_area VARCHAR(120);
  v_city VARCHAR(100);
  v_pin VARCHAR(10);
  v_inserted_dedup BOOLEAN := true;
BEGIN
  v_area := COALESCE(NULLIF(trim(p_area), ''), 'UNKNOWN_AREA');
  v_city := COALESCE(NULLIF(trim(p_city), ''), 'UNKNOWN');
  v_pin := COALESCE(NULLIF(trim(p_pincode_prefix), ''), 'UNKNOWN');

  -- Purge opportunistically if hash exists and is expired
  IF p_dedup_hash IS NOT NULL AND length(trim(p_dedup_hash)) > 0 THEN
    DELETE FROM demand_dedup_window
    WHERE signal_hash = p_dedup_hash AND expires_at <= now();

    INSERT INTO demand_dedup_window (signal_hash, expires_at)
    VALUES (p_dedup_hash, now() + make_interval(secs => GREATEST(60, LEAST(86400, p_dedup_ttl_seconds))))
    ON CONFLICT (signal_hash) DO NOTHING;

    IF NOT FOUND THEN
      v_inserted_dedup := false;
    END IF;
  END IF;

  IF NOT v_inserted_dedup THEN
    RETURN jsonb_build_object('recorded', false, 'deduplicated', true);
  END IF;

  INSERT INTO demand_daily_aggregates (
    bucket_date, medicine_id, area, city, pincode_prefix,
    search_outcome, search_source, signal_count
  ) VALUES (
    p_bucket_date, p_medicine_id, v_area, v_city, v_pin,
    p_search_outcome, p_search_source, 1
  )
  ON CONFLICT (
    bucket_date,
    COALESCE(medicine_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(area),
    lower(city),
    pincode_prefix,
    search_outcome,
    search_source
  )
  DO UPDATE SET
    signal_count = demand_daily_aggregates.signal_count + 1,
    updated_at = now();

  RETURN jsonb_build_object('recorded', true, 'deduplicated', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Retention & Cleanup RPC (Purges expired dedup keys and aged aggregates)
CREATE OR REPLACE FUNCTION cleanup_expired_demand_data_atomic(
  p_retention_days INT DEFAULT 90
)
RETURNS JSONB AS $$
DECLARE
  v_dedup_purged INT := 0;
  v_agg_purged INT := 0;
  v_cutoff DATE;
BEGIN
  IF p_retention_days < 7 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: retention_days must be at least 7';
  END IF;

  v_cutoff := (now() AT TIME ZONE 'Asia/Kolkata')::date - p_retention_days;

  DELETE FROM demand_dedup_window WHERE expires_at <= now();
  GET DIAGNOSTICS v_dedup_purged = ROW_COUNT;

  DELETE FROM demand_daily_aggregates WHERE bucket_date < v_cutoff;
  GET DIAGNOSTICS v_agg_purged = ROW_COUNT;

  INSERT INTO demand_aggregation_runs (
    run_type, status, records_processed, records_purged, notes, completed_at
  ) VALUES (
    'RETENTION_CLEANUP',
    'COMPLETED',
    v_dedup_purged + v_agg_purged,
    v_dedup_purged + v_agg_purged,
    'Purged expired dedup keys and aggregates older than ' || v_cutoff::text,
    now()
  );

  RETURN jsonb_build_object(
    'dedupPurged', v_dedup_purged,
    'aggregatesPurged', v_agg_purged,
    'cutoffDate', v_cutoff
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Strict RLS Policies (No public/anon access; backend service_role enforces k-anonymity)
ALTER TABLE demand_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_dedup_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_aggregation_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE demand_daily_aggregates, demand_dedup_window, demand_aggregation_runs FROM anon, authenticated;
GRANT ALL ON TABLE demand_daily_aggregates, demand_dedup_window, demand_aggregation_runs TO service_role;
GRANT EXECUTE ON FUNCTION record_demand_signal_atomic, cleanup_expired_demand_data_atomic TO service_role;

COMMIT;
