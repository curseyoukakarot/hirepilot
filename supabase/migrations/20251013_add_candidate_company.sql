-- Add company column to candidates for CSV imports and UI display
alter table if exists public.candidates
  add column if not exists company text;


