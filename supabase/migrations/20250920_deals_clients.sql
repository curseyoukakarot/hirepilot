-- Deals v1: clients, contacts, deal_permissions
-- Uses gen_random_uuid(); ensure pgcrypto is enabled in a prior migration

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  domain TEXT,
  industry TEXT,
  revenue NUMERIC,
  location TEXT,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_owner ON public.clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_domain ON public.clients((lower(domain)));

-- Contacts (Decision Makers)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_client ON public.contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts((lower(email)));

-- Deal Permissions per user (booleans default false)
CREATE TABLE IF NOT EXISTS public.deal_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  can_view_clients BOOLEAN DEFAULT FALSE,
  can_view_opportunities BOOLEAN DEFAULT FALSE,
  can_view_billing BOOLEAN DEFAULT FALSE,
  can_view_revenue BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Simple trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_permissions_touch ON public.deal_permissions;
CREATE TRIGGER trg_deal_permissions_touch
BEFORE UPDATE ON public.deal_permissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


