-- Add weight_percent and order_index (if missing) to opportunity_stages
ALTER TABLE public.opportunity_stages
  ADD COLUMN IF NOT EXISTS weight_percent INT,
  ADD COLUMN IF NOT EXISTS order_index INT;


