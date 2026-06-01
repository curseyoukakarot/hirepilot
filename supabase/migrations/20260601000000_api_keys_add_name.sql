-- Add a human-friendly label to API keys so Ignite users can name their keys
-- (e.g. "Zapier", "n8n agent", "Make.com"). Used by the Ignite Settings → API page.

alter table public.api_keys add column if not exists name text;
