import type { Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import {
  openPost,
  expandAllComments,
  openReactionsDrawer,
  extractProfilesFromComments,
  extractProfilesFromReactions
} from '../../../lib/linkedin/helpers';

export type ProspectProfile = { name?: string | null; headline?: string | null; profile_url: string };
type ConnectionState = 'connected' | 'pending' | 'not_connected' | 'restricted' | 'unknown';
type ConnectEntrypoint = { strategyUsed: string; click: () => Promise<boolean> };
type ActionDebug = { jobId?: string | null; enabled?: boolean };

const SNIPER_ARTIFACTS_DIR = String(process.env.SNIPER_ARTIFACTS_DIR || '/tmp/hirepilot/sniper');

async function ensureArtifactsDir() {
  await fs.mkdir(SNIPER_ARTIFACTS_DIR, { recursive: true }).catch(() => {});
}

function shouldDebug(debug?: ActionDebug) {
  if (debug?.enabled) return true;
  const envJobId = String(process.env.SNIPER_DEBUG_JOB_ID || '').trim();
  return Boolean(debug?.jobId && envJobId && debug.jobId === envJobId);
}

function logDebug(debug: ActionDebug | undefined, payload: Record<string, any>) {
  if (!shouldDebug(debug)) return;
  const msg = { ts: new Date().toISOString(), scope: 'sniper', ...payload };
  // eslint-disable-next-line no-console
  console.info(JSON.stringify(msg));
}

async function captureScreenshot(page: Page, slug: string): Promise<string | null> {
  try {
    await ensureArtifactsDir();
    const name = `${slug}-${Date.now()}.png`;
    const full = path.join(SNIPER_ARTIFACTS_DIR, name);
    await page.screenshot({ path: full, fullPage: true }).catch(() => {});
    return full;
  } catch {
    return null;
  }
}

async function captureDomSnippet(page: Page, maxChars = 2000): Promise<string | null> {
  try {
    const main = page.locator('main').first();
    const text = await main.innerText().catch(() => '');
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxChars);
  } catch {
    return null;
  }
}
async function waitForCondition(fn: () => Promise<boolean>, timeoutMs = 8000, pollMs = 400): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

export function isAuthWallUrl(url: string): boolean {
  return /linkedin\.com\/(login|checkpoint|authwall)/i.test(url);
}

export async function waitForProfileReady(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1200).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
}

async function hasText(page: Page, pattern: RegExp): Promise<boolean> {
  const locator = page.locator(`text=${pattern}`);
  return (await locator.count().catch(() => 0)) > 0;
}

export async function detectConnectionState(page: Page): Promise<ConnectionState> {
  const pending = await page.locator('button', { hasText: /^Pending$/ }).count().catch(() => 0);
  if (pending) return 'pending';
  const invited = await page.locator('button', { hasText: /^Invited$/ }).count().catch(() => 0);
  if (invited) return 'pending';
  const connected = await page.locator('button', { hasText: /^Message$/ }).count().catch(() => 0);
  if (connected) return 'connected';
  const restrictedPatterns = [
    /can't connect/i,
    /can’t connect/i,
    /not accepting invitations/i,
    /invitations are restricted/i,
    /account restricted/i,
    /weekly invitation limit/i,
    /try again later/i
  ];
  for (const pattern of restrictedPatterns) {
    if (await hasText(page, pattern)) return 'restricted';
  }
  return 'not_connected';
}

async function detectBlockReason(page: Page): Promise<string | null> {
  if (await hasText(page, /weekly invitation limit/i)) return 'weekly_limit';
  if (await hasText(page, /try again later/i)) return 'rate_limited';
  if (await hasText(page, /account restricted/i)) return 'account_restricted';
  return null;
}

export async function findConnectEntrypoint(page: Page): Promise<ConnectEntrypoint | null> {
  // Scope to top-card area to avoid sidebar "People you may know" Connect buttons (mirrors Chrome extension)
  const TOP_CARD = '.pv-top-card, .profile-topcard, section.pv-top-card, .pv-top-card-v2-ctas, [data-view-name="profile-card"]';

  async function getRoot() {
    const topCard = page.locator(TOP_CARD).first();
    if (await topCard.count().catch(() => 0)) return topCard;
    return page.locator('body');
  }

  // Retry loop: Chrome extension uses 8 attempts with 700ms waits between failures
  for (let attempt = 0; attempt < 8; attempt++) {
    const root = await getRoot();

    // ─── Strategy 1: Direct Connect/Invite button (exact text match) ───
    const directBtn = root.locator(
      [
        'button:text-matches("^Connect$", "i")',
        'button:text-matches("^Invite$", "i")',
        'button[aria-label*="Connect"]',
        'button[aria-label*="Invite"]',
        'button[data-control-name="connect"]',
        '[data-tracking-control-name="connect"] button',
        'div[role="button"]:text-matches("^Connect$", "i")',
        'a:text-matches("^Connect$", "i")',
      ].join(', ')
    ).first();

    if (await directBtn.count().catch(() => 0)) {
      return {
        strategyUsed: `direct:attempt_${attempt}`,
        click: async () => {
          await directBtn.scrollIntoViewIfNeeded().catch(() => {});
          return !!(await directBtn.click({ timeout: 8000 }).then(() => true).catch(() => false));
        },
      };
    }

    // ─── Strategy 2: Open "More" dropdown, then find Connect inside ───
    const moreBtn = root.locator(
      [
        'button:text-matches("^More$", "i")',
        'button[aria-label="More actions"]',
        'button[aria-label*="More actions"]',
        'button[aria-label*="More"]',
        'button.artdeco-dropdown__trigger[aria-haspopup="menu"]',
      ].join(', ')
    ).first();

    if (await moreBtn.count().catch(() => 0)) {
      // Check if already expanded from a prior attempt
      const isExpanded = (await moreBtn.getAttribute('aria-expanded').catch(() => null)) === 'true';
      if (!isExpanded) {
        await moreBtn.scrollIntoViewIfNeeded().catch(() => {});
        await moreBtn.click({ timeout: 8000 }).catch(() => {});
        // Wait for dropdown animation — Chrome extension waits 500 + random(300)ms
        await page.waitForTimeout(500 + Math.floor(Math.random() * 300));
      }

      // Search for Connect in dropdown menu (GLOBAL scope — menu DOM may render outside top card)
      const menuConnect = page.locator(
        [
          'div[role="menu"] div[role="menuitem"]:text-matches("connect|invite", "i")',
          'div[role="menu"] li:text-matches("connect|invite", "i")',
          'div[role="menu"] button:text-matches("connect|invite", "i")',
          'div[role="menu"] span:text-matches("^Connect$", "i")',
          'ul[role="menu"] div[role="menuitem"]:text-matches("connect|invite", "i")',
          '.artdeco-dropdown__content div[role="menuitem"]:text-matches("connect|invite", "i")',
          '.artdeco-dropdown__content button:text-matches("connect|invite", "i")',
          '.artdeco-dropdown__content-inner div[role="menuitem"]:text-matches("connect|invite", "i")',
        ].join(', ')
      ).first();

      if (await menuConnect.count().catch(() => 0)) {
        return {
          strategyUsed: `more_menu:attempt_${attempt}`,
          click: async () => {
            // Menu is already open — just click the Connect item
            await menuConnect.click({ timeout: 8000 }).catch(() => {});
            return true;
          },
        };
      }

      // Close the dropdown before retrying
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }

    // ─── Strategy 3: Brute-force search for any Connect-like element ───
    const bruteBtn = root.locator(
      [
        'button:text-matches("connect|invite", "i")',
        'a:text-matches("connect|invite", "i")',
        '[role="menuitem"]:text-matches("connect|invite", "i")',
        '[role="button"]:text-matches("connect|invite", "i")',
      ].join(', ')
    ).first();

    if (await bruteBtn.count().catch(() => 0)) {
      return {
        strategyUsed: `brute:attempt_${attempt}`,
        click: async () => {
          await bruteBtn.scrollIntoViewIfNeeded().catch(() => {});
          return !!(await bruteBtn.click({ timeout: 8000 }).then(() => true).catch(() => false));
        },
      };
    }

    // Scroll down on first attempt to reveal buttons below the fold
    if (attempt === 0) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4)).catch(() => {});
    }

    // Wait before retrying — Chrome extension uses 700ms
    await page.waitForTimeout(700);
  }

  return null;
}

export async function sendConnectRequest(
  page: Page,
  input: { note?: string | null; debug?: ActionDebug }
): Promise<{ status: 'sent' | 'skipped' | 'restricted' | 'failed'; details?: any; strategyUsed?: string; last_step?: string; block_reason?: string | null }> {
  const state = await detectConnectionState(page);
  if (state === 'restricted') {
    return { status: 'restricted', details: { reason: 'restricted', error_code: 'restricted' }, last_step: 'detect_state' };
  }
  if (state === 'pending' || state === 'connected') {
    return { status: 'skipped', details: { reason: `already_${state}`, error_code: `already_${state}` }, last_step: 'detect_state' };
  }

  const entry = await findConnectEntrypoint(page);
  if (!entry) return { status: 'skipped', details: { reason: 'connect_not_available', error_code: 'connect_not_available' }, last_step: 'find_entrypoint' };
  const clicked = await entry.click();
  if (!clicked) return { status: 'failed', details: { reason: 'connect_click_failed', error_code: 'connect_click_failed' }, strategyUsed: entry.strategyUsed, last_step: 'click_entrypoint' };

  await page.waitForTimeout(700).catch(() => {});
  const trimmed = String(input.note || '').trim();
  if (trimmed) {
    const addNote = page.locator(
      [
        'button:has-text("Add a note")',
        'button[aria-label*="Add a note"]',
        'button[data-control-name="add_note"]'
      ].join(', ')
    ).first();
    if (await addNote.count().catch(() => 0)) {
      await addNote.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400).catch(() => {});
    }
    const textarea = page.locator('textarea[name="message"], textarea').first();
    if (await textarea.count().catch(() => 0)) {
      await textarea.fill(trimmed.slice(0, 300)).catch(() => {});
    } else {
      const editor = page.locator('[role="textbox"][contenteditable="true"]').first();
      if (await editor.count().catch(() => 0)) {
        await editor.click({ timeout: 5000 }).catch(() => {});
        await editor.fill(trimmed.slice(0, 300)).catch(() => {});
      }
    }
  }

  const send = page.locator(
    [
      'button:has-text("Send")',
      'button:has-text("Send now")',
      'button:has-text("Send invitation")',
      'button[aria-label*="Send"]'
    ].join(', ')
  ).first();
  if (await send.count().catch(() => 0)) {
    await send.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600).catch(() => {});
    const block = await detectBlockReason(page);
    return { status: 'sent', strategyUsed: entry.strategyUsed, last_step: 'send', block_reason: block };
  }
  const done = page.locator('button:has-text("Done"), button[aria-label*="Done"]').first();
  if (await done.count().catch(() => 0)) {
    await done.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600).catch(() => {});
    const block = await detectBlockReason(page);
    return { status: 'sent', strategyUsed: entry.strategyUsed, last_step: 'done', block_reason: block };
  }

  return { status: 'failed', details: { reason: 'send_button_missing', error_code: 'send_button_missing' }, strategyUsed: entry.strategyUsed, last_step: 'send_missing' };
}

export async function verifyInviteSent(page: Page, profileUrl: string, debug?: ActionDebug): Promise<{ ok: boolean; method?: string }> {
  const pendingOk = await waitForCondition(async () => {
    const pending = await page.locator('button', { hasText: /^Pending$/ }).count().catch(() => 0);
    const invited = await page.locator('button', { hasText: /^Invited$/ }).count().catch(() => 0);
    return pending > 0 || invited > 0;
  }, 9000, 500);
  if (pendingOk) return { ok: true, method: 'button_state' };

  const normalized = normalizeLinkedInProfileUrl(profileUrl);
  const slug = normalized?.split('/in/')[1]?.replace(/\/$/, '') || '';
  await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const found = await waitForCondition(async () => {
    if (!slug) return false;
    const link = page.locator(`a[href*="/in/${slug}"]`).first();
    return (await link.count().catch(() => 0)) > 0;
  }, 8000, 500);
  if (found) return { ok: true, method: 'sent_invites' };

  logDebug(debug, { event: 'verify_invite_failed', slug, url: normalized });
  return { ok: false };
}

async function runActionWithVerification<T>(args: {
  actionType: 'connect' | 'message';
  page: Page;
  perform: () => Promise<T>;
  verify: () => Promise<{ ok: boolean; method?: string }>;
  debug?: ActionDebug;
}) {
  logDebug(args.debug, { event: 'action_start', actionType: args.actionType });
  const result = await args.perform();
  const verified = await args.verify();
  logDebug(args.debug, { event: 'action_verify', actionType: args.actionType, verified });
  return { result, verified };
}

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

/* -------------------------------------------------------------------------- */
/*  Decision Maker Lookup                                                      */
/* -------------------------------------------------------------------------- */

const TITLE_KEYWORDS: Array<{ pattern: RegExp; searchTerms: string[] }> = [
  { pattern: /engineer|developer|software|backend|frontend|fullstack|devops|sre|platform|infrastructure/i, searchTerms: ['VP Engineering', 'Engineering Manager', 'CTO', 'Head of Engineering', 'Director Engineering'] },
  { pattern: /sales|account executive|business development|bdr|sdr/i, searchTerms: ['VP Sales', 'Head of Sales', 'Director Sales', 'Sales Manager', 'CRO'] },
  { pattern: /marketing|growth|content|brand|demand gen/i, searchTerms: ['VP Marketing', 'CMO', 'Head of Marketing', 'Director Marketing'] },
  { pattern: /product|pm|product manager/i, searchTerms: ['VP Product', 'Head of Product', 'CPO', 'Director Product'] },
  { pattern: /design|ux|ui|creative/i, searchTerms: ['VP Design', 'Head of Design', 'Design Director'] },
  { pattern: /data|analytics|machine learning|ai|ml/i, searchTerms: ['VP Data', 'Head of Data', 'Chief Data Officer', 'Director Analytics'] },
  { pattern: /finance|accounting|controller/i, searchTerms: ['CFO', 'VP Finance', 'Head of Finance', 'Controller'] },
  { pattern: /operations|ops|supply chain/i, searchTerms: ['COO', 'VP Operations', 'Head of Operations', 'Director Operations'] },
];
const DEFAULT_SEARCH_TERMS = ['Head of Talent', 'VP People', 'Talent Acquisition', 'Hiring Manager', 'HR Director', 'Recruiter'];

function inferSearchTerms(jobTitle?: string | null): string[] {
  if (!jobTitle) return DEFAULT_SEARCH_TERMS;
  for (const entry of TITLE_KEYWORDS) {
    if (entry.pattern.test(jobTitle)) return entry.searchTerms;
  }
  return DEFAULT_SEARCH_TERMS;
}

export async function prospectDecisionMakersOnPage(
  page: Page,
  companyUrl: string,
  opts: { companyName?: string | null; jobTitle?: string | null; limit: number }
): Promise<Array<{ profile_url: string; name?: string | null; headline?: string | null }>> {
  const raw = String(companyUrl || '').trim().replace(/\/+$/, '');
  if (!/linkedin\.com\/company\//i.test(raw)) return [];

  const peopleUrl = raw + '/people/';
  await page.goto(peopleUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500).catch(() => {});

  // Try to use the people page keyword search input
  const searchTerms = inferSearchTerms(opts.jobTitle);
  const searchQuery = searchTerms.slice(0, 3).join(' OR ');
  try {
    // LinkedIn company people page has a search input with placeholder like "Search employees..."
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill(searchQuery);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000).catch(() => {});
    }
  } catch {
    // If search input not found, continue with unfiltered people list
  }

  const seen = new Set<string>();
  const out: Array<{ profile_url: string; name?: string | null; headline?: string | null }> = [];

  async function collectOnce() {
    const batch = await page
      .evaluate(() => {
        const results: Array<{ profile_url: string; name?: string | null; headline?: string | null }> = [];
        const anchors = Array.from(document.querySelectorAll('a[href*="/in/"]')) as HTMLAnchorElement[];
        for (const a of anchors) {
          const href = (a.href || '').split('?')[0].split('#')[0];
          if (!href || !href.includes('/in/')) continue;
          const card = (a.closest('li') || a.closest('div[data-view-name]') || a.closest('div')) as HTMLElement | null;
          const nameEl = card?.querySelector('span[aria-hidden="true"]') as HTMLElement | null;
          const name = nameEl?.innerText?.trim() || (a.textContent || '').trim() || null;
          // Headline is typically in a sibling or child div with the person's title
          const headlineEl = card?.querySelector('.artdeco-entity-lockup__subtitle') as HTMLElement | null;
          const headline = headlineEl?.innerText?.trim() || null;
          results.push({ profile_url: href, name, headline });
        }
        return results;
      })
      .catch(() => []);

    for (const it of batch as any[]) {
      const href = String(it?.profile_url || '').trim();
      if (!href || !href.includes('/in/')) continue;
      const normalized = href.split('?')[0].split('#')[0];
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push({
        profile_url: normalized,
        name: it?.name ?? null,
        headline: it?.headline ?? null,
      });
      if (out.length >= opts.limit) break;
    }
  }

  const maxScrolls = 15;
  let stableCycles = 0;
  for (let i = 0; i < maxScrolls && out.length < opts.limit; i++) {
    const before = out.length;
    await collectOnce();
    if (out.length >= opts.limit) break;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(900).catch(() => {});

    if (out.length === before) stableCycles += 1;
    else stableCycles = 0;
    if (stableCycles >= 3) break;
  }

  return out.slice(0, opts.limit);
}

export async function sendConnectionRequestOnPage(
  page: Page,
  profileUrl: string,
  note?: string | null,
  debug?: ActionDebug,
  opts?: { skipNavigation?: boolean }
): Promise<{ status: 'sent_verified' | 'already_connected' | 'already_pending' | 'restricted' | 'skipped' | 'failed' | 'failed_verification'; details?: any }> {
  const url = normalizeLinkedInProfileUrl(profileUrl);
  if (!url) return { status: 'failed', details: { reason: 'invalid_profile_url', error_code: 'invalid_profile_url' } };

  // When called from hybrid path, SessionManager already navigated + waited for profile.
  // Navigating again wastes time and undoes the careful waitForSelector() the manager did.
  if (!opts?.skipNavigation) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitForProfileReady(page);
    if (isAuthWallUrl(page.url())) {
      throw new Error('LINKEDIN_AUTH_REQUIRED');
    }
  }

  // Quick already-connected/pending heuristics
  if (await page.locator('button:has-text("Pending")').first().count().catch(() => 0)) {
    return { status: 'already_pending' };
  }
  if (await page.locator('button:has-text("Message")').first().count().catch(() => 0)) {
    return { status: 'already_connected' };
  }
  if ((await detectConnectionState(page)) === 'restricted') {
    return { status: 'restricted' };
  }

  const { result, verified } = await runActionWithVerification({
    actionType: 'connect',
    page,
    perform: () => sendConnectRequest(page, { note, debug }),
    verify: () => verifyInviteSent(page, url, debug),
    debug
  });

  if (result.status === 'restricted') return { status: 'restricted', details: result };
  if (result.status === 'skipped' && result.details?.reason === 'already_pending') return { status: 'already_pending', details: result };
  if (result.status === 'skipped' && result.details?.reason === 'already_connected') return { status: 'already_connected', details: result };
  if (result.status === 'skipped') return { status: 'skipped', details: result };
  if (result.status === 'failed') return { status: 'failed', details: result };

  if (verified.ok) return { status: 'sent_verified', details: { ...result, verification: verified } };

  // Retry once after short human-like delay
  await page.waitForTimeout(3000 + Math.floor(Math.random() * 3000)).catch(() => {});
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const verifiedRetry = await verifyInviteSent(page, url, debug);
  if (verifiedRetry.ok) return { status: 'sent_verified', details: { ...result, verification: verifiedRetry, retry: true } };

  const screenshot = await captureScreenshot(page, 'connect-verify-failed');
  const domSnippet = await captureDomSnippet(page);
  return { status: 'failed_verification', details: { ...result, verification: verifiedRetry, screenshot, dom_snippet: domSnippet, error_code: 'verification_failed' } };
}

export async function sendMessageOnPage(
  page: Page,
  profileUrl: string,
  message: string,
  debug?: ActionDebug,
  opts?: { skipNavigation?: boolean }
): Promise<{ status: 'sent_verified' | 'not_1st_degree' | 'skipped' | 'failed' | 'failed_verification'; details?: any }> {
  const url = normalizeLinkedInProfileUrl(profileUrl);
  if (!url) return { status: 'failed', details: { reason: 'invalid_profile_url', error_code: 'invalid_profile_url' } };
  const msg = String(message || '').trim();
  if (!msg) return { status: 'skipped', details: { reason: 'empty_message', error_code: 'empty_message' } };

  if (!opts?.skipNavigation) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  // Must be 1st-degree: Message button visible
  const messageBtn = page.locator('button:has-text("Message")').first();
  if (!(await messageBtn.count().catch(() => 0))) {
    return { status: 'not_1st_degree', details: { error_code: 'not_1st_degree' } };
  }
  await messageBtn.click({ timeout: 8000 }).catch(() => {});

  // Message composer: contenteditable div
  const box = page.locator('[role="textbox"][contenteditable="true"]').first();
  if (!(await box.count().catch(() => 0))) {
    // fallback: any role textbox
    const box2 = page.locator('[role="textbox"]').first();
    if (!(await box2.count().catch(() => 0))) return { status: 'failed', details: { reason: 'composer_missing', error_code: 'composer_missing' } };
    await box2.click({ timeout: 5000 }).catch(() => {});
    await box2.fill(msg).catch(() => {});
  } else {
    await box.click({ timeout: 5000 }).catch(() => {});
    await box.fill(msg).catch(() => {});
  }

  const { verified } = await runActionWithVerification({
    actionType: 'message',
    page,
    perform: async () => {
      await page.keyboard.press('Enter').catch(() => {});
      return { ok: true };
    },
    verify: async () => {
      const snippet = msg.slice(0, 120);
      const ok = await waitForCondition(async () => {
        const bubble = page.locator('span', { hasText: snippet }).first();
        return (await bubble.count().catch(() => 0)) > 0;
      }, 8000, 500);
      return { ok, method: ok ? 'message_bubble' : undefined };
    },
    debug
  });

  if (verified.ok) return { status: 'sent_verified', details: { verification: verified } };

  const screenshot = await captureScreenshot(page, 'message-verify-failed');
  const domSnippet = await captureDomSnippet(page);
  return { status: 'failed_verification', details: { verification: verified, screenshot, dom_snippet: domSnippet, error_code: 'verification_failed' } };
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


