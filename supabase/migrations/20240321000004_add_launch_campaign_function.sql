-- Create function to handle campaign launch with leads
create or replace function public.launch_campaign(_cid uuid, _leads jsonb)
returns void
language plpgsql
security definer
as $$
begin
  -- Insert leads with campaign_id FK
  insert into leads (
    id,
    campaign_id,
    first_name,
    last_name,
    email,
    title,
    company,
    linkedin_url,
    city,
    state,
    country,
    apollo_id,
    is_unlocked,
    enriched_at,
    enrichment_data
  )
  select 
    (l->>'id')::uuid,
    _cid,
    l->>'first_name',
    l->>'last_name',
    l->>'email',
    l->>'title',
    l->>'company',
    l->>'linkedin_url',
    l->>'city',
    l->>'state',
    l->>'country',
    l->>'apollo_id',
    (l->>'is_unlocked')::boolean,
    (l->>'enriched_at')::timestamp with time zone,
    (l->'enrichment_data')::jsonb
  from jsonb_array_elements(_leads) as t(l);

  -- Update campaign status and counts
  update campaigns
  set 
    status = 'active',
    total_leads = jsonb_array_length(_leads),
    enriched_leads = (
      select count(*) 
      from jsonb_array_elements(_leads) as t(l) 
      where (l->>'is_unlocked')::boolean = true
    ),
    updated_at = now()
  where id = _cid;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.launch_campaign(uuid, jsonb) to authenticated;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema'; 