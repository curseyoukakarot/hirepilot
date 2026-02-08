-- Fix ambiguous cooldown_until references in sniper usage RPC

create or replace function public.sniper_reserve_action_usage(
  p_user_id uuid,
  p_workspace_id uuid,
  p_day date,
  p_connect_delta integer default 0,
  p_message_delta integer default 0,
  p_profile_delta integer default 0,
  p_job_page_delta integer default 0,
  p_connect_limit integer default 20,
  p_message_limit integer default 100,
  p_profile_limit integer default 300,
  p_job_page_limit integer default 300,
  p_workspace_connect_limit integer default 200,
  p_workspace_message_limit integer default 500,
  p_workspace_profile_limit integer default 1500,
  p_workspace_job_page_limit integer default 1500,
  p_cooldown_until timestamptz default null
)
returns table(
  user_connects integer,
  user_messages integer,
  user_profiles integer,
  user_job_pages integer,
  workspace_connects integer,
  workspace_messages integer,
  workspace_profiles integer,
  workspace_job_pages integer,
  cooldown_until timestamptz
)
language plpgsql
as $$
declare
  u_connect integer;
  u_message integer;
  u_profile integer;
  u_job integer;
  w_connect integer;
  w_message integer;
  w_profile integer;
  w_job integer;
  cooldown_out timestamptz;
begin
  if coalesce(p_connect_delta,0) < 0 then p_connect_delta := 0; end if;
  if coalesce(p_message_delta,0) < 0 then p_message_delta := 0; end if;
  if coalesce(p_profile_delta,0) < 0 then p_profile_delta := 0; end if;
  if coalesce(p_job_page_delta,0) < 0 then p_job_page_delta := 0; end if;

  if (p_connect_delta + p_message_delta + p_profile_delta + p_job_page_delta) = 0 then
    select sad.connects_sent, sad.messages_sent, sad.profiles_visited, sad.job_pages_visited, sad.cooldown_until
      into u_connect, u_message, u_profile, u_job, cooldown_out
      from public.sniper_action_usage_daily as sad
      where sad.user_id = p_user_id and sad.workspace_id = p_workspace_id and sad.day = p_day;
    u_connect := coalesce(u_connect, 0);
    u_message := coalesce(u_message, 0);
    u_profile := coalesce(u_profile, 0);
    u_job := coalesce(u_job, 0);

    select swd.connects_sent, swd.messages_sent, swd.profiles_visited, swd.job_pages_visited, swd.cooldown_until
      into w_connect, w_message, w_profile, w_job, p_cooldown_until
      from public.sniper_workspace_usage_daily as swd
      where swd.workspace_id = p_workspace_id and swd.day = p_day;
    w_connect := coalesce(w_connect, 0);
    w_message := coalesce(w_message, 0);
    w_profile := coalesce(w_profile, 0);
    w_job := coalesce(w_job, 0);
    cooldown_out := greatest(coalesce(cooldown_out, 'epoch'::timestamptz), coalesce(p_cooldown_until, 'epoch'::timestamptz));
    return query select u_connect, u_message, u_profile, u_job, w_connect, w_message, w_profile, w_job, cooldown_out;
    return;
  end if;

  insert into public.sniper_action_usage_daily as sad (
    user_id, workspace_id, day,
    connects_sent, messages_sent, profiles_visited, job_pages_visited,
    last_action_at, cooldown_until
  ) values (
    p_user_id, p_workspace_id, p_day,
    p_connect_delta, p_message_delta, p_profile_delta, p_job_page_delta,
    now(), p_cooldown_until
  )
  on conflict (user_id, workspace_id, day) do update
    set connects_sent = public.sniper_action_usage_daily.connects_sent + excluded.connects_sent,
        messages_sent = public.sniper_action_usage_daily.messages_sent + excluded.messages_sent,
        profiles_visited = public.sniper_action_usage_daily.profiles_visited + excluded.profiles_visited,
        job_pages_visited = public.sniper_action_usage_daily.job_pages_visited + excluded.job_pages_visited,
        last_action_at = now(),
        cooldown_until = case
          when excluded.cooldown_until is null then public.sniper_action_usage_daily.cooldown_until
          else greatest(coalesce(public.sniper_action_usage_daily.cooldown_until, excluded.cooldown_until), excluded.cooldown_until)
        end
    where public.sniper_action_usage_daily.connects_sent + excluded.connects_sent <= p_connect_limit
      and public.sniper_action_usage_daily.messages_sent + excluded.messages_sent <= p_message_limit
      and public.sniper_action_usage_daily.profiles_visited + excluded.profiles_visited <= p_profile_limit
      and public.sniper_action_usage_daily.job_pages_visited + excluded.job_pages_visited <= p_job_page_limit
  returning sad.connects_sent, sad.messages_sent, sad.profiles_visited, sad.job_pages_visited, sad.cooldown_until
  into u_connect, u_message, u_profile, u_job, cooldown_out;

  if u_connect is null then
    select sad.connects_sent, sad.messages_sent, sad.profiles_visited, sad.job_pages_visited, sad.cooldown_until
      into u_connect, u_message, u_profile, u_job, cooldown_out
      from public.sniper_action_usage_daily as sad
      where sad.user_id = p_user_id and sad.workspace_id = p_workspace_id and sad.day = p_day;
    u_connect := coalesce(u_connect, 0);
    u_message := coalesce(u_message, 0);
    u_profile := coalesce(u_profile, 0);
    u_job := coalesce(u_job, 0);
    raise exception 'daily_user_limit_exceeded'
      using errcode = 'P0001', detail = json_build_object(
        'connects_sent', u_connect,
        'messages_sent', u_message,
        'profiles_visited', u_profile,
        'job_pages_visited', u_job
      )::text;
  end if;

  insert into public.sniper_workspace_usage_daily as swd (
    workspace_id, day,
    connects_sent, messages_sent, profiles_visited, job_pages_visited,
    last_action_at, cooldown_until
  ) values (
    p_workspace_id, p_day,
    p_connect_delta, p_message_delta, p_profile_delta, p_job_page_delta,
    now(), p_cooldown_until
  )
  on conflict (workspace_id, day) do update
    set connects_sent = public.sniper_workspace_usage_daily.connects_sent + excluded.connects_sent,
        messages_sent = public.sniper_workspace_usage_daily.messages_sent + excluded.messages_sent,
        profiles_visited = public.sniper_workspace_usage_daily.profiles_visited + excluded.profiles_visited,
        job_pages_visited = public.sniper_workspace_usage_daily.job_pages_visited + excluded.job_pages_visited,
        last_action_at = now(),
        cooldown_until = case
          when excluded.cooldown_until is null then public.sniper_workspace_usage_daily.cooldown_until
          else greatest(coalesce(public.sniper_workspace_usage_daily.cooldown_until, excluded.cooldown_until), excluded.cooldown_until)
        end
    where public.sniper_workspace_usage_daily.connects_sent + excluded.connects_sent <= p_workspace_connect_limit
      and public.sniper_workspace_usage_daily.messages_sent + excluded.messages_sent <= p_workspace_message_limit
      and public.sniper_workspace_usage_daily.profiles_visited + excluded.profiles_visited <= p_workspace_profile_limit
      and public.sniper_workspace_usage_daily.job_pages_visited + excluded.job_pages_visited <= p_workspace_job_page_limit
  returning swd.connects_sent, swd.messages_sent, swd.profiles_visited, swd.job_pages_visited, swd.cooldown_until
  into w_connect, w_message, w_profile, w_job, p_cooldown_until;

  if w_connect is null then
    select swd.connects_sent, swd.messages_sent, swd.profiles_visited, swd.job_pages_visited, swd.cooldown_until
      into w_connect, w_message, w_profile, w_job, p_cooldown_until
      from public.sniper_workspace_usage_daily as swd
      where swd.workspace_id = p_workspace_id and swd.day = p_day;
    w_connect := coalesce(w_connect, 0);
    w_message := coalesce(w_message, 0);
    w_profile := coalesce(w_profile, 0);
    w_job := coalesce(w_job, 0);
    raise exception 'daily_workspace_limit_exceeded'
      using errcode = 'P0001', detail = json_build_object(
        'connects_sent', w_connect,
        'messages_sent', w_message,
        'profiles_visited', w_profile,
        'job_pages_visited', w_job
      )::text;
  end if;

  cooldown_out := greatest(coalesce(cooldown_out, 'epoch'::timestamptz), coalesce(p_cooldown_until, 'epoch'::timestamptz));
  return query select u_connect, u_message, u_profile, u_job, w_connect, w_message, w_profile, w_job, cooldown_out;
end;
$$;

grant execute on function public.sniper_reserve_action_usage(
  uuid, uuid, date, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer, integer, integer,
  timestamptz
) to authenticated;
