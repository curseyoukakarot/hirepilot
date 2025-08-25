-- AI Agents: Sourcing System Migration
-- Rename Prospecting → Sourcing Agent with campaigns, leads, sequences, senders, and replies

-- Campaigns
CREATE TABLE IF NOT EXISTS sourcing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  audience_tag TEXT,
  created_by UUID,
  default_sender_id UUID,
  status TEXT DEFAULT 'draft', -- draft|scheduled|running|paused|completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads (rename from prospecting_leads if present)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='prospecting_leads') THEN
    ALTER TABLE prospecting_leads RENAME TO sourcing_leads;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sourcing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sourcing_campaigns(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  email TEXT,
  domain TEXT,
  enriched BOOLEAN DEFAULT FALSE,
  outreach_stage TEXT DEFAULT 'queued', -- queued|step1_sent|step2_sent|step3_sent|replied|bounced|unsubscribed
  reply_status TEXT, -- none|positive|neutral|negative|oos|auto
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sourcing_leads_email ON sourcing_leads(email);
CREATE INDEX IF NOT EXISTS idx_sourcing_leads_campaign ON sourcing_leads(campaign_id);

-- Sequences per campaign
CREATE TABLE IF NOT EXISTS sourcing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sourcing_campaigns(id) ON DELETE CASCADE,
  steps_json JSONB NOT NULL, -- {step1:{subject,body}, step2:{...}, step3:{...}, spacingBusinessDays:2}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email sender profiles
CREATE TABLE IF NOT EXISTS email_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'sendgrid',
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  domain_verified BOOLEAN DEFAULT FALSE,
  warmup_mode BOOLEAN DEFAULT TRUE,
  sendgrid_subuser TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Replies
CREATE TABLE IF NOT EXISTS sourcing_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sourcing_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES sourcing_leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,  -- inbound|outbound
  subject TEXT,
  body TEXT,
  email_from TEXT,
  email_to TEXT,
  sg_message_id TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  classified_as TEXT,       -- positive|neutral|negative|oos|auto
  next_action TEXT          -- reply|book|disqualify|hold
);

-- Agent runs table for REX integration
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending|running|completed|failed
  input_params JSONB,
  output_result JSONB,
  error_message TEXT,
  thread_key TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_type ON agent_runs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_thread_key ON agent_runs(thread_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_by ON agent_runs(created_by);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sourcing_campaigns_status ON sourcing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_campaigns_created_by ON sourcing_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_sourcing_leads_outreach_stage ON sourcing_leads(outreach_stage);
CREATE INDEX IF NOT EXISTS idx_sourcing_leads_reply_status ON sourcing_leads(reply_status);
CREATE INDEX IF NOT EXISTS idx_sourcing_sequences_campaign ON sourcing_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_senders_provider ON email_senders(provider);
CREATE INDEX IF NOT EXISTS idx_sourcing_replies_campaign ON sourcing_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_replies_lead ON sourcing_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_replies_direction ON sourcing_replies(direction);
CREATE INDEX IF NOT EXISTS idx_sourcing_replies_classified_as ON sourcing_replies(classified_as);

-- Add foreign key constraint for default_sender_id
ALTER TABLE sourcing_campaigns 
ADD CONSTRAINT fk_sourcing_campaigns_default_sender 
FOREIGN KEY (default_sender_id) REFERENCES email_senders(id);

-- Add comments for documentation
COMMENT ON TABLE sourcing_campaigns IS 'AI Agents: Sourcing campaigns with leads bucket and 3-step sequences';
COMMENT ON TABLE sourcing_leads IS 'AI Agents: Leads for sourcing campaigns with outreach tracking';
COMMENT ON TABLE sourcing_sequences IS 'AI Agents: Email sequences for sourcing campaigns';
COMMENT ON TABLE email_senders IS 'AI Agents: Email sender profiles for SendGrid integration';
COMMENT ON TABLE sourcing_replies IS 'AI Agents: Inbound/outbound email replies with classification';

-- Insert default email sender if none exists
INSERT INTO email_senders (from_name, from_email, domain_verified, warmup_mode)
SELECT 'HirePilot', 'no-reply@hirepilot.ai', FALSE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM email_senders WHERE from_email = 'no-reply@hirepilot.ai');

-- Campaign configuration: sender behavior and overrides
CREATE TABLE IF NOT EXISTS campaign_configs (
  campaign_id UUID PRIMARY KEY REFERENCES sourcing_campaigns(id) ON DELETE CASCADE,
  sender_behavior TEXT CHECK (sender_behavior IN ('single','rotate')) DEFAULT 'single',
  sender_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_configs_behavior ON campaign_configs(sender_behavior);
