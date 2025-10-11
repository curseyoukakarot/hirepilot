-- Idempotency keys for Zapier write actions
CREATE TABLE IF NOT EXISTS public.webhook_idem (
  idem_key text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_idem_seen ON public.webhook_idem(first_seen_at DESC);


