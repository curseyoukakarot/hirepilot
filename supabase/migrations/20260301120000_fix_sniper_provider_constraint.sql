-- ==========================================================================
-- Fix: Drop ALL check constraints on sniper_settings.provider column
-- and re-add with 'agentic_browser' support.
--
-- The original inline CHECK from 20260102220000 may have an auto-generated
-- name that doesn't match 'sniper_settings_provider_check', so the previous
-- migration's DROP CONSTRAINT IF EXISTS may have silently no-op'd.
-- This migration dynamically finds and drops ALL check constraints on the
-- provider column before re-adding the correct one.
-- ==========================================================================

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop every CHECK constraint that touches the 'provider' column
  FOR cname IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute  attr
        ON attr.attrelid = con.conrelid
       AND attr.attnum   = ANY(con.conkey)
     WHERE con.conrelid = 'public.sniper_settings'::regclass
       AND attr.attname  = 'provider'
       AND con.contype   = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.sniper_settings DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;
END $$;

-- Re-add with all three valid provider values
ALTER TABLE public.sniper_settings
  ADD CONSTRAINT sniper_settings_provider_check
    CHECK (provider IN ('airtop', 'extension_only', 'agentic_browser'));

-- Also ensure sniper_jobs constraint is correct
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute  attr
        ON attr.attrelid = con.conrelid
       AND attr.attnum   = ANY(con.conkey)
     WHERE con.conrelid = 'public.sniper_jobs'::regclass
       AND attr.attname  = 'provider'
       AND con.contype   = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.sniper_jobs DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;
END $$;

ALTER TABLE public.sniper_jobs
  ADD CONSTRAINT sniper_jobs_provider_check
    CHECK (provider IN ('airtop', 'local_playwright', 'agentic_browser'));

-- Force the user's settings row to 'agentic_browser' if cloud is enabled
UPDATE public.sniper_settings
   SET provider = 'agentic_browser'
 WHERE cloud_engine_enabled = true
   AND provider = 'airtop';
