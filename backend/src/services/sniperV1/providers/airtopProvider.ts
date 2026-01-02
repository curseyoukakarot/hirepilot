import { chromium } from 'playwright';
import { airtopEnabled } from '../../airtop/airtopClient';
import {
  createSession,
  createWindow,
  getLiveViewUrl,
  saveProfileOnTermination,
  terminateSession
} from '../../airtop/sessions';
import { createAirtopAuthSession, getAirtopAuthSession, markAirtopAuthSession, upsertUserLinkedinAuth, getUserLinkedinAuth } from '../linkedinAuth';
import { prospectPostEngagersOnPage, sendConnectionRequestOnPage, sendMessageOnPage } from './linkedinActions';
import type { SniperExecutionProvider } from './types';

function requireAirtop() {
  if (!airtopEnabled()) throw new Error('AIRTOP provider disabled');
}

function sanitizeAirtopProfileName(name: string): string {
  // Airtop expects "alphanumeric with hyphen" (no underscores).
  // Keep it stable + readable; collapse invalid runs to single hyphen.
  return String(name)
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'hp-li-profile';
}

function deriveProfileName(userId: string, workspaceId: string): string {
  // Airtop profiles are scoped to our org; use a stable name per (workspace,user)
  return sanitizeAirtopProfileName(`hp-li-${workspaceId}-${userId}`);
}

async function connectAirtopPlaywright(session: any) {
  const cdpWsUrl = session?.data?.cdpWsUrl || session?.data?.cdp_ws_url || session?.data?.cdpWsURL;
  if (!cdpWsUrl) throw new Error('Airtop session missing cdpWsUrl');
  const apiKey = String(process.env.AIRTOP_API_KEY || '').trim();
  // Airtop docs show passing Authorization header for CDP clients
  const browser = await chromium.connectOverCDP(String(cdpWsUrl), {
    headers: { authorization: `Bearer ${apiKey}` }
  } as any);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  return { browser, context, page };
}

async function assertAuthenticatedLinkedIn(page: any) {
  const url = String(page.url() || '');
  if (/linkedin\.com\/login/i.test(url) || /checkpoint/i.test(url)) {
    throw new Error('LINKEDIN_AUTH_REQUIRED');
  }
}

export const airtopProvider: SniperExecutionProvider = {
  name: 'airtop',

  startLinkedInAuth: async ({ userId, workspaceId }) => {
    requireAirtop();
    const profileName = deriveProfileName(userId, workspaceId);
    // Create a fresh session (no profile yet) and mark it to save profile on termination.
    const session: any = await createSession({ timeoutMinutes: 30 });
    const sessionId = String(session?.data?.id || session?.data?.sessionId || session?.id);
    if (!sessionId) throw new Error('Airtop session id missing');

    await saveProfileOnTermination(sessionId, profileName);
    const win: any = await createWindow(sessionId, { url: 'https://www.linkedin.com/login' });
    const windowId = String(win?.data?.id || win?.data?.windowId || win?.id);
    if (!windowId) throw new Error('Airtop window id missing');

    const liveViewUrl = await getLiveViewUrl(sessionId, windowId);
    const authRow = await createAirtopAuthSession({
      user_id: userId,
      workspace_id: workspaceId,
      airtop_session_id: sessionId,
      airtop_window_id: windowId,
      airtop_profile_name: profileName
    });

    return {
      provider: 'airtop',
      auth_session_id: authRow.id,
      airtop_session_id: sessionId,
      airtop_window_id: windowId,
      airtop_profile_id: profileName,
      live_view_url: liveViewUrl
    };
  },

  completeLinkedInAuth: async ({ userId, workspaceId, authSessionId }) => {
    requireAirtop();
    const auth = await getAirtopAuthSession(authSessionId);
    if (!auth || auth.status !== 'active') throw new Error('auth_session_not_active');
    if (auth.user_id !== userId) throw new Error('forbidden');
    if (auth.workspace_id !== workspaceId) throw new Error('forbidden_workspace');

    // Terminate session to persist profile (per Airtop docs)
    await terminateSession(auth.airtop_session_id);
    await markAirtopAuthSession(authSessionId, 'completed');

    await upsertUserLinkedinAuth(userId, workspaceId, {
      airtop_profile_id: auth.airtop_profile_name,
      airtop_last_auth_at: new Date().toISOString(),
      status: 'ok'
    } as any);

    return { ok: true, airtop_profile_id: auth.airtop_profile_name };
  },

  prospectPostEngagers: async ({ userId, workspaceId, postUrl, limit }) => {
    requireAirtop();
    const auth = await getUserLinkedinAuth(userId, workspaceId);
    if (!auth?.airtop_profile_id) throw new Error('needs_reauth');

    const session: any = await createSession({ profileName: auth.airtop_profile_id, timeoutMinutes: 30 });
    try {
      const { browser, page } = await connectAirtopPlaywright(session);
      try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
        await assertAuthenticatedLinkedIn(page);
        const results = await prospectPostEngagersOnPage(page, postUrl, Math.max(1, Math.min(limit || 200, 1000)));
        return results;
      } finally {
        try { await browser.close(); } catch {}
      }
    } catch (e: any) {
      if (String(e?.message || '').includes('LINKEDIN_AUTH_REQUIRED')) {
        await upsertUserLinkedinAuth(userId, workspaceId, { status: 'needs_reauth' } as any);
      }
      throw e;
    } finally {
      const sessionId = String(session?.data?.id || session?.id || '');
      if (sessionId) {
        try { await terminateSession(sessionId); } catch {}
      }
    }
  },

  sendConnectionRequest: async ({ userId, workspaceId, profileUrl, note }) => {
    requireAirtop();
    const auth = await getUserLinkedinAuth(userId, workspaceId);
    if (!auth?.airtop_profile_id) throw new Error('needs_reauth');
    const session: any = await createSession({ profileName: auth.airtop_profile_id, timeoutMinutes: 30 });
    try {
      const { browser, page } = await connectAirtopPlaywright(session);
      try {
        await assertAuthenticatedLinkedIn(page);
        const res = await sendConnectionRequestOnPage(page, profileUrl, note);
        return res as any;
      } finally {
        try { await browser.close(); } catch {}
      }
    } catch (e: any) {
      if (String(e?.message || '').includes('LINKEDIN_AUTH_REQUIRED')) {
        await upsertUserLinkedinAuth(userId, workspaceId, { status: 'needs_reauth' } as any);
      }
      throw e;
    } finally {
      const sessionId = String(session?.data?.id || session?.id || '');
      if (sessionId) {
        try { await terminateSession(sessionId); } catch {}
      }
    }
  },

  sendMessage: async ({ userId, workspaceId, profileUrl, message }) => {
    requireAirtop();
    const auth = await getUserLinkedinAuth(userId, workspaceId);
    if (!auth?.airtop_profile_id) throw new Error('needs_reauth');
    const session: any = await createSession({ profileName: auth.airtop_profile_id, timeoutMinutes: 30 });
    try {
      const { browser, page } = await connectAirtopPlaywright(session);
      try {
        await assertAuthenticatedLinkedIn(page);
        const res = await sendMessageOnPage(page, profileUrl, message);
        return res as any;
      } finally {
        try { await browser.close(); } catch {}
      }
    } catch (e: any) {
      if (String(e?.message || '').includes('LINKEDIN_AUTH_REQUIRED')) {
        await upsertUserLinkedinAuth(userId, workspaceId, { status: 'needs_reauth' } as any);
      }
      throw e;
    } finally {
      const sessionId = String(session?.data?.id || session?.id || '');
      if (sessionId) {
        try { await terminateSession(sessionId); } catch {}
      }
    }
  }
};


