-- Deals: add contract fields to opportunities (start date, term, margin)

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS term_months INT,
  ADD COLUMN IF NOT EXISTS margin NUMERIC;

-- Constrain term_months to common contract options (nullable allowed)
DO $$
BEGIN
  ALTER TABLE public.opportunities
    ADD CONSTRAINT opportunities_term_months_check
    CHECK (term_months IS NULL OR term_months IN (1, 3, 6, 12));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_opportunities_start_date ON public.opportunities(start_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_term_months ON public.opportunities(term_months);

