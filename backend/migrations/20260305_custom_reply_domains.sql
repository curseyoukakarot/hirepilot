-- Custom reply domains for whitelabel reply tracking
-- Allows users to use their own domain (e.g., reply.ignitegtm.com)
-- instead of reply.thehirepilot.com for Reply-To addresses.

CREATE TABLE IF NOT EXISTS custom_reply_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | failed
  verification_token TEXT NOT NULL,
  mx_verified BOOLEAN DEFAULT FALSE,
  sendgrid_registered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  CONSTRAINT uq_custom_reply_domain UNIQUE (domain),
  CONSTRAINT uq_custom_reply_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_reply_domains_user ON custom_reply_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_reply_domains_domain ON custom_reply_domains(domain);
