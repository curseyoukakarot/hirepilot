export const brightDataConfig = {
  apiToken: process.env.BRIGHTDATA_API_TOKEN,
  linkedinProfileScraperId: process.env.BRIGHTDATA_LINKEDIN_PROFILE_SCRAPER_ID,
  linkedinCompanyScraperId: process.env.BRIGHTDATA_LINKEDIN_COMPANY_SCRAPER_ID,
  linkedinJobsScraperId: process.env.BRIGHTDATA_LINKEDIN_JOBS_SCRAPER_ID,
  genericJobScraperId: process.env.BRIGHTDATA_GENERIC_JOB_SCRAPER_ID,
  unlockerEndpoint: process.env.BRIGHTDATA_UNLOCKER_ENDPOINT || 'https://unblock.brightdata.com/api/v1/requests',
  unlockerZone: process.env.BRIGHTDATA_UNLOCKER_ZONE,
  scraperTriggerUrl: process.env.BRIGHTDATA_SCRAPER_TRIGGER_URL || 'https://api.brightdata.com/dca/trigger',
  scraperResultsUrl: process.env.BRIGHTDATA_SCRAPER_RESULTS_URL || 'https://api.brightdata.com/dca/get_result',
  maxPollMs: Number(process.env.BRIGHTDATA_MAX_POLL_MS || 180_000),
  pollIntervalMs: Number(process.env.BRIGHTDATA_POLL_INTERVAL_MS || 4_000),
};

export function isBrightDataEnabled() {
  return Boolean(brightDataConfig.apiToken);
}

if (!brightDataConfig.apiToken) {
  console.warn('[BrightData] BRIGHTDATA_API_TOKEN is not set; Bright Data enrichment/sniper will be disabled.');
}

