export type IntentWorkflow = {
  slug: string;
  title: string;
  category: string; // Use "Intent" for UI grouping
  description: string;
  input_schema: any;
  default_throttle?: any;
  default_credit_cost?: Record<string, number>;
  badges?: string[];
  visibility: 'public' | 'in_app_only';
  coming_soon?: boolean;
};

// New category label for UI
export const INTENT_CATEGORY = 'Intent';

export const INTENT_WORKFLOWS: IntentWorkflow[] = [
  // Public workflow cards
  {
    slug: 'sniper-linkedin-search',
    title: 'Sniper — LinkedIn: Scrape Search Results',
    category: INTENT_CATEGORY,
    description: 'Scrape profiles from a LinkedIn search URL or keyword query. Returns enriched leads (name, headline, company, location, snippet) and allows export or queueing for outreach.',
    input_schema: {
      search_type: ['linkedin_search','salesnav_url','custom_query'],
      search_value: 'string',
      max_results: 200,
      filters: { location: 'string', keywords: ['string'], min_followers: 'integer' },
      actions: { follow: 'boolean', dm: 'boolean', dm_template_id: 'string' },
      throttle_preset: ['conservative','balanced','aggressive']
    },
    default_throttle: { preset:'conservative', daily_limits:{ discover:200, follow:25, dm:10 }, jitter_seconds:[60,300], concurrency:1 },
    default_credit_cost: { discovery_per_profile:0.5, enrichment:1, follow:1, dm:3 },
    badges: ['Sniper','LinkedIn','Discovery'],
    visibility: 'public'
  },
  {
    slug: 'sniper-salesnav-search',
    title: 'Sniper — Sales Navigator: Scrape Search Results',
    category: INTENT_CATEGORY,
    description: 'Run a Sales Navigator search URL and return enriched prospects with seniority, company, and matching keywords. Ideal for account-based executive sourcing.',
    input_schema: {
      search_url: 'string',
      max_results: 300,
      filters: { seniority: 'string', company_size: 'string' },
      save_to_list: 'boolean',
      enrichment: 'boolean',
      throttle_preset: ['conservative','balanced','aggressive']
    },
    default_throttle: { preset:'conservative', daily_limits:{ discover:300, follow:25, dm:10 }, jitter_seconds:[60,300], concurrency:1 },
    default_credit_cost: { discovery_per_profile:0.6, enrichment:1, follow:1, dm:3 },
    badges: ['Sniper','SalesNavigator','ABM'],
    visibility: 'public'
  },
  {
    slug: 'sniper-x-search',
    title: 'Sniper — X: Leads from Search Results',
    category: INTENT_CATEGORY,
    description: 'Discover profiles from X (Twitter) using keywords, hashtags, and timeline search. Great for finding active commentators, VC signals, and podcast guests.',
    input_schema: {
      query: 'string',
      language: 'string',
      timeframe_days: 30,
      min_followers: 'integer',
      max_results: 500,
      throttle_preset: ['conservative','balanced','aggressive']
    },
    default_throttle: { preset:'conservative', daily_limits:{ discover:500, follow:25, dm:10 }, jitter_seconds:[60,300], concurrency:1 },
    default_credit_cost: { discovery_per_profile:0.3, enrichment:0.8, follow:1, dm:3 },
    badges: ['Sniper','X','Discovery'],
    visibility: 'public'
  },
  {
    slug: 'sniper-indeed-hiring-managers',
    title: 'Sniper — Indeed: Hiring Managers (Job Posters)',
    category: INTENT_CATEGORY,
    description: 'Scan job postings to surface likely hiring managers and the companies actively hiring for target roles. Exports contact targets and suggested outreach steps.',
    input_schema: {
      job_title: 'string',
      location: 'string',
      days_posted: 30,
      company_size: 'string',
      max_results: 500,
      throttle_preset: ['conservative','balanced','aggressive']
    },
    default_throttle: { preset:'conservative', daily_limits:{ discover:500 }, jitter_seconds:[120,400], concurrency:1 },
    default_credit_cost: { discovery_per_profile:0.4, enrichment:0.8 },
    badges: ['Sniper','Indeed','HiringIntent'],
    visibility: 'public'
  },
  {
    slug: 'sniper-ziprecruiter-hiring-managers',
    title: 'Sniper — ZipRecruiter: Hiring Managers (Job Posters)',
    category: INTENT_CATEGORY,
    description: 'Find hiring managers from ZipRecruiter job posts matching your role filters. Outputs candidate/company contacts and recommended next-step actions (LinkedIn open, export).',
    input_schema: {
      job_title: 'string',
      location: 'string',
      days_posted: 30,
      exclude_agencies: 'boolean',
      max_results: 500,
      throttle_preset: ['conservative','balanced','aggressive']
    },
    default_throttle: { preset:'conservative', daily_limits:{ discover:500 }, jitter_seconds:[120,400], concurrency:1 },
    default_credit_cost: { discovery_per_profile:0.4, enrichment:0.8 },
    badges: ['Sniper','ZipRecruiter','HiringIntent'],
    visibility: 'public'
  },

  // In-app only / Coming Soon
  {
    slug: 'sniper-linkedin-comments-likes',
    title: 'Sniper — LinkedIn: Scrape Comments & Likes',
    category: INTENT_CATEGORY,
    description: 'Harvest commentators and likers from a target LinkedIn post or author feed. Great for surfacing active voices and signal-rich prospects.',
    input_schema: { post_url:'string', include_commenters:'boolean', include_likers:'boolean', engagement_threshold:'integer', max_results:150, throttle_preset:['conservative','balanced','aggressive'] },
    default_throttle: { preset:'conservative', daily_limits:{ discover:150 }, jitter_seconds:[80,300], concurrency:1 },
    default_credit_cost: { discovery_per_profile:0.5, enrichment:1 },
    badges: ['Sniper','LinkedIn','ComingSoon'],
    visibility: 'in_app_only',
    coming_soon: true
  },
  {
    slug: 'sniper-linkedin-recruiter-search',
    title: 'Sniper — LinkedIn Recruiter: Scrape Search Results',
    category: INTENT_CATEGORY,
    description: 'Leverage LinkedIn Recruiter queries to extract high-value candidate lists (requires user Recruiter license). Enterprise-grade data with recruiter-only filters.',
    input_schema: { recruiter_url:'string', max_results:400, filters:{ seniority:'string', function:'string' }, enrichment:'boolean', throttle_preset:['conservative','balanced','aggressive'] },
    default_throttle: { preset:'conservative', daily_limits:{ discover:400, follow:25 }, jitter_seconds:[50,200], concurrency:1 },
    default_credit_cost: { discovery_per_profile:0.8, enrichment:1.5 },
    badges: ['Sniper','LinkedInRecruiter','ComingSoon'],
    visibility: 'in_app_only',
    coming_soon: true
  },
  {
    slug: 'sniper-x-follow-profiles',
    title: 'Sniper — X: Follow Profiles',
    category: INTENT_CATEGORY,
    description: 'Automate following of profiles discovered on X as part of a warm-up / engagement sequence. Includes undo (unfollow) and scheduler.',
    input_schema: { target_profile_ids:['string'], daily_cap:25, auto_unfollow_days:30, min_followers:'integer', throttle_preset:['conservative','balanced','aggressive'] },
    default_throttle: { preset:'conservative', daily_limits:{ follow:25 }, jitter_seconds:[60,300], concurrency:1 },
    default_credit_cost: { follow:1 },
    badges: ['Sniper','X','ComingSoon'],
    visibility: 'in_app_only',
    coming_soon: true
  },
  {
    slug: 'sniper-x-dm-profiles',
    title: 'Sniper — X: DM List of Profiles',
    category: INTENT_CATEGORY,
    description: 'Send personalized DMs to a selected list of X profiles. Human-in-loop gating required for first-run; personalization tokens supported.',
    input_schema: { target_profile_ids:['string'], template_id:'string', require_prior_engagement:'boolean', daily_cap:10, throttle_preset:['conservative','balanced','aggressive'] },
    default_throttle: { preset:'conservative', daily_limits:{ dm:10 }, jitter_seconds:[300,900], concurrency:1 },
    default_credit_cost: { dm:3 },
    badges: ['Sniper','X','ComingSoon'],
    visibility: 'in_app_only',
    coming_soon: true
  }
];

export function estimateDiscoveryCredits(w: IntentWorkflow): number | null {
  try {
    const per = w?.default_credit_cost?.discovery_per_profile;
    const max = Number((w?.input_schema || {}).max_results || 0);
    if (typeof per === 'number' && max > 0) return Math.round(per * max * 10) / 10;
    return null;
  } catch { return null; }
}


