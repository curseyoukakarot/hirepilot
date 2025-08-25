import { Page } from 'playwright';

// Minimal stubs; replace with existing battle-tested implementations if present.
export async function openPost(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

export async function expandAllComments(page: Page) {
  // Expand comments buttons if present
  const selectors = ['button[aria-label*="Load more comments"]', 'button:has-text("View more comments")'];
  for (const selector of selectors) {
    const btn = await page.$(selector);
    if (btn) await btn.click().catch(() => {});
  }
}

export async function openReactionsDrawer(page: Page) {
  const selector = 'button[aria-label*="reactions"]';
  const btn = await page.$(selector);
  if (btn) await btn.click().catch(() => {});
}

export async function extractProfilesFromComments(page: Page, limit: number): Promise<Array<{ name: string; linkedin_url: string }>> {
  const results = await page.$$eval('a[href*="linkedin.com/in/"]', (anchors) => {
    const out: Array<{ name: string; linkedin_url: string }> = [];
    for (const a of anchors as HTMLAnchorElement[]) {
      const url = a.href;
      const name = (a.textContent || '').trim();
      if (url.includes('linkedin.com/in/') && name) out.push({ name, linkedin_url: url.split('?')[0] });
    }
    return out;
  });
  return Array.from(new Map(results.map(r => [r.linkedin_url, r])).values()).slice(0, limit);
}

export async function extractProfilesFromReactions(page: Page, limit: number): Promise<Array<{ name: string; linkedin_url: string }>> {
  // Fallback: reuse anchors on the page (drawer context)
  return extractProfilesFromComments(page, limit);
}

export async function humanPacingSleep(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

export async function searchKeywordAndOpenRecentPost(page: Page, keyword: string) {
  const url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&sortBy=%22date_posted%22`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Click first result
  const first = await page.$('a[href*="/feed/update/"]');
  if (first) await first.click();
}


