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

/**
 * Extract root domain from a subdomain.
 * "reply.ignitegtm.com" → "ignitegtm.com"
 * "reply.company.co.uk" → "company.co.uk"
 * "ignitegtm.com" → "ignitegtm.com"
 */
function extractRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length > 2) return parts.slice(1).join('.');
  return domain;
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

// ─── SendGrid Inbound Parse helpers ─────────────────────────────────────────

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

// ─── SendGrid Domain Authentication helpers ─────────────────────────────────

async function createSendgridDomainAuth(rootDomain: string): Promise<{
  ok: boolean;
  id?: number;
  dns?: Record<string, any>;
  error?: string;
}> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  try {
    const resp = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: rootDomain,
        subdomain: 'em', // Must NOT be "reply" — avoids CNAME/MX conflict
        automatic_security: true,
        custom_dkim_selector: 'hp', // Avoids conflict with user's own s1/s2 DKIM records
      }),
    });

    const body = await resp.json().catch(() => ({}));

    if (resp.ok) {
      return { ok: true, id: body.id, dns: body.dns };
    }

    // Handle 409 / "already exists" — delete old auth and retry with correct settings
    const errMsg = String(body?.errors?.[0]?.message || '').toLowerCase();
    if (resp.status === 409 || errMsg.includes('already') || errMsg.includes('exists')) {
      const existing = await findExistingSendgridDomainAuth(rootDomain);
      if (existing) {
        // Delete the old domain auth so we can recreate with correct DKIM selector
        await deleteSendgridDomainAuth(existing.id).catch(() => {});
        // Retry creation with the correct settings
        const retryResp = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domain: rootDomain,
            subdomain: 'em',
            automatic_security: true,
            custom_dkim_selector: 'hp',
          }),
        });
        const retryBody = await retryResp.json().catch(() => ({}));
        if (retryResp.ok) {
          return { ok: true, id: retryBody.id, dns: retryBody.dns };
        }
        // If retry also fails, return the existing auth as fallback
        return { ok: true, id: existing.id, dns: existing.dns };
      }
      return { ok: false, error: 'Domain auth already exists in SendGrid but could not retrieve it' };
    }

    return { ok: false, error: `SendGrid domain auth error (${resp.status}): ${JSON.stringify(body)}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SendGrid domain auth request failed' };
  }
}

async function findExistingSendgridDomainAuth(rootDomain: string): Promise<{
  id: number;
  dns: Record<string, any>;
} | null> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://api.sendgrid.com/v3/whitelabel/domains?domain=${encodeURIComponent(rootDomain)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!resp.ok) return null;

    const list = await resp.json();
    if (!Array.isArray(list) || list.length === 0) return null;

    const match = list.find((d: any) => d.domain === rootDomain);
    if (match) return { id: match.id, dns: match.dns };
    return { id: list[0].id, dns: list[0].dns };
  } catch {
    return null;
  }
}

async function validateSendgridDomainAuth(domainAuthId: number): Promise<{
  ok: boolean;
  valid: boolean;
  results?: Record<string, any>;
  error?: string;
}> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, valid: false, error: 'SENDGRID_API_KEY not configured' };

  try {
    const resp = await fetch(
      `https://api.sendgrid.com/v3/whitelabel/domains/${domainAuthId}/validate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, valid: false, error: `SendGrid validate error (${resp.status}): ${JSON.stringify(body)}` };
    }

    return {
      ok: true,
      valid: body.valid === true,
      results: body.validation_results,
    };
  } catch (e: any) {
    return { ok: false, valid: false, error: e?.message || 'Validation request failed' };
  }
}

async function deleteSendgridDomainAuth(domainAuthId: number): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  try {
    const resp = await fetch(
      `https://api.sendgrid.com/v3/whitelabel/domains/${domainAuthId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (resp.ok || resp.status === 404) return { ok: true };
    return { ok: false, error: `SendGrid API error (${resp.status})` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SendGrid domain auth delete failed' };
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/settings/reply-domain
router.get('/', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data, error } = await supabase
      .from('custom_reply_domains')
      .select('id,domain,status,mx_verified,sendgrid_registered,sendgrid_domain_auth_id,dns_records,created_at,updated_at,verified_at')
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

    // Clean up old SendGrid resources if user already has a domain configured
    const { data: oldRow } = await supabase
      .from('custom_reply_domains')
      .select('sendgrid_domain_auth_id,domain,sendgrid_registered')
      .eq('user_id', userId)
      .maybeSingle();
    if (oldRow) {
      // Always clean up old domain auth (may need to recreate with new settings)
      if ((oldRow as any).sendgrid_domain_auth_id) {
        await deleteSendgridDomainAuth((oldRow as any).sendgrid_domain_auth_id).catch(() => {});
      }
      // Only clean up inbound parse if domain is changing
      if ((oldRow as any).domain !== domain && (oldRow as any).sendgrid_registered) {
        await removeSendgridInboundParse((oldRow as any).domain).catch(() => {});
      }
    }

    // Create SendGrid Domain Authentication for the root domain
    const rootDomain = extractRootDomain(domain);
    const sgAuth = await createSendgridDomainAuth(rootDomain);
    if (!sgAuth.ok) {
      console.error('[replyDomains] POST domain auth failed:', sgAuth.error);
      return res.status(500).json({
        error: 'domain_auth_failed',
        message: 'Failed to create domain authentication with SendGrid. Please try again.',
        details: sgAuth.error,
      });
    }

    // Build the 4 DNS records: 1 MX + 3 CNAMEs
    const dnsRecords = {
      mx: { type: 'MX', host: domain, value: 'mx.sendgrid.net', priority: 10 },
      mail_cname: {
        type: 'CNAME',
        host: sgAuth.dns?.mail_cname?.host || `em.${rootDomain}`,
        value: sgAuth.dns?.mail_cname?.data || '',
      },
      dkim1: {
        type: 'CNAME',
        host: sgAuth.dns?.dkim1?.host || `s1._domainkey.${rootDomain}`,
        value: sgAuth.dns?.dkim1?.data || '',
      },
      dkim2: {
        type: 'CNAME',
        host: sgAuth.dns?.dkim2?.host || `s2._domainkey.${rootDomain}`,
        value: sgAuth.dns?.dkim2?.data || '',
      },
    };

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
          sendgrid_domain_auth_id: sgAuth.id,
          dns_records: dnsRecords,
          verified_at: null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id' }
      )
      .select('id,domain,status,dns_records,sendgrid_domain_auth_id,created_at,updated_at')
      .single();
    if (error) {
      console.error('[replyDomains] POST upsert failed:', error);
      return res.status(500).json({ error: error.message || 'create_failed' });
    }

    // Return instructions as an array of 4 DNS records
    return res.json({
      domain: created,
      instructions: [
        dnsRecords.mx,
        dnsRecords.mail_cname,
        dnsRecords.dkim1,
        dnsRecords.dkim2,
      ],
      note: 'Add all 4 DNS records, then click Verify. DNS propagation may take up to 48 hours.',
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
      .select('id,domain,status,user_id,sendgrid_domain_auth_id,dns_records')
      .eq('user_id', userId)
      .maybeSingle();
    if (rowErr) {
      console.error('[replyDomains] VERIFY lookup failed:', rowErr);
      return res.status(500).json({ error: rowErr.message || 'lookup_failed' });
    }
    if (!row) return res.status(404).json({ error: 'no_domain_configured' });

    const domain = (row as any).domain;
    const domainAuthId = (row as any).sendgrid_domain_auth_id as number | null;

    // Step 1: Validate SendGrid Domain Authentication (CNAME records)
    if (domainAuthId) {
      const authResult = await validateSendgridDomainAuth(domainAuthId);
      if (!authResult.ok) {
        console.error('[replyDomains] VERIFY domain auth validation request failed:', authResult.error);
        return res.status(500).json({
          error: 'domain_auth_validation_failed',
          message: 'Failed to validate domain authentication with SendGrid. Please try again.',
          details: authResult.error,
        });
      }
      if (!authResult.valid) {
        await supabase
          .from('custom_reply_domains')
          .update({ updated_at: new Date().toISOString() } as any)
          .eq('id', (row as any).id);
        return res.status(400).json({
          error: 'domain_auth_not_valid',
          message: 'Domain authentication CNAME records have not propagated yet. Please check your DNS configuration and try again.',
          validation_results: authResult.results,
        });
      }
    }

    // Step 2: DNS MX verification
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

    // Step 3: Register with SendGrid Inbound Parse
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

    // Step 4: Mark as verified
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
      .select('id,domain,sendgrid_registered,sendgrid_domain_auth_id,user_id')
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

    // Best-effort: remove SendGrid domain authentication
    const domainAuthId = (row as any).sendgrid_domain_auth_id as number | null;
    if (domainAuthId) {
      const authResult = await deleteSendgridDomainAuth(domainAuthId);
      if (!authResult.ok) {
        console.warn(`[replyDomains] Failed to delete SendGrid domain auth ${domainAuthId}:`, authResult.error);
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
