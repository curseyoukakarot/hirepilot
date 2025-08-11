-- Normalize Location and Source fields for leads
-- Safe to run multiple times (idempotent where practical)

-- Ensure location column exists (no-op if already present)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location TEXT;

-- Standardize enrichment_source to canonical labels
UPDATE leads
SET enrichment_source = CASE
  WHEN enrichment_source IS NULL THEN NULL
  WHEN lower(enrichment_source) = 'apollo' THEN 'Apollo'
  WHEN lower(enrichment_source) IN ('sales navigator','sales_navigator','phantombuster','phantom','salesnav','sales navigator (phantombuster)') THEN 'Sales Navigator'
  WHEN lower(enrichment_source) = 'chrome extension' THEN 'Chrome Extension'
  ELSE enrichment_source
END;

-- Standardize source to canonical labels (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'source'
  ) THEN
    UPDATE leads
    SET source = CASE
      WHEN source IS NULL THEN NULL
      WHEN lower(source) = 'apollo' THEN 'Apollo'
      WHEN lower(source) IN ('sales navigator','sales_navigator','phantombuster','phantom','salesnav','sales navigator (phantombuster)') THEN 'Sales Navigator'
      WHEN lower(source) = 'chrome extension' THEN 'Chrome Extension'
      ELSE source
    END;
  END IF;
END $$;

-- Infer enrichment_source from source/enrichment_data when missing
UPDATE leads
SET enrichment_source = 'Apollo'
WHERE (enrichment_source IS NULL OR enrichment_source = '')
  AND (
    (EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'leads' AND column_name = 'source'
    ) AND source ILIKE 'apollo')
    OR (enrichment_data::text IS NOT NULL AND enrichment_data::text ILIKE '%"source":"Apollo"%')
  );

-- Treat literal 'Unknown' as empty so we can backfill a better value
UPDATE leads
SET location = NULL
WHERE location ILIKE 'unknown';

-- Fill location from city/state/country if available
UPDATE leads
SET location = TRIM(BOTH ', ' FROM CONCAT_WS(', ', NULLIF(city, ''), NULLIF(state, ''), NULLIF(country, '')))
WHERE (location IS NULL OR location = '')
  AND (
    NULLIF(city, '') IS NOT NULL OR NULLIF(state, '') IS NOT NULL OR NULLIF(country, '') IS NOT NULL
  );

-- Fallback: use campaign_location if still empty
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'campaign_location'
  ) THEN
    UPDATE leads
    SET location = campaign_location
    WHERE (location IS NULL OR location = '')
      AND NULLIF(campaign_location, '') IS NOT NULL;
  END IF;
END $$;


