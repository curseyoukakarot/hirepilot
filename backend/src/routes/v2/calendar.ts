/**
 * v2 — /api/v2/calendar
 * OAuth + thin client for Google Calendar (Outlook to follow).
 *
 * Reuses the existing google_accounts table from backend/api/googleAuth.ts —
 * just adds the calendar scope to the consent flow and a small helper layer
 * for the Coordinator skill handlers.
 *
 * GET  /api/v2/calendar/status                 — does the user's token have calendar scope?
 * GET  /api/v2/calendar/google/init            — Google consent URL (calendar + events scope)
 * GET  /api/v2/calendar/google/callback        — token exchange + persist
 * GET  /api/v2/calendar/freebusy?start&end     — list busy windows for the user (uses primary cal)
 *
 * The skill handlers in src/rex/skills/handlers/coordinator.ts read the
 * status via this module's helpers and either execute live calendar work
 * or hold the action when no token is connected.
 */

import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../middleware/authMiddleware';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

function newOauth2() {
  return new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
  });
}

/**
 * Returns a Google OAuth2 client with the user's stored credentials, OR
 * null if the user hasn't granted calendar scope yet.
 */
export async function getCalendarClient(userId: string): Promise<any | null> {
  const { data } = await supabase
    .from('google_accounts')
    .select('access_token, refresh_token, expires_at, scopes')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;

  const scopes: string[] = (data as any).scopes || [];
  const hasCalendar = scopes.some((s) => s.includes('calendar'));
  if (!hasCalendar) return null;

  const oauth2 = newOauth2();
  oauth2.setCredentials({
    access_token: (data as any).access_token,
    refresh_token: (data as any).refresh_token,
    expiry_date: (data as any).expires_at ? new Date((data as any).expires_at).getTime() : undefined,
    scope: scopes.join(' '),
  });

  // Persist refreshed tokens back to the row when googleapis refreshes.
  oauth2.on('tokens', async (newTokens: any) => {
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (newTokens.access_token) update.access_token = newTokens.access_token;
    if (newTokens.expiry_date) update.expires_at = new Date(newTokens.expiry_date).toISOString();
    if (newTokens.refresh_token) update.refresh_token = newTokens.refresh_token;
    try { await supabase.from('google_accounts').update(update).eq('user_id', userId); } catch {}
  });

  return oauth2;
}

/** Status check — used by the UI + the coordinator skill handlers. */
router.get('/status', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    const client = await getCalendarClient(userId);
    if (!client) {
      return res.json({ google: { connected: false, has_calendar_scope: false } });
    }
    return res.json({ google: { connected: true, has_calendar_scope: true } });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'status_failed' });
  }
});

/**
 * Init — returns the consent URL. Frontend opens it in a popup or redirect.
 * State carries the userId so callback can persist tokens against the right user.
 */
router.get('/google/init', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    const oauth2 = newOauth2();
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: CALENDAR_SCOPES,
      state: userId,
    });
    return res.json({ url });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'init_failed' });
  }
});

/**
 * Callback — Google redirects here with the auth code. We exchange it,
 * persist the tokens (preserving refresh_token if Google didn't issue a
 * new one), and redirect the user back to the app's settings page.
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const userId = String(req.query.state || '');
  if (!code || !userId) {
    return res.redirect(`${process.env.APP_WEB_URL || ''}/settings/integrations?error=calendar_oauth_missing_state`);
  }
  try {
    const oauth2 = newOauth2();
    const { tokens } = await oauth2.getToken(code);

    const { data: existing } = await supabase
      .from('google_accounts')
      .select('refresh_token, scopes')
      .eq('user_id', userId)
      .maybeSingle();

    const expires_at = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 60 * 60 * 1000);

    const newScopes = (tokens.scope || '').split(' ').filter(Boolean);
    const mergedScopes = Array.from(new Set([...((existing as any)?.scopes || []), ...newScopes]));

    await supabase
      .from('google_accounts')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || (existing as any)?.refresh_token,
        expires_at: expires_at.toISOString(),
        scopes: mergedScopes,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return res.redirect(`${process.env.APP_WEB_URL || ''}/settings/integrations?calendar=success`);
  } catch (e: any) {
    console.error('[calendar/callback]', e);
    return res.redirect(`${process.env.APP_WEB_URL || ''}/settings/integrations?error=calendar_oauth_failed`);
  }
});

/** List busy windows (start..end ISO timestamps) on the user's primary calendar. */
router.get('/freebusy', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    const start = String(req.query.start || '');
    const end = String(req.query.end || '');
    if (!start || !end) return res.status(400).json({ error: 'start_and_end_required' });

    const client = await getCalendarClient(userId);
    if (!client) return res.status(409).json({ error: 'calendar_not_connected' });

    const cal = google.calendar({ version: 'v3', auth: client });
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: start,
        timeMax: end,
        items: [{ id: 'primary' }],
      },
    });
    return res.json({
      busy: fb.data?.calendars?.primary?.busy || [],
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'freebusy_failed' });
  }
});

export default router;
