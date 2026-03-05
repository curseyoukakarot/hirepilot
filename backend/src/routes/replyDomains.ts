import express, { Request, Response } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';
import dns from 'dns';
import crypto from 'crypto';
import { invalidateReplyDomainCache } from '../../utils/generateReplyAddress';

const router = express.Router();
const dnsPromises = dns.promises;

const SENDGRID_INBOUND_WEBHOOK_URL =
  process.env.SENDGRID_INBOUND_WEBHOOK_URL ||
  'https://api.thehirepilot.com/api/sendgrid/inbound';

function normalizeDomain(input: string) {
  let s = String(input || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.split('/')[0];
  s = s.split('?')[0];
  s = s.split('#')[0];
  s = s.split(':')[0];
  s = s.replace(/\.$/, '');
  return s;
}

function validateDomain(domain: string) {
  if (!domain) return false;
  if (domain.length > 253) return false;
  if (domain === 'localhost') return false;
  if (!domain.includes('.')) return false;
  const labels = domain.split('.');
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9-]+$/.test(label)) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }
  return true;
}

function generateVerificationToken() {
  return crypto.randomBytes(18).toString('base64url');
}

async function resolveMxWithTimeout(domain: string, timeoutMs = 5000): Promise<dns.MxRecord[]> {
  const timer = new Promise<dns.MxRecord[]>((_, reject) =>
    setTimeout(() => reject(new Error('dns_timeout')), timeoutMs)
  );
  const lookup = dnsPromises.resolveMx(domain);
  return (await Promise.race([lookup, timer])) as dns.MxRecord[];
}

async function registerSendgridInboundParse(hostname: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  try {
    const resp = await fetch('https://api.sendgrid.com/v3/user/webhooks/parse/settings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname,
        url: SENDGRID_INBOUND_WEBHOOK_URL,
        spam_check: false,
        send_raw: true,
      }),
    });

    if (resp.ok) return { ok: true };

    // 409 or similar means it's already registered
    const body = await resp.json().catch(() => ({}));
    const code = String(body?.errors?.[0]?.message || body?.error || '').toLowerCase();
    if (resp.status === 409 || code.includes('already') || code.includes('exists')) {
      return { ok: true }; // Already registered is fine
    }

    return { ok: false, error: `SendGrid API error (${resp.status}): ${JSON.stringify(body)}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SendGrid API request failed' };
  }
}

async function removeSendgridInboundParse(hostname: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  try {
    const resp = await fetch(
      `https://api.sendgrid.com/v3/user/webhooks/parse/settings/${encodeURIComponent(hostname)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (resp.ok || resp.status === 404) return { ok: true };
    return { ok: false, error: `SendGrid API error (${resp.status})` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SendGrid API request failed' };
  }
}

// GET /api/settings/reply-domain
router.get('/', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await supabase
      .from('custom_reply_domains')
      .select('id,domain,status,mx_verified,sendgrid_registered,created_at,updated_at,verified_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[replyDomains] GET lookup failed:', error);
      return res.status(500).json({ error: error.message || 'lookup_failed' });
    }

    return res.json({ domain: data || null });
  } catch (e: any) {
    console.error('[replyDomains] GET unexpected error:', e);
    return res.status(500).json({ error: e?.message || 'lookup_failed' });
  }
});

// POST /api/settings/reply-domain
router.post('/', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const domain = normalizeDomain((req.body as any)?.domain);
    if (!validateDomain(domain)) return res.status(400).json({ error: 'domain_invalid' });

    // Check if another user owns this domain
    const { data: existing, error: checkErr } = await supabase
      .from('custom_reply_domains')
      .select('id,user_id')
      .eq('domain', domain)
      .maybeSingle();
    if (checkErr) {
      console.error('[replyDomains] POST ownership check failed:', checkErr);
      return res.status(500).json({ error: checkErr.message || 'ownership_check_failed' });
    }
    if (existing && (existing as any).user_id !== userId) {
      return res.status(409).json({ error: 'domain_taken', message: 'This domain is already registered by another user.' });
    }

    const token = generateVerificationToken();
    const workspaceId = (req as any)?.workspaceId || null;

    const { data: created, error } = await supabase
      .from('custom_reply_domains')
      .upsert(
        {
          user_id: userId,
          workspace_id: workspaceId,
          domain,
          status: 'pending',
          verification_token: token,
          mx_verified: false,
          sendgrid_registered: false,
          verified_at: null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id' }
      )
      .select('id,domain,status,created_at,updated_at')
      .single();
    if (error) {
      console.error('[replyDomains] POST upsert failed:', error);
      return res.status(500).json({ error: error.message || 'create_failed' });
    }

    return res.json({
      domain: created,
      instructions: {
        type: 'MX',
        host: domain,
        value: 'mx.sendgrid.net',
        priority: 10,
        note: 'Add this MX record to your DNS, then click Verify. DNS propagation may take up to 48 hours.',
      },
    });
  } catch (e: any) {
    console.error('[replyDomains] POST unexpected error:', e);
    return res.status(500).json({ error: e?.message || 'create_failed' });
  }
});

// POST /api/settings/reply-domain/verify
router.post('/verify', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data: row, error: rowErr } = await supabase
      .from('custom_reply_domains')
      .select('id,domain,status,user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (rowErr) {
      console.error('[replyDomains] VERIFY lookup failed:', rowErr);
      return res.status(500).json({ error: rowErr.message || 'lookup_failed' });
    }
    if (!row) return res.status(404).json({ error: 'no_domain_configured' });

    const domain = (row as any).domain;

    // Step 1: DNS MX verification
    let mxRecords: dns.MxRecord[] = [];
    try {
      mxRecords = await resolveMxWithTimeout(domain);
    } catch (e: any) {
      await supabase
        .from('custom_reply_domains')
        .update({ updated_at: new Date().toISOString() } as any)
        .eq('id', (row as any).id);
      return res.status(400).json({
        error: 'mx_not_found',
        message: 'Could not resolve MX records for this domain. Please check your DNS configuration and try again.',
        details: e?.message || String(e),
      });
    }

    const hasSendgridMx = mxRecords.some(
      (r) => String(r.exchange || '').toLowerCase().includes('mx.sendgrid.net')
    );
    if (!hasSendgridMx) {
      await supabase
        .from('custom_reply_domains')
        .update({ updated_at: new Date().toISOString() } as any)
        .eq('id', (row as any).id);
      return res.status(400).json({
        error: 'mx_mismatch',
        message: 'MX record does not point to mx.sendgrid.net. Please update your DNS and try again.',
        found: mxRecords.map((r) => ({ exchange: r.exchange, priority: r.priority })),
      });
    }

    // Step 2: Register with SendGrid Inbound Parse
    const sgResult = await registerSendgridInboundParse(domain);
    if (!sgResult.ok) {
      await supabase
        .from('custom_reply_domains')
        .update({ mx_verified: true, updated_at: new Date().toISOString() } as any)
        .eq('id', (row as any).id);
      return res.status(500).json({
        error: 'sendgrid_registration_failed',
        message: 'MX record verified, but failed to register domain with SendGrid. Please try again.',
        details: sgResult.error,
      });
    }

    // Step 3: Mark as verified
    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('custom_reply_domains')
      .update({
        status: 'verified',
        mx_verified: true,
        sendgrid_registered: true,
        verified_at: nowIso,
        updated_at: nowIso,
      } as any)
      .eq('id', (row as any).id)
      .select('id,domain,status,mx_verified,sendgrid_registered,verified_at')
      .single();
    if (error) {
      console.error('[replyDomains] VERIFY update failed:', error);
      return res.status(500).json({ error: error.message || 'verify_failed' });
    }

    invalidateReplyDomainCache(userId);
    return res.json({ ok: true, domain: updated });
  } catch (e: any) {
    console.error('[replyDomains] VERIFY unexpected error:', e);
    return res.status(500).json({ error: e?.message || 'verify_failed' });
  }
});

// DELETE /api/settings/reply-domain
router.delete('/', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data: row, error: rowErr } = await supabase
      .from('custom_reply_domains')
      .select('id,domain,sendgrid_registered,user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (rowErr) {
      console.error('[replyDomains] DELETE lookup failed:', rowErr);
      return res.status(500).json({ error: rowErr.message || 'lookup_failed' });
    }
    if (!row) return res.status(404).json({ error: 'not_found' });

    // Best-effort: remove from SendGrid Inbound Parse
    if ((row as any).sendgrid_registered) {
      const sgResult = await removeSendgridInboundParse((row as any).domain);
      if (!sgResult.ok) {
        console.warn(`[replyDomains] Failed to remove SendGrid inbound parse for ${(row as any).domain}:`, sgResult.error);
      }
    }

    const { error } = await supabase
      .from('custom_reply_domains')
      .delete()
      .eq('id', (row as any).id)
      .eq('user_id', userId);
    if (error) {
      console.error('[replyDomains] DELETE failed:', error);
      return res.status(500).json({ error: error.message || 'delete_failed' });
    }

    invalidateReplyDomainCache(userId);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[replyDomains] DELETE unexpected error:', e);
    return res.status(500).json({ error: e?.message || 'delete_failed' });
  }
});

export default router;
