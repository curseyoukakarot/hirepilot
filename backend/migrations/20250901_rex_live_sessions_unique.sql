-- Enforce one row per widget session
do $$ begin
  create unique index if not exists ux_rex_live_sessions_widget_session
    on rex_live_sessions (widget_session_id);
exception when others then
  -- If duplicates exist, this will fail; leave a log hint
  raise notice 'Unique index creation failed; ensure no duplicate widget_session_id rows exist.';
end $$;

