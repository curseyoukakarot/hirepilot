-- Deals: add forecast_date to opportunities so users can forecast expected close dates

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS forecast_date DATE;

-- Optional index for sorting/filtering by expected close date
CREATE INDEX IF NOT EXISTS idx_opportunities_forecast_date ON public.opportunities(forecast_date);


