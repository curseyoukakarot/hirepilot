-- A) DB patch: add summary + soft skills; update search MV

-- 1) Candidate summary
alter table if exists candidates
  add column if not exists summary text;

-- 2) Optional soft skills table (distinct from technical skill tags)
create table if not exists candidate_soft_skill (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  skill text not null
);

-- 3) Index for skills to speed filters
create index if not exists idx_candidate_skill_skill on candidate_skill(skill);
create index if not exists idx_candidate_soft_skill_skill on candidate_soft_skill(skill);

-- 4) Update materialized view to include summary + soft skills in FTS
drop materialized view if exists candidate_search_mv;

create materialized view candidate_search_mv as
select
  c.id as candidate_id,
  setweight(to_tsvector('simple', coalesce(concat_ws(' ', c.first_name, c.last_name), '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(c.summary,'')), 'B') ||
  setweight(to_tsvector('simple', string_agg(distinct cs.skill, ' ')), 'B') ||
  setweight(to_tsvector('simple', string_agg(distinct css.skill, ' ')), 'C') ||
  setweight(to_tsvector('simple', string_agg(distinct ce.title || ' ' || coalesce(ce.company,''), ' ')), 'B') ||
  setweight(to_tsvector('simple', string_agg(distinct cts.tech, ' ')), 'B')
  as document
from candidates c
left join candidate_skill cs on cs.candidate_id = c.id
left join candidate_soft_skill css on css.candidate_id = c.id
left join candidate_experience ce on ce.candidate_id = c.id
left join candidate_tech_stack cts on cts.candidate_id = c.id
group by c.id;

create index idx_candidate_search_mv on candidate_search_mv using gin (document);

-- 5) Note: refresh should be scheduled (cron) every 5–10 minutes

