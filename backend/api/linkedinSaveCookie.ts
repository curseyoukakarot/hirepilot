import express from 'express';
import { z } from 'zod';
import { createClient, PostgrestError } from '@supabase/supabase-js';
import fetch from 'node-fetch'; // For LinkedIn ping
import crypto from 'crypto';
import { encryptGCM } from '../src/lib/crypto';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY?.slice(0, 32) || 'default_key_32_bytes_long_123456'; // 32 bytes for AES-256
const IV_LENGTH = 16;

// Some environments don't have a unique index on user_id for legacy tables.
// Attempt the upsert first; if it fails with the missing constraint error,
// fall back to manual select + update/insert so users are not blocked.
async function upsertByUserId<T extends Record<string, unknown>>(
  table: string,
  payload: T & { user_id: string }
) {
  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'user_id' });
  if (!error) return { error: null as PostgrestError | null };

  const missingConflict =
    typeof error.message === 'string' &&
    error.message.includes('no unique or exclusion constraint matching the ON CONFLICT specification');

  if (!missingConflict) {
    return { error };
  }

  // Legacy fallback path without relying on a unique constraint
  const { data: existing, error: selectError } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', payload.user_id)
    .maybeSingle();
  if (selectError) {
    return { error: selectError };
  }

  if (existing?.id) {
    const { error: updateError } = await supabase.from(table).update(payload).eq('id', existing.id);
    return { error: updateError };
  }

  const { error: insertError } = await supabase.from(table).insert(payload);
  return { error: insertError };
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

const saveCookieSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  session_cookie: z.string().min(1, 'Session cookie is required'),
  user_agent: z.string().min(1, 'User agent is required'),
});

function extractCookieValue(cookieString: string, key: string): string | null {
  if (!cookieString) return null;
  const parts = cookieString.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...rest] = trimmed.split('=');
    if (name && name.trim().toLowerCase() === key.toLowerCase()) {
      return rest.join('=');
    }
  }
  return null;
}

// POST /api/linkedin/save-cookie
router.post('/save-cookie', async (req, res) => {
  try {
    const { user_id, session_cookie, user_agent } = req.body;

    // Encrypt the session_cookie before storing
    const encrypted_cookie = encrypt(session_cookie);
    const now = new Date().toISOString();

    // Set expires_at to 30 days from now and status to 'valid' for new cookies
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const { error } = await upsertByUserId('linkedin_cookies', {
      user_id,
      session_cookie: encrypted_cookie,
      user_agent,
      updated_at: now,
      expires_at: expiresAt.toISOString(),
      status: 'valid',
      is_valid: true
    });

    if (error) {
      console.error('insert failed', error);
      res.status(500).json({ error: error.message });
      return;
    }

    const gcmEncryptedCookie = JSON.stringify(encryptGCM(session_cookie));
    const liAtValue = extractCookieValue(session_cookie, 'li_at');
    const jsessionValue = extractCookieValue(session_cookie, 'JSESSIONID');

    const { error: sessionError } = await upsertByUserId('linkedin_sessions', {
      user_id,
      enc_cookie: gcmEncryptedCookie,
      cookie_string: gcmEncryptedCookie,
      enc_li_at: liAtValue ? JSON.stringify(encryptGCM(liAtValue)) : null,
      enc_jsessionid: jsessionValue ? JSON.stringify(encryptGCM(jsessionValue)) : null,
      updated_at: now,
      last_used_at: now,
      source: 'chrome_extension'
    });

    if (sessionError) {
      console.error('linkedin_sessions upsert failed', sessionError);
      res.status(500).json({ error: sessionError.message });
      return;
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('insert failed', err);
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
      return;
    } else {
      res.status(500).json({ error: 'Unknown error' });
      return;
    }
  }
});

// POST /api/linkedin/test-cookie
// Body: { user_id: string }
// Pings LinkedIn with the user's cookie, updates last_tested_at and is_valid
router.post('/test-cookie', async (req, res) => {
  try {
    const { user_id } = req.body;
    // Get the session_cookie for this user
    const { data, error } = await supabase
      .from('linkedin_cookies')
      .select('session_cookie')
      .eq('user_id', user_id)
      .single();
    if (error || !data?.session_cookie) {
      res.status(404).json({ error: 'No cookie found for user' });
      return;
    }
    // Ping LinkedIn
    let isValid = false;
    try {
      const resp = await fetch('https://www.linkedin.com/feed', {
        headers: { cookie: `li_at=${data.session_cookie}` },
      });
      isValid = resp.status === 200;
    } catch (e) {
      isValid = false;
    }
    // Update last_tested_at and is_valid
    await supabase
      .from('linkedin_cookies')
      .update({ last_tested_at: new Date().toISOString(), is_valid: isValid })
      .eq('user_id', user_id);
    return res.json({ ok: true, is_valid: isValid });
  } catch (err) {
    console.error('test-cookie failed', err);
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
      return;
    } else {
      res.status(500).json({ error: 'Unknown error' });
      return;
    }
  }
});

// Admin endpoint to force-expire a user's cookie
router.post('/expire-cookie', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      res.status(400).json({ error: 'user_id required' });
      return;
    }
    const { error } = await supabase
      .from('linkedin_cookies')
      .update({ status: 'stale', updated_at: new Date().toISOString() })
      .eq('user_id', user_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('expire-cookie failed', err);
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
      return;
    } else {
      res.status(500).json({ error: 'Unknown error' });
      return;
    }
  }
});

export default router; 