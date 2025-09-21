-- Store enriched organization payload on clients for UI display
alter table if exists clients
  add column if not exists org_meta jsonb;

