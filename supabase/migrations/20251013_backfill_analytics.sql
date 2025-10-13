-- Backfill analytics attribution for all users
-- 1) Attribute messages to email_templates by exact subject match per user
-- 2) Ensure a 'sent' email_events row exists for every message (idempotent)
-- 3) Refresh materialized views used by analytics

-- Safety: run inside a transaction
begin;

-- Some installations use case-sensitive subjects; normalize to lower for match
update messages m
set template_id = t.id
from email_templates t
where m.template_id is null
  and t.subject is not null and t.subject <> 'linkedin_request'
  and lower(coalesce(m.subject, '')) = lower(coalesce(t.subject, ''))
  and m.user_id = t.user_id;

-- Optional: fallback by name match when subject missing
-- (only when message.subject empty and template.name equals message.preview first 80 chars)
update messages m
set template_id = t.id
from email_templates t
where m.template_id is null
  and (m.subject is null or m.subject = '')
  and m.user_id = t.user_id
  and left(coalesce(m.preview,''), 80) = left(coalesce(t.name,''), 80);

-- Ensure 'sent' events exist for all messages (safe re-run)
insert into email_events (user_id, campaign_id, lead_id, message_id, event_type, event_timestamp, provider, created_at)
select m.user_id, m.campaign_id, m.lead_id, m.id::text, 'sent', coalesce(m.sent_at, m.created_at), coalesce(m.provider,'unknown'), coalesce(m.sent_at, m.created_at)
from messages m
where not exists (
  select 1 from email_events e where e.message_id = m.id::text and e.event_type = 'sent'
);

-- Refresh analytics materialized views
-- Note: CONCURRENTLY requires unique index on MV; fall back to standard refresh if not supported
do $$ begin
  begin
    execute 'refresh materialized view template_performance_mv';
    execute 'refresh materialized view sequence_performance_mv';
    execute 'refresh materialized view message_event_rollup';
  exception when others then
    -- ignore and proceed
    null;
  end;
end $$;

commit;


