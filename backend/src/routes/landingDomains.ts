import express, { Request, Response } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';
import dns from 'dns';
import crypto from 'crypto';

const router = express.Router();
const dnsPromises = dns.promises;

function normalizeDomain(input: string) {
  let s = String(input || '').trim().toLowerCase();
  // Strip protocol
  s = s.replace(/^https?:\/\//, '');
  // Strip path/query/hash
  s = s.split('/')[0];
  s = s.split('?')[0];
  s = s.split('#')[0];
  // Strip port
  s = s.split(':')[0];
  // Strip trailing dot
  s = s.replace(/\.$/, '');
  return s;
}

function validateDomain(domain: string) {
  // Basic hostname validation: labels 1-63, total <= 253, no leading/trailing hyphen
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

function normalizeHostHeader(host: string) {
  const h = String(host || '').trim().toLowerCase();
  return h.split(':')[0].replace(/\.$/, '');
}

function normalizeRolePlan(v: any) {
  return String(v || '').toLowerCase().replace(/\s|-/g, '_');
}

async function resolveEliteFlag(userId: string, req: Request): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role, plan, account_type')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    const role = normalizeRolePlan((data as any)?.role || (req as any)?.user?.role);
    const plan = normalizeRolePlan((data as any)?.plan || (req as any)?.user?.plan);
    const accountType = normalizeRolePlan((data as any)?.account_type || (req as any)?.user?.account_type);
    if (['super_admin', 'admin', 'team_admin', 'team_admins'].includes(role)) return true;
    return role === 'job_seeker_elite' || plan === 'job_seeker_elite' || accountType === 'job_seeker_elite';
  } catch {
    const role = normalizeRolePlan((req as any)?.user?.role);
    const plan = normalizeRolePlan((req as any)?.user?.plan);
    const accountType = normalizeRolePlan((req as any)?.user?.account_type);
    if (['super_admin', 'admin', 'team_admin', 'team_admins'].includes(role)) return true;
    return role === 'job_seeker_elite' || plan === 'job_seeker_elite' || accountType === 'job_seeker_elite';
  }
}

async function resolveTxtWithTimeout(name: string, timeoutMs = 2500): Promise<string[]> {
  const timer = new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('dns_timeout')), timeoutMs));
  const lookup = (async () => {
    const rows = await dnsPromises.resolveTxt(name);
    // rows: string[][], flatten
    return rows.flat().map((s) => String(s || '').trim());
  })();
  return (await Promise.race([lookup, timer])) as string[];
}

function buildVerificationName(domain: string) {
  return `_hirepilot-verify.${domain}`;
}

function generateVerificationToken() {
  // Node builtin, safe for CommonJS/ts-node on Railway (avoids ESM-only nanoid)
  // 18 bytes -> 24 chars base64url (roughly), good entropy and DNS-safe
  return crypto.randomBytes(18).toString('base64url');
}

// GET /api/landing-domains/resolve?host=example.com (public)
router.get('/resolve', async (req: Request, res: Response) => {
  try {
    const host = normalizeHostHeader(String(req.query.host || ''));
    if (!host) return res.status(400).json({ error: 'host_required' });

    const { data, error } = await supabase
      .from('landing_page_domains')
      .select('domain,status,landing_page_id')
      .eq('domain', host)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message || 'resolve_failed' });
    if (!data) return res.status(404).json({ error: 'not_found' });

    const { data: page, error: pageErr } = await supabase
      .from('landing_pages')
      .select('id,slug,published')
      .eq('id', (data as any).landing_page_id)
      .maybeSingle();
    if (pageErr) return res.status(500).json({ error: pageErr.message || 'resolve_failed' });
    if (!page || !(page as any).published) return res.status(404).json({ error: 'not_found' });

    return res.json({ landingPageId: (page as any).id, slug: (page as any).slug });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'resolve_failed' });
  }
});

// GET /api/landing-domains/by-landing-page/:landing_page_id (auth)
router.get('/by-landing-page/:landing_page_id', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const landingPageId = String(req.params.landing_page_id || '').trim();
    if (!landingPageId) return res.status(400).json({ error: 'landing_page_id_required' });

    const { data, error } = await supabase
      .from('landing_page_domains')
      .select('id,domain,status,verification_token,verification_method,is_primary,created_at,updated_at,verified_at,last_checked_at')
      .eq('landing_page_id', landingPageId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message || 'list_failed' });
    return res.json({ domains: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'list_failed' });
  }
});

// POST /api/landing-domains/request
// body: { landing_page_id, domain }
router.post('/request', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const isElite = await resolveEliteFlag(userId, req);
    if (!isElite) return res.status(403).json({ error: 'ELITE_REQUIRED', code: 'ELITE_REQUIRED' });

    const landingPageId = String((req.body as any)?.landing_page_id || '').trim();
    const domain = normalizeDomain((req.body as any)?.domain);
    if (!landingPageId) return res.status(400).json({ error: 'landing_page_id_required' });
    if (!validateDomain(domain)) return res.status(400).json({ error: 'domain_invalid' });

    // Ensure the landing page belongs to this user
    const { data: page, error: pageErr } = await supabase
      .from('landing_pages')
      .select('id,user_id')
      .eq('id', landingPageId)
      .maybeSingle();
    if (pageErr) return res.status(500).json({ error: pageErr.message || 'page_lookup_failed' });
    if (!page || (page as any).user_id !== userId) return res.status(404).json({ error: 'landing_page_not_found' });

    // Anti-hijack: prevent attaching a domain already used by any user/page
    const { data: existing, error: existingErr } = await supabase
      .from('landing_page_domains')
      .select('id,user_id,landing_page_id,status,domain')
      .eq('domain', domain)
      .maybeSingle();
    if (existingErr) return res.status(500).json({ error: existingErr.message || 'domain_lookup_failed' });
    if (existing && (existing as any).user_id !== userId) {
      return res.status(409).json({ error: 'domain_taken' });
    }

    const token = generateVerificationToken();
    const verificationName = buildVerificationName(domain);
    const verificationValue = token;

    const { data: created, error } = await supabase
      .from('landing_page_domains')
      .upsert(
        {
          landing_page_id: landingPageId,
          user_id: userId,
          domain,
          status: 'pending',
          verification_token: token,
          verification_method: 'txt',
          is_primary: true,
          last_checked_at: null,
          verified_at: null,
        } as any,
        { onConflict: 'domain' }
      )
      .select('id,domain,status,verification_token,verification_method,created_at,updated_at')
      .single();
    if (error) return res.status(500).json({ error: error.message || 'create_failed' });

    return res.json({
      domain: created,
      instructions: {
        method: 'txt',
        name: verificationName,
        value: verificationValue,
        note: 'Create this TXT record, wait for DNS to propagate, then click Verify.',
      },
      recommendedRouting: {
        note: 'Also point your domain to the Vercel project hosting jobs.thehirepilot.com so HTTPS works.',
        apex: [{ type: 'A', name: '@', value: '76.76.21.21' }],
        subdomain: [{ type: 'CNAME', name: 'profile', value: 'cname.vercel-dns.com' }],
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'create_failed' });
  }
});

// POST /api/landing-domains/verify
// body: { domain }
router.post('/verify', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const isElite = await resolveEliteFlag(userId, req);
    if (!isElite) return res.status(403).json({ error: 'ELITE_REQUIRED', code: 'ELITE_REQUIRED' });

    const domain = normalizeDomain((req.body as any)?.domain);
    if (!validateDomain(domain)) return res.status(400).json({ error: 'domain_invalid' });

    const { data: row, error: rowErr } = await supabase
      .from('landing_page_domains')
      .select('id,domain,status,verification_token,verification_method,user_id')
      .eq('domain', domain)
      .maybeSingle();
    if (rowErr) return res.status(500).json({ error: rowErr.message || 'lookup_failed' });
    if (!row || (row as any).user_id !== userId) return res.status(404).json({ error: 'not_found' });

    const verificationName = buildVerificationName(domain);
    const token = String((row as any).verification_token || '').trim();
    if (!token) return res.status(400).json({ error: 'missing_token' });

    let txt: string[] = [];
    try {
      txt = await resolveTxtWithTimeout(verificationName, Number(process.env.DNS_VERIFY_TIMEOUT_MS || 2500));
    } catch (e: any) {
      // Record last_checked_at even on failure
      try {
        await supabase
          .from('landing_page_domains')
          .update({ last_checked_at: new Date().toISOString(), status: 'pending' } as any)
          .eq('id', (row as any).id)
          .eq('user_id', userId);
      } catch {}
      return res.status(400).json({ error: 'dns_lookup_failed', details: e?.message || String(e) });
    }

    const verified = txt.some((v) => v === token || v.includes(token));
    if (!verified) {
      await supabase
        .from('landing_page_domains')
        .update({ last_checked_at: new Date().toISOString(), status: 'pending' } as any)
        .eq('id', (row as any).id)
        .eq('user_id', userId);
      return res.status(400).json({ error: 'not_verified_yet', found: txt });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('landing_page_domains')
      .update({ status: 'active', verified_at: nowIso, last_checked_at: nowIso } as any)
      .eq('id', (row as any).id)
      .eq('user_id', userId)
      .select('id,domain,status,verified_at,last_checked_at')
      .single();
    if (error) return res.status(500).json({ error: error.message || 'verify_failed' });

    return res.json({ ok: true, domain: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'verify_failed' });
  }
});

// DELETE /api/landing-domains/:id
router.delete('/:id', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const isElite = await resolveEliteFlag(userId, req);
    if (!isElite) return res.status(403).json({ error: 'ELITE_REQUIRED', code: 'ELITE_REQUIRED' });

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id_required' });

    const { data: existing, error: existingErr } = await supabase
      .from('landing_page_domains')
      .select('id,domain,user_id')
      .eq('id', id)
      .maybeSingle();
    if (existingErr) return res.status(500).json({ error: existingErr.message || 'lookup_failed' });
    if (!existing || (existing as any).user_id !== userId) return res.status(404).json({ error: 'not_found' });

    const { error } = await supabase
      .from('landing_page_domains')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message || 'delete_failed' });

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'delete_failed' });
  }
});

export default router;


