-- Ensure linkedin_sessions supports upsert(onConflict: 'user_id')
-- Some environments have linkedin_sessions without a unique constraint on user_id, which breaks upsert.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'linkedin_sessions'
  ) then
    -- Best-effort de-dupe: keep the most recently updated row per user_id
    begin
      with ranked as (
        select
          id,
          user_id,
          row_number() over (
            partition by user_id
            order by updated_at desc nulls last, created_at desc nulls last, id desc
          ) as rn
        from public.linkedin_sessions
      )
      delete from public.linkedin_sessions
      where id in (select id from ranked where rn > 1);
    exception when others then
      -- do not block deploy if schema differs
      null;
    end;

    -- Create unique index required for ON CONFLICT (user_id)
    begin
      execute 'create unique index if not exists idx_linkedin_sessions_user_id_unique on public.linkedin_sessions(user_id)';
    exception when others then
      null;
    end;
  end if;
end $$;


