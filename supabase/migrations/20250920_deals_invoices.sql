-- Deals v1: invoices

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  billing_type TEXT,
  amount NUMERIC,
  status TEXT DEFAULT 'unbilled',
  sent_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  recipient_email TEXT,
  notes TEXT,
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_opportunity ON public.invoices(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);


