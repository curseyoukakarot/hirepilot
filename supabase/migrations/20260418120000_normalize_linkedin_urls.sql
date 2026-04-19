-- Backfill/normalize LinkedIn profile URLs stored on leads/candidates.
--
-- Many leads imported from external sources have values like:
--   "linkedin.com/in/rachel-marketing"
--   "www.linkedin.com/in/rachel-marketing"
--   "http://linkedin.com/in/rachel-marketing/"
--   "https://www.linkedin.com/in/rachel-marketing?x=y"
--
-- These cause the Chrome extension "LinkedIn Request" flow to fail with
-- "Invalid LinkedIn URL" because the client uses new URL() which requires
-- an absolute URL. This migration canonicalizes all /in/ profile URLs to:
--   https://www.linkedin.com/in/<slug>
-- (strips trailing slash, query, fragment; forces https and www.)
--
-- Non-profile links (company pages, /jobs/, /learning/, etc.) are left
-- untouched.

CREATE OR REPLACE FUNCTION public.hp_canonicalize_linkedin_profile_url(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
  slug text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := btrim(raw);
  IF s = '' THEN RETURN NULL; END IF;

  -- Strip fragment/query
  s := split_part(s, '#', 1);
  s := split_part(s, '?', 1);

  -- Extract the /in/<slug> portion regardless of scheme/host prefixes.
  -- Captures alnum, hyphen, underscore, percent-encoded chars.
  slug := substring(s FROM '/in/([A-Za-z0-9\-_%\.]+)');
  IF slug IS NULL OR slug = '' THEN
    -- Not a profile URL (company/jobs/learning/etc) - leave as-is
    RETURN raw;
  END IF;

  -- Reject paths that include known non-profile segments
  IF s ILIKE '%/jobs/%' OR s ILIKE '%/company/%' OR s ILIKE '%/learning/%' THEN
    RETURN raw;
  END IF;

  RETURN 'https://www.linkedin.com/in/' || slug;
END;
$$;

-- Backfill leads.linkedin_url
UPDATE public.leads l
SET linkedin_url = public.hp_canonicalize_linkedin_profile_url(l.linkedin_url)
WHERE l.linkedin_url IS NOT NULL
  AND l.linkedin_url <> ''
  AND l.linkedin_url <> public.hp_canonicalize_linkedin_profile_url(l.linkedin_url)
  AND public.hp_canonicalize_linkedin_profile_url(l.linkedin_url) IS NOT NULL;

-- Backfill candidates.linkedin_url (column exists per 20250913120000_job_share_apply.sql)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'candidates'
      AND column_name = 'linkedin_url'
  ) THEN
    EXECUTE $q$
      UPDATE public.candidates c
      SET linkedin_url = public.hp_canonicalize_linkedin_profile_url(c.linkedin_url)
      WHERE c.linkedin_url IS NOT NULL
        AND c.linkedin_url <> ''
        AND c.linkedin_url <> public.hp_canonicalize_linkedin_profile_url(c.linkedin_url)
        AND public.hp_canonicalize_linkedin_profile_url(c.linkedin_url) IS NOT NULL;
    $q$;
  END IF;
END $$;

-- Backfill nested Apollo enrichment linkedin_url when it's stored as a bare/plain value.
-- Only touch rows where the nested value actually needs fixing and is resolvable.
UPDATE public.leads l
SET enrichment_data = jsonb_set(
      l.enrichment_data,
      '{apollo,linkedin_url}',
      to_jsonb(public.hp_canonicalize_linkedin_profile_url(l.enrichment_data->'apollo'->>'linkedin_url')),
      false
    )
WHERE l.enrichment_data ? 'apollo'
  AND (l.enrichment_data->'apollo') ? 'linkedin_url'
  AND (l.enrichment_data->'apollo'->>'linkedin_url') IS NOT NULL
  AND (l.enrichment_data->'apollo'->>'linkedin_url') <> ''
  AND public.hp_canonicalize_linkedin_profile_url(l.enrichment_data->'apollo'->>'linkedin_url') IS NOT NULL
  AND public.hp_canonicalize_linkedin_profile_url(l.enrichment_data->'apollo'->>'linkedin_url')
      <> (l.enrichment_data->'apollo'->>'linkedin_url');

-- Drop the helper; one-shot migration utility.
DROP FUNCTION IF EXISTS public.hp_canonicalize_linkedin_profile_url(text);
