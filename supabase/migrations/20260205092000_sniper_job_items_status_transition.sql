-- Transition sniper_job_items status constraint safely

-- 1) Widen constraint to allow legacy + new statuses
alter table public.sniper_job_items drop constraint if exists sniper_job_items_status_check;
alter table public.sniper_job_items add constraint sniper_job_items_status_check
check (status in (
  'queued','running',
  'success',
  'succeeded_verified','succeeded_noop_already_connected','succeeded_noop_already_pending',
  'failed_restricted','failed_verification',
  'paused_throttled','paused_cooldown',
  'skipped','failed'
));

-- 2) Backfill legacy statuses
update public.sniper_job_items
set status = 'succeeded_verified'
where status = 'success';

-- 3) Tighten constraint to new taxonomy only
alter table public.sniper_job_items drop constraint if exists sniper_job_items_status_check;
alter table public.sniper_job_items add constraint sniper_job_items_status_check
check (status in (
  'queued','running',
  'succeeded_verified','succeeded_noop_already_connected','succeeded_noop_already_pending',
  'failed_restricted','failed_verification',
  'paused_throttled','paused_cooldown',
  'skipped','failed'
));

