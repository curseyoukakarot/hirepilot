-- Add SendGrid domain authentication columns to custom_reply_domains
-- sendgrid_domain_auth_id: ID from POST /v3/whitelabel/domains, needed for validate/delete
-- dns_records: JSONB storing all DNS records (MX + 3 CNAMEs) for re-display in frontend

ALTER TABLE custom_reply_domains
  ADD COLUMN IF NOT EXISTS sendgrid_domain_auth_id BIGINT,
  ADD COLUMN IF NOT EXISTS dns_records JSONB;
