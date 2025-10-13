-- Phase III: Candidate summary/soft skills + search MV; messaging analytics MVs

alter table if exists candidates
  add column if not exists summary text;

create table if not exists candidate_soft_skill (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  skill text not null
);

create index if not exists idx_candidate_skill_skill on candidate_skill(skill);
create index if not exists idx_candidate_soft_skill_skill on candidate_soft_skill(skill);
create index if not exists idx_candidate_tech_stack_tech on candidate_tech_stack(tech);

drop materialized view if exists candidate_search_mv;

create materialized view candidate_search_mv as
select
  c.id as candidate_id,
  setweight(to_tsvector('simple', coalesce(concat_ws(' ', c.first_name, c.last_name), '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(c.summary,'')), 'B') ||
  setweight(to_tsvector('simple', coalesce(cc.email,'')), 'C') ||
  setweight(to_tsvector('simple', coalesce(cc.linkedin_url,'')), 'C') ||
  setweight(to_tsvector('simple', coalesce(string_agg(distinct cs.skill, ' '), '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(string_agg(distinct css.skill, ' '), '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(string_agg(distinct ce.title || ' ' || coalesce(ce.company,''), ' '), '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(string_agg(distinct cts.tech, ' '), '')), 'B')
  as document
from candidates c
left join candidate_contact cc on cc.candidate_id = c.id
left join candidate_skill cs on cs.candidate_id = c.id
left join candidate_soft_skill css on css.candidate_id = c.id
left join candidate_experience ce on ce.candidate_id = c.id
left join candidate_tech_stack cts on cts.candidate_id = c.id
group by c.id, cc.email, cc.linkedin_url;

create index if not exists idx_candidate_search_mv on candidate_search_mv using gin (document);

drop materialized view if exists message_event_rollup;

create materialized view message_event_rollup as
select
  m.id as message_id,
  m.template_id,
  NULL::uuid as sequence_id,
  m.campaign_id,
  count(*) filter (where e.event_type = 'sent')   as sent,
  count(*) filter (where e.event_type = 'open')   as opens,
  count(*) filter (where e.event_type = 'reply')  as replies,
  count(*) filter (where e.event_type = 'bounce') as bounces
from messages m
left join email_events e on e.message_id = m.id::text
group by m.id, m.template_id, NULL::uuid, m.campaign_id;

create index if not exists idx_mer_template on message_event_rollup(template_id);
create index if not exists idx_mer_sequence on message_event_rollup(sequence_id);
create index if not exists idx_mer_campaign on message_event_rollup(campaign_id);

drop materialized view if exists template_performance_mv;

create materialized view template_performance_mv as
select
  template_id,
  sum(sent) as sent,
  sum(opens) as opens,
  sum(replies) as replies,
  sum(bounces) as bounces
from message_event_rollup
group by template_id;

create index if not exists idx_tpl_perf on template_performance_mv(template_id);

drop materialized view if exists sequence_performance_mv;

create materialized view sequence_performance_mv as
select
  sequence_id,
  sum(sent) as sent,
  sum(opens) as opens,
  sum(replies) as replies,
  sum(bounces) as bounces
from message_event_rollup
group by sequence_id;

create index if not exists idx_seq_perf on sequence_performance_mv(sequence_id);


