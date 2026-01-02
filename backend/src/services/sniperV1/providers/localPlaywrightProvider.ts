import type { Cookie } from 'playwright';
import { startBrowser, newContext } from '../../../lib/browser/provider';
import { getUserLinkedinAuth, upsertUserLinkedinAuth } from '../linkedinAuth';
import { prospectPostEngagersOnPage, sendConnectionRequestOnPage, sendMessageOnPage } from './linkedinActions';
import type { SniperExecutionProvider } from './types';

async function createLocalLinkedInPage(userId: string, workspaceId: string) {
  const auth = await getUserLinkedinAuth(userId, workspaceId);
  const li_at = String(auth?.local_li_at || '').trim();
  const jsession = String(auth?.local_jsessionid || '').trim();
  if (!li_at) throw new Error('needs_reauth');

  const browser = await startBrowser();
  const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const cookies: Cookie[] = [
    { name: 'li_at', value: li_at, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax', expires }
  ];
  if (jsession) cookies.push({ name: 'JSESSIONID', value: jsession, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax', expires });
  const context = await newContext(browser as any, { cookies });
  const page = await context.newPage();
  return { browser: browser as any, context, page };
}

async function assertAuthenticatedLinkedIn(page: any) {
  const url = String(page.url() || '');
  if (/linkedin\.com\/login/i.test(url) || /checkpoint/i.test(url)) {
    throw new Error('LINKEDIN_AUTH_REQUIRED');
  }
}

export const localPlaywrightProvider: SniperExecutionProvider = {
  name: 'local_playwright',

  prospectPostEngagers: async ({ userId, workspaceId, postUrl, limit }) => {
    const { browser, page } = await createLocalLinkedInPage(userId, workspaceId);
    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
      await assertAuthenticatedLinkedIn(page);
      return await prospectPostEngagersOnPage(page, postUrl, Math.max(1, Math.min(limit || 200, 1000)));
    } catch (e: any) {
      if (String(e?.message || '').includes('LINKEDIN_AUTH_REQUIRED')) {
        await upsertUserLinkedinAuth(userId, workspaceId, { status: 'needs_reauth' } as any);
      }
      throw e;
    } finally {
      try { await browser.close(); } catch {}
    }
  },

  sendConnectionRequest: async ({ userId, workspaceId, profileUrl, note }) => {
    const { browser, page } = await createLocalLinkedInPage(userId, workspaceId);
    try {
      await assertAuthenticatedLinkedIn(page);
      return await sendConnectionRequestOnPage(page, profileUrl, note);
    } catch (e: any) {
      if (String(e?.message || '').includes('LINKEDIN_AUTH_REQUIRED')) {
        await upsertUserLinkedinAuth(userId, workspaceId, { status: 'needs_reauth' } as any);
      }
      throw e;
    } finally {
      try { await browser.close(); } catch {}
    }
  },

  sendMessage: async ({ userId, workspaceId, profileUrl, message }) => {
    const { browser, page } = await createLocalLinkedInPage(userId, workspaceId);
    try {
      await assertAuthenticatedLinkedIn(page);
      return await sendMessageOnPage(page, profileUrl, message);
    } catch (e: any) {
      if (String(e?.message || '').includes('LINKEDIN_AUTH_REQUIRED')) {
        await upsertUserLinkedinAuth(userId, workspaceId, { status: 'needs_reauth' } as any);
      }
      throw e;
    } finally {
      try { await browser.close(); } catch {}
    }
  }
};


