import processPuppetJobs from '../api/puppet/processJobs';

// DEBUG env
console.log('[ENV]', process.env.SUPABASE_URL, !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mock Express Response for CLI usage
const resMock = {
  status: () => ({ json: console.log }),
  json: console.log,
} as any;

async function main() {
  await processPuppetJobs({} as any, resMock);
}

main().catch(err => {
  console.error('puppetJobRunner error:', err);
  process.exit(1);
}); 