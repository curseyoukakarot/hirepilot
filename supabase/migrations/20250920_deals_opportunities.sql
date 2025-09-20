-- Deals v1: opportunities, opportunity_job_reqs, opportunity_stages

CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT,
  value NUMERIC,
  billing_type TEXT,
  stage TEXT,
  status TEXT DEFAULT 'open',
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opps_owner ON public.opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opps_client ON public.opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_opps_stage ON public.opportunities(stage);

CREATE TABLE IF NOT EXISTS public.opportunity_job_reqs (
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  req_id UUID REFERENCES public.job_requisitions(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, req_id)
);

CREATE TABLE IF NOT EXISTS public.opportunity_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT,
  order_index INT
);

CREATE INDEX IF NOT EXISTS idx_opportunity_stages_team ON public.opportunity_stages(team_id);


