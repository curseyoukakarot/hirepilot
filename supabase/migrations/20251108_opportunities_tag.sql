-- Add tag and updated_at columns to opportunities for classification and auditing
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS tag TEXT;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Optional index to filter by tag quickly in dashboards/workflows
CREATE INDEX IF NOT EXISTS idx_opportunities_tag ON public.opportunities(tag);


