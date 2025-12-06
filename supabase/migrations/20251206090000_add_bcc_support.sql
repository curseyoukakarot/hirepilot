-- Add BCC support for scheduled messages and sequence enrollments
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS bcc TEXT;

ALTER TABLE public.sequence_enrollments
  ADD COLUMN IF NOT EXISTS bcc TEXT;

COMMENT ON COLUMN public.scheduled_messages.bcc IS 'Optional comma-separated list of BCC recipients for the scheduled send';
COMMENT ON COLUMN public.sequence_enrollments.bcc IS 'Optional comma-separated list of BCC recipients applied when this enrollment sends';

