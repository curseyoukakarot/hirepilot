-- ==========================================================================
-- Fix: provider_preference check constraint on sniper_settings
--
-- The original V1 migration only allowed ('airtop','local_playwright')
-- but the code now sets 'agentic_browser' when cloud engine is enabled.
-- Drop all check constraints on provider_preference and re-add with
-- the full set of valid values.
-- ==========================================================================

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
     WHERE con.conrelid = 'public.sniper_settings'::regclass
       AND attr.attname  = 'provider_preference'
       AND con.contype   = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.sniper_settings DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;
END $$;

ALTER TABLE public.sniper_settings
  ADD CONSTRAINT sniper_settings_provider_preference_check
    CHECK (provider_preference IN ('airtop', 'local_playwright', 'agentic_browser'));
