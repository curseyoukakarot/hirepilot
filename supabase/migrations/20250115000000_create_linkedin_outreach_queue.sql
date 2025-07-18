-- Create a queue table to track and schedule LinkedIn connection requests sent via Phantombuster
create table linkedin_outreach_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  campaign_id uuid,
  linkedin_url text not null,
  message text check (char_length(message) <= 300),
  status text check (status in ('pending', 'sent', 'failed')) default 'pending',
  scheduled_at timestamp,
  sent_at timestamp,
  retry_count integer default 0,
  credit_cost integer default 20,
  phantom_agent_id text,
  created_at timestamp default now()
);

-- Add indexes for better performance
create index idx_linkedin_outreach_queue_user_id on linkedin_outreach_queue(user_id);
create index idx_linkedin_outreach_queue_campaign_id on linkedin_outreach_queue(campaign_id);
create index idx_linkedin_outreach_queue_status on linkedin_outreach_queue(status);
create index idx_linkedin_outreach_queue_scheduled_at on linkedin_outreach_queue(scheduled_at);

-- Add RLS policies
alter table linkedin_outreach_queue enable row level security;

-- Policy: Users can only see their own outreach queue items
create policy "Users can view own linkedin outreach queue items" on linkedin_outreach_queue
  for select using (auth.uid() = user_id);

-- Policy: Users can insert their own outreach queue items
create policy "Users can insert own linkedin outreach queue items" on linkedin_outreach_queue
  for insert with check (auth.uid() = user_id);

-- Policy: Users can update their own outreach queue items
create policy "Users can update own linkedin outreach queue items" on linkedin_outreach_queue
  for update using (auth.uid() = user_id); 