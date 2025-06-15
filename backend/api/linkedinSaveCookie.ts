import express from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch'; // For LinkedIn ping
import crypto from 'crypto';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY?.slice(0, 32) || 'default_key_32_bytes_long_123456'; // 32 bytes for AES-256
const IV_LENGTH = 16;

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

// POST /api/linkedin/save-cookie
router.post('/save-cookie', async (req, res) => {
  try {
    const { user_id, session_cookie, user_agent } = req.body;

    // Encrypt the session_cookie before storing
    const encrypted_cookie = encrypt(session_cookie);

    // Set expires_at to 30 days from now and status to 'valid' for new cookies
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const { error } = await supabase
      .from('linkedin_cookies')
      .upsert({ 
        user_id, 
        session_cookie: encrypted_cookie, 
        user_agent,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'valid',
        is_valid: true
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('insert failed', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('insert failed', err);
    if (err instanceof Error) {
      return res.status(500).json({ error: err.message });
    } else {
      return res.status(500).json({ error: 'Unknown error' });
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
      return res.status(404).json({ error: 'No cookie found for user' });
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
      return res.status(500).json({ error: err.message });
    } else {
      return res.status(500).json({ error: 'Unknown error' });
    }
  }
});

// Admin endpoint to force-expire a user's cookie
router.post('/expire-cookie', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const { error } = await supabase
      .from('linkedin_cookies')
      .update({ status: 'stale', updated_at: new Date().toISOString() })
      .eq('user_id', user_id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('expire-cookie failed', err);
    if (err instanceof Error) {
      return res.status(500).json({ error: err.message });
    } else {
      return res.status(500).json({ error: 'Unknown error' });
    }
  }
});

export default router; 