BEGIN;

-- Drop existing foreign key if it exists
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_campaign_id_fkey;

-- Ensure campaign_id column exists and is NOT NULL
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS campaign_id uuid NOT NULL;

-- Add proper foreign key constraint
ALTER TABLE public.leads
ADD CONSTRAINT leads_campaign_id_fkey
    FOREIGN KEY (campaign_id) 
    REFERENCES public.campaigns(id) 
    ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS leads_campaign_id_idx 
ON public.leads (campaign_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT; 