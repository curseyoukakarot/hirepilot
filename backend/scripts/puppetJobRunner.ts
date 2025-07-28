import processPuppetJobs from '../api/puppet/processJobs';

// DEBUG: print env presence
console.log('[ENV]', process.env.SUPABASE_URL, !!process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  await processPuppetJobs({} as any, { json: console.log } as any);
}

main().catch(err => {
  console.error('puppetJobRunner error:', err);
  process.exit(1);
}); 