-- Ensure public.users has expected profile columns used by frontend + dashboards.
-- This migration is intentionally idempotent to handle schema drift between environments.

alter table if exists public.users
  add column if not exists full_name text,
  add column if not exists avatar_url text;


