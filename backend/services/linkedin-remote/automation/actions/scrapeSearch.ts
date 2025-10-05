import { chromium } from 'playwright';
import { decryptFromBase64 } from '../../crypto/encryption';

export async function scrapeSearch(payload: { searchUrl: string; maxResults?: number }, cookiesEnc: string, proxyUrl?: string) {
  const cookies = JSON.parse(decryptFromBase64(cookiesEnc));
  const launchArgs: any = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (proxyUrl) {
    const u = new URL(proxyUrl);
    launchArgs.proxy = { server: `${u.protocol}//${u.host}`, username: u.username || undefined, password: u.password || undefined };
  }
  const browser = await chromium.launch(launchArgs);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addCookies(cookies.map((c: any) => ({
    name: c.name, value: c.value, domain: (c.domain || '').replace(/^\./,''), path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: (c.sameSite?.toLowerCase?.() as any) || 'Lax', expires: c.expires || -1
  })));
  const page = await ctx.newPage();
  await page.goto(payload.searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // Basic extraction for People search; SN support can be added later
  const leads: any[] = [];
  const max = Math.max(1, Math.min(Number(payload.maxResults || 25), 200));
  for (;;) {
    const items = await page.$$(`li.reusable-search__result-container, div.reusable-search__result-container, ul.reusable-search__entity-result-list > li`);
    for (const el of items) {
      const name = (await el.$eval('span[aria-hidden="true"]', n => (n as HTMLElement).innerText).catch(()=>'')) as string;
      const title = (await el.$eval('.entity-result__primary-subtitle', n => (n as HTMLElement).innerText).catch(()=>'')) as string;
      const company = (await el.$eval('.entity-result__secondary-subtitle', n => (n as HTMLElement).innerText).catch(()=>'')) as string;
      const href = (await el.$eval('a[href*="/in/"]', a => (a as HTMLAnchorElement).href).catch(()=>'')) as string;
      if (name && href) leads.push({ name, title, company, profileUrl: href });
      if (leads.length >= max) break;
    }
    if (leads.length >= max) break;
    const next = await page.$('button[aria-label="Next"], a[aria-label="Next"]');
    if (!next) break;
    await next.click().catch(()=>{});
    await page.waitForTimeout(1200 + Math.random()*800);
  }

  await browser.close();
  return { leads, count: leads.length };
}


