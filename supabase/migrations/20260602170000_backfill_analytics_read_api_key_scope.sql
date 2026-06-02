-- Backfill the analytics:read scope onto existing API keys so that integrations
-- created before the Public Campaign Analytics API can call /v1/analytics
-- without being re-issued. Adds the scope only where it is missing (or null).
update public.api_keys
set scopes = array_append(
  coalesce(scopes, array['kanban:read','kanban:write','webhooks:manage']::text[]),
  'analytics:read'
)
where scopes is null
   or not ('analytics:read' = any(scopes));

-- Keep new keys (including any created directly via SQL) in sync with the
-- application default, which now grants analytics:read.
alter table public.api_keys
  alter column scopes set default array['kanban:read','kanban:write','webhooks:manage','analytics:read']::text[];
