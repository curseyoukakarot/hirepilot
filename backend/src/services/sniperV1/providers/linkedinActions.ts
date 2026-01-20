import type { Page } from 'playwright';
import {
  openPost,
  expandAllComments,
  openReactionsDrawer,
  extractProfilesFromComments,
  extractProfilesFromReactions
} from '../../../lib/linkedin/helpers';

export type ProspectProfile = { name?: string | null; headline?: string | null; profile_url: string };

export async function prospectPostEngagersOnPage(page: Page, postUrl: string, limit: number): Promise<ProspectProfile[]> {
  await openPost(page, postUrl);
  await expandAllComments(page);
  // Comments first
  const fromComments = await extractProfilesFromComments(page, limit);
  const out: ProspectProfile[] = fromComments.map((p) => ({ name: p.name || null, headline: null, profile_url: p.linkedin_url }));

  if (out.length < limit) {
    await openReactionsDrawer(page);
    const fromReactions = await extractProfilesFromReactions(page, limit - out.length);
    for (const p of fromReactions) {
      out.push({ name: p.name || null, headline: null, profile_url: p.linkedin_url });
    }
  }

  // De-dupe by URL
  const seen = new Set<string>();
  return out.filter((p) => {
    const url = normalizeLinkedInProfileUrl(p.profile_url);
    if (!url) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    p.profile_url = url;
    return true;
  }).slice(0, limit);
}

export async function prospectPeopleSearchOnPage(page: Page, searchUrl: string, limit: number): Promise<ProspectProfile[]> {
  const url = String(searchUrl || '').trim();
  if (!/^https?:\/\//i.test(url) || !/linkedin\.com/i.test(url)) return [];

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Some search pages need a moment for results list to hydrate
  await page.waitForTimeout(1200).catch(() => {});

  const seen = new Set<string>();
  const out: ProspectProfile[] = [];

  async function collectOnce() {
    const links = await page
      .locator('a[href*="linkedin.com/in/"], a[href*="/in/"]')
      .evaluateAll((els) =>
        els
          .map((e) => (e instanceof HTMLAnchorElement ? e.href : ''))
          .filter(Boolean)
      )
      .catch(() => []);
    for (const href of links as any[]) {
      const normalized = normalizeLinkedInProfileUrl(String(href));
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push({ profile_url: normalized, name: null, headline: null });
      if (out.length >= limit) break;
    }
  }

  const maxPages = 25;
  let stableCycles = 0;
  for (let i = 0; i < maxPages && out.length < limit; i++) {
    const before = out.length;
    await collectOnce();

    if (out.length >= limit) break;

    // Try pagination next
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
        // fallback: try scrolling if pagination exists but disabled (infinite lists)
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
        await page.waitForTimeout(900).catch(() => {});
      }
    } else {
      // No pagination: scroll to load more
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await page.waitForTimeout(900).catch(() => {});
    }

    if (out.length === before) stableCycles += 1;
    else stableCycles = 0;
    if (stableCycles >= 3) break;
  }

  return out.slice(0, limit);
}

export async function prospectJobsFromSearchOnPage(page: Page, searchUrl: string, limit: number): Promise<Array<{ job_url: string; title?: string | null; company?: string | null; company_url?: string | null; location?: string | null }>> {
  const url = String(searchUrl || '').trim();
  if (!/^https?:\/\//i.test(url) || !/linkedin\.com/i.test(url)) return [];

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200).catch(() => {});

  const seen = new Set<string>();
  const out: Array<{ job_url: string; title?: string | null; company?: string | null; company_url?: string | null; location?: string | null }> = [];

  async function collectOnce() {
    const batch = await page
      .evaluate(() => {
        const results: Array<{ job_url: string; title?: string | null; company?: string | null; company_url?: string | null; location?: string | null }> = [];
        const anchors = Array.from(document.querySelectorAll('a[href*="/jobs/view/"]')) as HTMLAnchorElement[];
        for (const a of anchors) {
          const href = (a.href || '').split('?')[0].split('#')[0];
          if (!href) continue;
          const card = (a.closest('li') || a.closest('div')) as HTMLElement | null;
          const title =
            (card?.querySelector('span[aria-hidden="true"]') as HTMLElement | null)?.innerText?.trim() ||
            (a.textContent || '').trim() ||
            null;
          const companyEl =
            (card?.querySelector('a[href*="/company/"]') as HTMLAnchorElement | null) ||
            (card?.querySelector('.job-card-container__company-name') as HTMLAnchorElement | null);
          const company = (companyEl?.textContent || '').trim() || null;
          const company_url = companyEl?.href ? companyEl.href.split('?')[0].split('#')[0] : null;
          const locationEl =
            (card?.querySelector('.job-card-container__metadata-item') as HTMLElement | null) ||
            (card?.querySelector('.job-card-container__metadata-wrapper') as HTMLElement | null);
          const location = (locationEl?.textContent || '').trim() || null;
          results.push({ job_url: href, title, company, company_url, location });
        }
        return results;
      })
      .catch(() => []);

    for (const it of batch as any[]) {
      const href = String(it?.job_url || '').trim();
      if (!href) continue;
      const normalized = href.split('?')[0].split('#')[0];
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push({
        job_url: normalized,
        title: it?.title ?? null,
        company: it?.company ?? null,
        company_url: it?.company_url ?? null,
        location: it?.location ?? null
      });
      if (out.length >= limit) break;
    }
  }

  const maxScrolls = 30;
  let stableCycles = 0;
  for (let i = 0; i < maxScrolls && out.length < limit; i++) {
    const before = out.length;
    await collectOnce();
    if (out.length >= limit) break;

    // scroll jobs list if present, else page
    const scrolled = await page
      .evaluate(() => {
        const list =
          (document.querySelector('.jobs-search-results-list') as HTMLElement | null) ||
          (document.querySelector('div.jobs-search-results-list') as HTMLElement | null) ||
          (document.querySelector('[data-job-search-results-list]') as HTMLElement | null);
        const el = list || document.scrollingElement || document.documentElement;
        const prev = el.scrollTop;
        el.scrollTop = prev + 1200;
        return prev !== el.scrollTop;
      })
      .catch(() => false);

    if (!scrolled) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    }
    await page.waitForTimeout(900).catch(() => {});

    if (out.length === before) stableCycles += 1;
    else stableCycles = 0;
    if (stableCycles >= 4) break;
  }

  return out.slice(0, limit);
}

export async function sendConnectionRequestOnPage(
  page: Page,
  profileUrl: string,
  note?: string | null
): Promise<{ status: 'sent' | 'pending' | 'already_connected' | 'skipped' | 'failed'; details?: any }> {
  const url = normalizeLinkedInProfileUrl(profileUrl);
  if (!url) return { status: 'failed', details: { reason: 'invalid_profile_url' } };

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Quick already-connected/pending heuristics
  if (await page.locator('button:has-text("Pending")').first().count().catch(() => 0)) {
    return { status: 'pending' };
  }
  if (await page.locator('button:has-text("Message")').first().count().catch(() => 0)) {
    return { status: 'already_connected' };
  }

  // Primary: direct Connect button
  const connectBtn = page.locator('button:has-text("Connect")').first();
  const hasConnect = await connectBtn.count().catch(() => 0);
  if (hasConnect) {
    await connectBtn.click({ timeout: 5000 }).catch(() => {});
  } else {
    // Fallback: More → Connect
    const more = page.locator('button:has-text("More")').first();
    if (await more.count().catch(() => 0)) {
      await more.click({ timeout: 5000 }).catch(() => {});
      const menuConnect = page.locator('[role="menu"] >> text=Connect').first();
      if (await menuConnect.count().catch(() => 0)) {
        await menuConnect.click({ timeout: 5000 }).catch(() => {});
      } else {
        return { status: 'skipped', details: { reason: 'connect_not_available' } };
      }
    } else {
      return { status: 'skipped', details: { reason: 'connect_not_available' } };
    }
  }

  // If note present, try Add a note
  const trimmed = String(note || '').trim();
  if (trimmed) {
    const addNote = page.locator('button:has-text("Add a note")').first();
    if (await addNote.count().catch(() => 0)) {
      await addNote.click({ timeout: 5000 }).catch(() => {});
      // LinkedIn note textarea is often <textarea name="message"> or similar
      const textarea = page.locator('textarea').first();
      if (await textarea.count().catch(() => 0)) {
        await textarea.fill(trimmed.slice(0, 300)).catch(() => {});
      }
    }
  }

  // Send (varies: "Send", "Done")
  const send = page.locator('button:has-text("Send")').first();
  if (await send.count().catch(() => 0)) {
    await send.click({ timeout: 8000 }).catch(() => {});
    return { status: 'sent' };
  }
  const done = page.locator('button:has-text("Done")').first();
  if (await done.count().catch(() => 0)) {
    await done.click({ timeout: 8000 }).catch(() => {});
    return { status: 'sent' };
  }

  return { status: 'failed', details: { reason: 'send_button_missing' } };
}

export async function sendMessageOnPage(
  page: Page,
  profileUrl: string,
  message: string
): Promise<{ status: 'sent' | 'not_1st_degree' | 'skipped' | 'failed'; details?: any }> {
  const url = normalizeLinkedInProfileUrl(profileUrl);
  if (!url) return { status: 'failed', details: { reason: 'invalid_profile_url' } };
  const msg = String(message || '').trim();
  if (!msg) return { status: 'skipped', details: { reason: 'empty_message' } };

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Must be 1st-degree: Message button visible
  const messageBtn = page.locator('button:has-text("Message")').first();
  if (!(await messageBtn.count().catch(() => 0))) {
    return { status: 'not_1st_degree' };
  }
  await messageBtn.click({ timeout: 8000 }).catch(() => {});

  // Message composer: contenteditable div
  const box = page.locator('[role="textbox"][contenteditable="true"]').first();
  if (!(await box.count().catch(() => 0))) {
    // fallback: any role textbox
    const box2 = page.locator('[role="textbox"]').first();
    if (!(await box2.count().catch(() => 0))) return { status: 'failed', details: { reason: 'composer_missing' } };
    await box2.click({ timeout: 5000 }).catch(() => {});
    await box2.fill(msg).catch(() => {});
  } else {
    await box.click({ timeout: 5000 }).catch(() => {});
    await box.fill(msg).catch(() => {});
  }

  // Send: Enter key works for LinkedIn messaging by default
  await page.keyboard.press('Enter').catch(() => {});
  return { status: 'sent' };
}

export function normalizeLinkedInProfileUrl(input: string): string | null {
  const url = String(input || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  // strip query/hash, normalize to /in/
  const base = url.split('?')[0].split('#')[0];
  if (!/linkedin\.com\/in\//i.test(base)) return base; // allow other linkedIn profile-like urls
  return base;
}


