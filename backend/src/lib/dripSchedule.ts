export const dripCadence = {
  free: [
    { day: 0,  key: 'drip.free.campaign',  template: 'drip-free-campaign' },
    { day: 2,  key: 'drip.free.rex',       template: 'drip-free-rex' },
    { day: 4,  key: 'drip.free.csv',       template: 'drip-free-csv' },
    { day: 7,  key: 'drip.free.extension', template: 'drip-free-extension' },
    { day: 10, key: 'drip.free.requests',  template: 'drip-free-requests' },
    { day: 14, key: 'drip.free.leads',     template: 'drip-free-leads' },
  ],
  paid: [
    { day: 0,  key: 'drip.paid.agent',      template: 'drip-paid-agent' },
    { day: 2,  key: 'drip.paid.rex',        template: 'drip-paid-rex' },
    { day: 4,  key: 'drip.paid.deals',      template: 'drip-paid-deals' },
    { day: 7,  key: 'drip.paid.leads',      template: 'drip-paid-leads' },
    { day: 10, key: 'drip.paid.candidates', template: 'drip-paid-candidates' },
    { day: 14, key: 'drip.paid.reqs',       template: 'drip-paid-reqs' },
  ],
} as const;

export type DripPlan = keyof typeof dripCadence; // 'free' | 'paid'


