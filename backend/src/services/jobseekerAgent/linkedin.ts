import type { Page } from 'playwright';

export type PeopleSearchResult = {
  profile_url: string;
  name?: string | null;
  title?: string | null;
  location?: string | null;
};

export function buildPeopleSearchUrl(company: string | null, title: string) {
  const keywords = [title, company || ''].filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export async function collectPeopleSearchResultsOnPage(page: Page, searchUrl: string, limit: number): Promise<PeopleSearchResult[]> {
  const url = String(searchUrl || '').trim();
  if (!/^https?:\/\//i.test(url) || !/linkedin\.com/i.test(url)) return [];

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200).catch(() => {});

  const seen = new Set<string>();
  const out: PeopleSearchResult[] = [];

  async function collectOnce() {
    const batch = await page
      .evaluate(() => {
        const results: Array<{ profile_url: string; name?: string | null; title?: string | null; location?: string | null }> = [];
        const cards = Array.from(
          document.querySelectorAll('li.reusable-search__result-container, div.reusable-search__result-container, li.search-result')
        ) as HTMLElement[];
        for (const card of cards) {
          const anchor =
            (card.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null) ||
            (card.querySelector('a[href*="linkedin.com/in/"]') as HTMLAnchorElement | null);
          const profile_url = anchor?.href || '';
          if (!profile_url) continue;
          const nameEl =
            (card.querySelector('span.entity-result__title-text a span[aria-hidden="true"]') as HTMLElement | null) ||
            (card.querySelector('span.entity-result__title-text') as HTMLElement | null) ||
            (card.querySelector('span[aria-hidden="true"]') as HTMLElement | null);
          const titleEl =
            (card.querySelector('.entity-result__primary-subtitle') as HTMLElement | null) ||
            (card.querySelector('div.entity-result__primary-subtitle') as HTMLElement | null);
          const locationEl =
            (card.querySelector('.entity-result__secondary-subtitle') as HTMLElement | null) ||
            (card.querySelector('div.entity-result__secondary-subtitle') as HTMLElement | null);
          results.push({
            profile_url,
            name: (nameEl?.textContent || '').trim() || null,
            title: (titleEl?.textContent || '').trim() || null,
            location: (locationEl?.textContent || '').trim() || null
          });
        }
        return results;
      })
      .catch(() => []);

    for (const it of batch as any[]) {
      const href = String(it?.profile_url || '').split('?')[0].split('#')[0];
      if (!href) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      out.push({
        profile_url: href,
        name: it?.name ?? null,
        title: it?.title ?? null,
        location: it?.location ?? null
      });
      if (out.length >= limit) break;
    }
  }

  const maxPages = 25;
  let stableCycles = 0;
  for (let i = 0; i < maxPages && out.length < limit; i++) {
    const before = out.length;
    await collectOnce();
    if (out.length >= limit) break;

    const nextBtn = page.locator('button[aria-label="Next"]').first();
    const hasNext = await nextBtn.count().catch(() => 0);
    if (hasNext) {
      const disabled =
        (await nextBtn.getAttribute('disabled').catch(() => null)) !== null ||
        (await nextBtn.isDisabled().catch(() => false));
      if (!disabled) {
        await nextBtn.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1200).catch(() => {});
      } else {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
        await page.waitForTimeout(900).catch(() => {});
      }
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await page.waitForTimeout(900).catch(() => {});
    }

    if (out.length === before) stableCycles += 1;
    else stableCycles = 0;
    if (stableCycles >= 3) break;
  }

  return out.slice(0, limit);
}
