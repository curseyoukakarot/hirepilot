import { chromium, Page } from 'playwright';
import { airtopEnabled } from '../airtop/airtopClient';
import { createSession, terminateSession } from '../airtop/sessions';
import { getUserLinkedinAuth, upsertUserLinkedinAuth } from '../sniperV1/linkedinAuth';

function requireAirtop() {
  if (!airtopEnabled()) throw new Error('AIRTOP provider disabled');
}

function assertAuthenticatedLinkedIn(page: Page) {
  const url = String(page.url() || '');
  if (/linkedin\.com\/login/i.test(url) || /checkpoint/i.test(url)) {
    throw new Error('LINKEDIN_AUTH_REQUIRED');
  }
}

async function connectAirtopPlaywright(session: any) {
  const cdpWsUrl = session?.data?.cdpWsUrl || session?.data?.cdp_ws_url || session?.data?.cdpWsURL;
  if (!cdpWsUrl) throw new Error('Airtop session missing cdpWsUrl');
  const apiKey = String(process.env.AIRTOP_API_KEY || '').trim();
  if (!apiKey) throw new Error('AIRTOP_API_KEY missing');
  const browser = await chromium.connectOverCDP(String(cdpWsUrl), {
    headers: { authorization: `Bearer ${apiKey}` }
  } as any);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  return { browser, context, page };
}

export async function withAirtopLinkedInPage<T>(
  params: { userId: string; workspaceId: string; timeoutMinutes?: number },
  fn: (page: Page) => Promise<T>
) {
  requireAirtop();
  const auth = await getUserLinkedinAuth(params.userId, params.workspaceId);
  if (!auth?.airtop_profile_id) throw new Error('needs_reauth');

  const session: any = await createSession({ profileName: auth.airtop_profile_id, timeoutMinutes: params.timeoutMinutes ?? 30 });
  try {
    const { browser, page } = await connectAirtopPlaywright(session);
    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
      assertAuthenticatedLinkedIn(page);
      return await fn(page);
    } finally {
      try { await browser.close(); } catch {}
    }
  } catch (e: any) {
    if (String(e?.message || '').includes('LINKEDIN_AUTH_REQUIRED')) {
      await upsertUserLinkedinAuth(params.userId, params.workspaceId, { status: 'needs_reauth' } as any);
    }
    throw e;
  } finally {
    const sessionId = String(session?.data?.id || session?.id || '');
    if (sessionId) {
      try { await terminateSession(sessionId); } catch {}
    }
  }
}
