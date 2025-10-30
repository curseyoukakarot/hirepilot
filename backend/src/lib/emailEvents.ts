export enum LifecycleEventKey {
  Deals = 'feature_first_use.deals',
  REX = 'feature_first_use.rex_agent',
  Workflows = 'feature_first_use.workflows',
  CampaignWizard = 'feature_first_use.campaign_wizard',
  Integrations = 'feature_first_use.integrations',
  Founder = 'user_day1_checkin',
}

export enum DripEventKey {
  FreeCampaign = 'drip.free.campaign',
  FreeREX = 'drip.free.rex',
  FreeCSV = 'drip.free.csv',
  FreeExtension = 'drip.free.extension',
  FreeRequests = 'drip.free.requests',
  FreeLeads = 'drip.free.leads',

  PaidAgent = 'drip.paid.agent',
  PaidREX = 'drip.paid.rex',
  PaidDeals = 'drip.paid.deals',
  PaidLeads = 'drip.paid.leads',
  PaidCandidates = 'drip.paid.candidates',
  PaidREQs = 'drip.paid.reqs',
}


