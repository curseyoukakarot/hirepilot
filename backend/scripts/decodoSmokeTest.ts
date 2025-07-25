import { fetchHtml } from '../src/lib/decodoProxy';
import pMap from 'p-map';

async function run() {
  const cookie = process.env.TEST_LI_COOKIE;
  const salesNavUrl = process.env.TEST_SALES_NAV;

  if (!cookie || !salesNavUrl) {
    console.error('TEST_LI_COOKIE and TEST_SALES_NAV env vars required');
    process.exit(1);
  }

  // Generate profile URLs (dummy leads params)
  const profileUrls = Array.from({ length: 50 }, (_, i) => `${salesNavUrl}&lead=${i}`);

  // First, scrape first 5 pages of Sales Navigator
  const pageUrls = Array.from({ length: 5 }, (_, i) => `${salesNavUrl}&page=${i + 1}`);
  await pMap(pageUrls, (u) => fetchHtml(u, `li_at=${cookie}`), { concurrency: 2 });

  // Scrape 50 profile URLs
  const results = await pMap(
    profileUrls,
    (u) => fetchHtml(u, `li_at=${cookie}`),
    { concurrency: 4 }
  );

  const failures = results.filter((r) => r.html.includes('captcha')).length;
  const avgSize = Math.round(results.reduce((a, r) => a + r.size, 0) / results.length);

  console.table({ failures, avgSize });

  if (failures > 2) {
    throw new Error('Failure rate > 5%');
  }
}

run().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
}); 