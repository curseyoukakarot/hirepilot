-- Add Sales Navigator job types to sniper_jobs
ALTER TABLE public.sniper_jobs DROP CONSTRAINT IF EXISTS sniper_jobs_job_type_check;
ALTER TABLE public.sniper_jobs ADD CONSTRAINT sniper_jobs_job_type_check
  CHECK (job_type IN (
    'prospect_post_engagers',
    'send_connect_requests',
    'send_messages',
    'people_search',
    'jobs_intent',
    'sn_lead_search',
    'sn_send_connect',
    'sn_send_inmail',
    'sn_send_message'
  ));

-- Add 'inmail' action type to sniper_job_items
ALTER TABLE public.sniper_job_items DROP CONSTRAINT IF EXISTS sniper_job_items_action_type_check;
ALTER TABLE public.sniper_job_items ADD CONSTRAINT sniper_job_items_action_type_check
  CHECK (action_type IN ('connect', 'message', 'extract', 'inmail'));
