import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { decryptGCM } from '../../lib/crypto';
import { decryptLegacyAesCookie } from '../../utils/encryption';

// Create a dedicated service-role DB client for cookie lookups.
// This avoids import ambiguity between multiple supabase helper modules across deploy setups.
const SUPABASE_URL = String(process.env.SUPABASE_URL || '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
const supabaseDb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

type EncryptedPayload = {
  iv: string;
  tag: string;
  cipher: string;
};

function parseEncryptedPayload(value: unknown): EncryptedPayload | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'iv' in value &&
    'tag' in value &&
    'cipher' in value
  ) {
    return value as EncryptedPayload;
  }

  return null;
}

async function updateLastUsed(sessionId: string) {
  try {
    await supabaseDb
      .from('linkedin_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', sessionId);
  } catch (err) {
    console.warn('[LinkedInCookie] Unable to update last_used_at', err);
  }
}

async function fetchLatestSessionCookie(userId: string): Promise<string | null> {
  const { data, error } = await supabaseDb
    .from('linkedin_sessions')
    .select('id, cookie_string, enc_cookie, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[LinkedInCookie] Failed to load sessions', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const encrypted = parseEncryptedPayload(data.cookie_string ?? data.enc_cookie);
  if (!encrypted) {
    return null;
  }

  try {
    const decrypted = decryptGCM(encrypted);
    await updateLastUsed(data.id);
    return decrypted;
  } catch (err) {
    console.error('[LinkedInCookie] Failed to decrypt session cookie', err);
    return null;
  }
}

async function fetchLegacyCookie(userId: string): Promise<string | null> {
  const { data, error } = await supabaseDb
    .from('linkedin_cookies')
    .select('session_cookie, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[LinkedInCookie] Failed to load legacy cookie', error);
    return null;
  }

  if (!data?.session_cookie) {
    return null;
  }

  try {
    return decryptLegacyAesCookie(data.session_cookie);
  } catch (err) {
    console.error('[LinkedInCookie] Failed to decrypt legacy cookie', err);
    return null;
  }
}

export async function getLatestLinkedInCookieForUser(userId: string): Promise<string | null> {
  if (!userId) return null;

  const sessionCookie = await fetchLatestSessionCookie(userId);
  if (sessionCookie) {
    return sessionCookie;
  }

  return fetchLegacyCookie(userId);
}

export async function hasLinkedInCookie(userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data: session, error: sessionError } = await supabaseDb
    .from('linkedin_sessions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (sessionError) {
    console.warn('[LinkedInCookie] Failed to check linkedin_sessions', sessionError);
  }

  if (session?.id) return true;

  const { data: legacy, error: legacyError } = await supabaseDb
    .from('linkedin_cookies')
    .select('session_cookie')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .maybeSingle();

  if (legacyError) {
    console.warn('[LinkedInCookie] Failed to check legacy cookies', legacyError);
  }

  return Boolean(legacy?.session_cookie);
}

