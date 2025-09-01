export type RexMode = 'sales' | 'support' | 'rex';

export type RexSource = {
  title: string;
  url: string;
};

export type RexArticle = {
  title: string;
  excerpt: string;
  url: string;
};

export type RexMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  ts: number;
  sources?: RexSource[];
  typing?: boolean;
  tutorial?: { title: string; steps: string[] } | null;
  articles?: RexArticle[];
};

export type RexConfig = {
  demoUrl?: string;
  calendlyUrl?: string;
};

export type RexCta = {
  type: 'none' | 'link' | 'calendly' | 'lead_form' | 'support_ticket';
  label: string;
  url?: string;
  fields?: { name: string; label: string; type: string; required?: boolean }[];
};

export type RexWidgetProps = {
  mode?: RexMode;
  config?: RexConfig;
  className?: string;
  isLive?: boolean;
  liveStatus?: 'idle' | 'connecting' | 'online' | 'connected';
};

export type RexLeadInterest = 'Recruiting' | 'Sourcing' | 'Pricing' | 'Demo';

export type RexLeadPayload = {
  full_name: string;
  work_email: string;
  company?: string;
  interest?: RexLeadInterest;
  notes?: string;
  consentEmail?: boolean;
};


