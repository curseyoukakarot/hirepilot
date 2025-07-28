import processPuppetJobs from '../api/puppet/processJobs';

async function main() {
  await processPuppetJobs({} as any, { json: console.log } as any);
}

main().catch(err => {
  console.error('puppetJobRunner error:', err);
  process.exit(1);
}); 