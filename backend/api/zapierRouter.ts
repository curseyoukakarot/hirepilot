import { Router, Response } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { ApiRequest } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { EVENT_TYPES } from '../src/lib/events';
import enrichLead from './enrichLead';
import zapierTestRouter from './zapierTestEvent';
import axios from 'axios';

const router = Router();

function normalizeDomain(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0];
}

async function ensureIdempotent(key: string): Promise<boolean> {
  const idemKey = String(key || '').trim();
  if (!idemKey) return true;
  const { data, error } = await supabaseDb
    .from('webhook_idem')
    .insert({ idem_key: idemKey })
    .select('idem_key')
    .maybeSingle();
  if (error && (error as any).code === '23505') return false; // duplicate
  if (error) throw error;
  return !!(data as any)?.idem_key;
}

async function getApolloApiKeyForUser(userId: string): Promise<string | null> {
  // Prefer shared super-admin key (platform billing), then platform key, then user key.
  if (process.env.SUPER_ADMIN_APOLLO_API_KEY) return process.env.SUPER_ADMIN_APOLLO_API_KEY;
  if (process.env.HIREPILOT_APOLLO_API_KEY) return process.env.HIREPILOT_APOLLO_API_KEY;
  try {
    const { data } = await supabaseDb
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .maybeSingle();
    const k = String((data as any)?.apollo_api_key || '').trim();
    return k ? k : null;
  } catch {
    return null;
  }
}

async function apolloSearchOrganization(apiKey: string, args: { companyName?: string; companyDomain?: string; perPage?: number }) {
  const companyName = String(args.companyName || '').trim();
  const companyDomain = normalizeDomain(args.companyDomain || '');
  const per_page = Math.max(1, Math.min(25, Number(args.perPage || 5)));

  const urls = [
    'https://api.apollo.io/api/v1/organizations/search',
    'https://api.apollo.io/v1/organizations/search'
  ];

  const params: any = { page: 1, per_page };
  if (companyName) params.q_organization_name = companyName;
  if (companyDomain) {
    // Apollo uses slightly different filter names across versions/plans; send a few best-effort hints.
    params.q_organization_domain = companyDomain;
    params.q_organization_domains = [companyDomain];
  }

  let lastErr: any = null;
  for (const url of urls) {
    try {
      const resp = await axios.get(url, {
        params: {
          ...params,
          // Some Apollo routes require api_key in query; include for compatibility even though we also send header.
          api_key: apiKey
        },
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey
        },
        timeout: 15000
      });
      const orgs = (resp.data?.organizations || resp.data?.organizations?.organizations || []) as any[];
      return { orgs, raw: resp.data };
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Apollo organization search failed');
}

async function upsertLeadForUser(userId: string, payload: { name: string; email?: string | null; title?: string | null; company?: string | null; linkedin_url?: string | null; location?: string | null; source?: string | null; enrichment_data?: any; enrichment_source?: string | null; tags?: string[] }) {
  const email = String(payload.email || '').trim().toLowerCase();
  const linkedinUrl = String(payload.linkedin_url || '').trim();

  // Prefer de-dupe by (user_id, email) when available; fallback to linkedin_url when email is missing.
  let existing: any = null;
  if (email) {
    const { data } = await supabaseDb
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .eq('email', email)
      .maybeSingle();
    existing = data || null;
  } else if (linkedinUrl) {
    const { data } = await supabaseDb
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .eq('linkedin_url', linkedinUrl)
      .maybeSingle();
    existing = data || null;
  }

  const row: any = {
    user_id: userId,
    name: payload.name,
    email: email || '',
    title: payload.title ?? null,
    company: payload.company ?? null,
    linkedin_url: linkedinUrl || null,
    location: payload.location ?? null,
    source: payload.source ?? null,
    enrichment_source: payload.enrichment_source ?? null,
    enrichment_data: payload.enrichment_data ?? null,
    tags: Array.isArray(payload.tags) ? payload.tags : undefined,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    const { data: upd, error } = await supabaseDb.from('leads').update(row).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return { lead: upd, created: false };
  }

  const { data: ins, error } = await supabaseDb.from('leads').insert([{ ...row, created_at: new Date().toISOString() }]).select('*').single();
  if (error) throw error;
  return { lead: ins, created: true };
}

async function upsertClientForUser(userId: string, payload: { name: string; domain?: string | null; industry?: string | null; revenue?: number | null; location?: string | null; org_meta?: any }) {
  const domainNorm = payload.domain ? normalizeDomain(payload.domain) : '';
  let existing: any = null;

  if (domainNorm) {
    const { data } = await supabaseDb
      .from('clients')
      .select('*')
      .eq('owner_id', userId)
      .eq('domain', domainNorm)
      .maybeSingle();
    existing = data || null;
  }

  if (!existing) {
    // Fallback match by name (best-effort)
    const { data } = await supabaseDb
      .from('clients')
      .select('*')
      .eq('owner_id', userId)
      .ilike('name', payload.name)
      .maybeSingle();
    existing = data || null;
  }

  const patch: any = {
    name: payload.name || null,
    domain: domainNorm || payload.domain || null,
    industry: payload.industry ?? null,
    revenue: payload.revenue ?? null,
    location: payload.location ?? null,
    org_meta: payload.org_meta ?? null,
    owner_id: userId
  };

  if (existing?.id) {
    const { data: upd, error } = await supabaseDb
      .from('clients')
      .update(patch)
      .eq('id', existing.id)
      .eq('owner_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return { client: upd, created: false };
  }

  const { data: ins, error } = await supabaseDb
    .from('clients')
    .insert({ ...patch, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return { client: ins, created: true };
}

async function createOpportunityIfMissing(userId: string, args: { clientId: string; companyName: string; idempotencyKey?: string | null; rssUrl?: string | null }) {
  const idemKey = String(args.idempotencyKey || '').trim();
  if (idemKey) {
    const ok = await ensureIdempotent(`opportunity:${idemKey}`);
    if (!ok) return { opportunity: null, created: false, deduped: true };
  }

  // Avoid spamming: if an "rss" deal exists for this client in the last 30 days, don't create another.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabaseDb
    .from('opportunities')
    .select('id,title,created_at')
    .eq('owner_id', userId)
    .eq('client_id', args.clientId)
    .eq('tag', 'rss')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return { opportunity: existing, created: false, deduped: false };

  const nowIso = new Date().toISOString();
  const title = args.companyName ? `Potential client: ${args.companyName}` : 'Potential client';
  const { data: ins, error } = await supabaseDb
    .from('opportunities')
    .insert({
      title,
      client_id: args.clientId,
      stage: 'Pipeline',
      status: 'open',
      tag: 'rss',
      owner_id: userId,
      created_at: nowIso,
      updated_at: nowIso
    })
    .select('*')
    .single();
  if (error) throw error;
  return { opportunity: ins, created: true, deduped: false };
}

/**
 * Create or update a lead via Zapier / Make.
 * If a lead with the provided email already exists, update it;
 * otherwise insert a new one. Requires X-API-Key header.
 */
router.post('/leads', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Incoming /leads payload:', req.body);
    const userId = req.user!.id;
    const lead = req.body;
    // Normalize and validate status to satisfy DB check constraint
    const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];
    if (lead.status) {
      const s = String(lead.status).toLowerCase();
      if (!ALLOWED_STATUS.includes(s)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(', ')}` });
      }
      lead.status = s;
    }

    if (!lead || !lead.email) {
      return res.status(400).json({ error: 'Lead email is required' });
    }

    // Manual upsert by (user_id, email) to avoid DB constraint requirement
    const { data: existingRows, error: findErr } = await supabaseDb
      .from('leads')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('email', lead.email)
      .order('created_at', { ascending: false })
      .limit(1);
    if (findErr) throw findErr;
    const existing = existingRows?.[0] ?? null;

    let data: any;
    if (existing && existing.id) {
      const { data: upd, error: updErr } = await supabaseDb
        .from('leads')
        .update({ ...lead, user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (updErr) throw updErr;
      data = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseDb
        .from('leads')
        .insert([{ ...lead, user_id: userId }])
        .select('*')
        .single();
      if (insErr) throw insErr;
      data = ins;
    }

    // Emit events to both new and legacy systems
    await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
      const eventType = existing ? ZAP_EVENT_TYPES.LEAD_UPDATED : ZAP_EVENT_TYPES.LEAD_CREATED;
      emitZapEvent({
        userId,
        eventType,
        eventData: createLeadEventData(data),
        sourceTable: 'leads',
        sourceId: data.id
      });
    });

    return res.status(200).json({ lead: data });
  } catch (err: any) {
    console.error('[Zapier] /leads error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Enrich an existing lead. Expects { lead_id } in body. Runs the same
 * enrichment logic used internally and returns the enriched data.
 */
router.post('/enrich', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Incoming /enrich payload:', req.body);
  } catch {}
  // Reuse existing enrichLead handler for DRYness
  return enrichLead(req as any, res);
});

/**
 * RSS → Company → CEO intake.
 *
 * POST /api/zapier/intake/company-ceo
 * Headers: X-API-Key
 * Body:
 *  - idempotency_key?: string (recommended; de-dupes both lead + opportunity creation)
 *  - company_name: string
 *  - company_domain?: string
 *  - rss_url?: string
 *  - rss_title?: string
 *  - tags?: string[] (applied to the CEO lead)
 */
router.post('/intake/company-ceo', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body: any = req.body || {};
    const idempotency_key = String(body.idempotency_key || '').trim();
    const company_name = String(body.company_name || '').trim();
    const company_domain = String(body.company_domain || '').trim();
    const rss_url = body.rss_url ? String(body.rss_url) : null;
    const rss_title = body.rss_title ? String(body.rss_title) : null;
    const tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t || '').trim()).filter(Boolean) : [];

    if (!company_name && !company_domain) {
      return res.status(400).json({ error: 'company_name or company_domain required' });
    }

    if (idempotency_key) {
      const ok = await ensureIdempotent(`intake:${idempotency_key}`);
      if (!ok) return res.status(200).json({ deduped: true });
    }

    const apolloKey = await getApolloApiKeyForUser(userId);
    if (!apolloKey) {
      return res.status(400).json({ error: 'No Apollo API key available for this user (or platform)' });
    }

    // 1) Company search (Apollo org search) and client upsert
    const { orgs } = await apolloSearchOrganization(apolloKey, { companyName: company_name, companyDomain: company_domain, perPage: 5 });
    const topOrg = Array.isArray(orgs) && orgs.length ? orgs[0] : null;

    const orgName = String(topOrg?.name || company_name || company_domain || '').trim() || 'Untitled Company';
    const orgDomain = normalizeDomain(String(topOrg?.website_url || topOrg?.domain || company_domain || ''));
    const orgIndustry = topOrg?.industry ? String(topOrg.industry) : null;
    const orgLocation = topOrg?.primary_location
      ? [topOrg.primary_location.city, topOrg.primary_location.state, topOrg.primary_location.country].filter(Boolean).join(', ')
      : (topOrg?.headquarters_location ? String(topOrg.headquarters_location) : null);
    const orgRevenue = (() => {
      const raw = topOrg?.estimated_annual_revenue || topOrg?.revenue || null;
      if (!raw) return null;
      const s = String(raw).toUpperCase().trim();
      const mult = s.endsWith('B') ? 1_000_000_000 : s.endsWith('M') ? 1_000_000 : s.endsWith('K') ? 1_000 : 1;
      const cleaned = s.replace(/[^0-9.]/g, '');
      const n = Number(cleaned);
      if (Number.isNaN(n)) return null;
      return Math.round(n * mult);
    })();

    const { client } = await upsertClientForUser(userId, {
      name: orgName,
      domain: orgDomain || null,
      industry: orgIndustry,
      revenue: orgRevenue,
      location: orgLocation,
      org_meta: topOrg ? { apollo: { organization: topOrg, rss: { url: rss_url, title: rss_title } } } : { rss: { url: rss_url, title: rss_title } }
    });

    // 2) Create a Deal/Opportunity (best-effort)
    const opp = await createOpportunityIfMissing(userId, { clientId: client.id, companyName: orgName, idempotencyKey: idempotency_key || null, rssUrl: rss_url });

    // 3) CEO search and lead upsert
    const { searchAndEnrichPeople } = await import('../utils/apolloApi');
    const ceoSearch = await searchAndEnrichPeople({
      api_key: apolloKey,
      person_titles: ['CEO'],
      q_keywords: orgDomain ? `${orgName} ${orgDomain}` : orgName,
      q_organization_domains: orgDomain ? [orgDomain] : undefined,
      page: 1,
      per_page: 50
    } as any);

    const candidates = (ceoSearch.leads || []) as any[];
    const orgNameLc = orgName.toLowerCase();
    const orgDomainLc = orgDomain ? orgDomain.toLowerCase() : '';

    const filtered = candidates.filter((p) => {
      const companyLc = String(p.company || '').toLowerCase();
      const websiteLc = String(p.organization?.website_url || p.organization?.domain || '').toLowerCase();
      const websiteNorm = websiteLc ? normalizeDomain(websiteLc) : '';
      if (orgDomainLc && websiteNorm && websiteNorm === orgDomainLc) return true;
      if (orgNameLc && companyLc && (companyLc === orgNameLc || companyLc.includes(orgNameLc) || orgNameLc.includes(companyLc))) return true;
      return false;
    });

    const pick = (filtered.length ? filtered : candidates)
      .sort((a, b) => {
        // Prefer having an email, then having a linkedin url
        const ae = a.email ? 1 : 0;
        const be = b.email ? 1 : 0;
        if (ae !== be) return be - ae;
        const al = a.linkedinUrl ? 1 : 0;
        const bl = b.linkedinUrl ? 1 : 0;
        return bl - al;
      })[0];

    let leadResult: any = null;
    if (pick) {
      const fullName = `${String(pick.firstName || '').trim()} ${String(pick.lastName || '').trim()}`.trim() || 'CEO';
      const leadTags = Array.from(new Set(['ceo', 'rss', ...tags].map(t => String(t || '').trim()).filter(Boolean)));
      leadResult = await upsertLeadForUser(userId, {
        name: fullName,
        email: pick.email || null,
        title: pick.title || 'CEO',
        company: orgName,
        linkedin_url: pick.linkedinUrl || null,
        location: [pick.city, pick.state, pick.country].filter(Boolean).join(', ') || null,
        source: 'rss_company_ceo',
        enrichment_source: 'apollo',
        enrichment_data: {
          apollo: {
            person_id: pick.id,
            organization: pick.organization || null,
            matched_company: { name: orgName, domain: orgDomain || null }
          },
          rss: { url: rss_url, title: rss_title }
        },
        tags: leadTags
      });
    }

    return res.status(200).json({
      ok: true,
      client,
      opportunity: opp.opportunity,
      ceo_lead: leadResult?.lead || null,
      meta: {
        org_found: !!topOrg,
        ceo_found: !!pick,
        candidates_seen: candidates.length,
        candidates_matched: filtered.length
      }
    });
  } catch (err: any) {
    console.error('[Zapier] /intake/company-ceo error:', err?.response?.data || err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Add a tag to an existing lead (by lead id) for the API-key user.
 * This avoids needing a session-authenticated PATCH /api/leads/:id call from Zapier.
 *
 * POST /api/zapier/leads/:id/tags
 * Body: { "tag": "aiinfra" }
 */
router.post('/leads/:id/tags', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = String(req.params.id || '').trim();
    const tagRaw = (req.body as any)?.tag;
    const tag = String(tagRaw ?? '').trim();

    if (!leadId) return res.status(400).json({ error: 'Missing lead id' });
    if (!tag) return res.status(400).json({ error: 'Missing tag' });

    // Fetch lead, ensure ownership by API-key user
    const { data: lead, error: fetchErr } = await supabaseDb
      .from('leads')
      .select('id,user_id,tags,status,created_at,updated_at,name,title,company,email,phone,linkedin_url,location')
      .eq('id', leadId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if ((lead as any).user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const prevTags: string[] = Array.isArray((lead as any).tags) ? (lead as any).tags : [];
    const prevLc = new Set(prevTags.map(t => String(t ?? '').trim().toLowerCase()).filter(Boolean));

    // If already present (case-insensitive), return current lead unchanged.
    if (prevLc.has(tag.toLowerCase())) {
      return res.status(200).json({ lead, added: false, tag, tags: prevTags });
    }

    const nextTags = [...prevTags, tag];
    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await supabaseDb
      .from('leads')
      .update({ tags: nextTags, updated_at: now })
      .eq('id', leadId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (updErr) throw updErr;
    if (!updated) return res.status(404).json({ error: 'Lead not found' });

    // Emit Zapier events (consistent with session-auth lead update behavior)
    try {
      await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
        emitZapEvent({
          userId,
          eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
          eventData: createLeadEventData(updated, { updated_fields: ['tags'] }),
          sourceTable: 'leads',
          sourceId: (updated as any).id
        });
        emitZapEvent({
          userId,
          eventType: ZAP_EVENT_TYPES.LEAD_TAG_ADDED,
          eventData: createLeadEventData(updated, {
            tag,
            action: 'tag_added',
            tags: nextTags,
            previous_tags: prevTags,
            added_tags: [tag]
          }),
          sourceTable: 'leads',
          sourceId: (updated as any).id
        });
      });
    } catch (e) {
      console.warn('[Zapier] emit tag events failed', (e as any)?.message || e);
    }

    return res.status(200).json({ lead: updated, added: true, tag, tags: nextTags });
  } catch (err: any) {
    console.error('[Zapier] /leads/:id/tags error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Polling trigger for new leads. Zapier will hit this with a `since` ISO timestamp.
 * Returns leads created after that timestamp (default: last 15 minutes).
 */
router.get('/triggers/new-leads', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Poll /triggers/new-leads since=', req.query.since);
    const userId = req.user!.id;
    const since = req.query.since as string | undefined;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 15 * 60 * 1000);

    const { data, error } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({ leads: data });
  } catch (err: any) {
    console.error('[Zapier] /triggers/new-leads error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * New comprehensive events trigger endpoint 
 * This replaces the need for multiple specific polling endpoints
 * Supports filtering by event_type, since timestamp, and pagination
 */
// List supported event types and human descriptions
router.get('/triggers/event-types', apiKeyAuth, async (_req: ApiRequest, res: Response) => {
  // Human-friendly descriptions for UI/docs
  const DESC: Record<string, string> = {
    opportunity_submitted: 'Candidate submitted to client',
    opportunity_application_created: 'Application recorded for an opportunity',
    opportunity_note_added: 'Note added on an opportunity',
    opportunity_collaborator_added: 'Collaborator added to an opportunity',
    deal_activity_logged: 'Deal activity logged',
    campaign_launched: 'Sourcing campaign launched',
    campaign_paused: 'Sourcing campaign paused',
    campaign_resumed: 'Sourcing campaign resumed',
    campaign_relaunched: 'Sourcing campaign relaunched',
    campaign_stats_snapshot: 'Sourcing campaign stats snapshot',
    sequence_scheduled: 'Sequence scheduled',
    message_batch_scheduled: 'Bulk message batch scheduled',
    lead_enrich_requested: 'Lead enrichment requested',
    candidate_enrich_requested: 'Candidate enrichment requested',
    client_created: 'Client created',
    client_updated: 'Client updated',
    client_enriched: 'Client enriched',
    contact_created: 'Contact created',
    credits_purchased: 'Credits purchased',
    subscription_checkout_started: 'Subscription checkout started',
    subscription_cancelled: 'Subscription cancelled',
    invoice_created: 'Invoice created',
    invoice_paid: 'Invoice paid',
    team_invite_sent: 'Team invitation sent',
    team_role_updated: 'Team role updated',
    notification_created: 'Notification created',
    sniper_target_added: 'Sniper target added',
    sniper_capture_triggered: 'Sniper capture triggered',
    rex_chat_triggered: 'REX chat/tool triggered',
    rex_linkedin_connect_sent: 'REX sent a LinkedIn connection',
    // Lead triggers
    lead_tag_added: 'Tag added to a lead',
    lead_source_added: 'Lead created from a specific source (extension/APIs)'
  };
  const all = Object.values(EVENT_TYPES);
  return res.json({
    event_types: all.map(t => ({ type: t, description: DESC[t] || '' }))
  });
});

router.get('/triggers/events', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[Zapier] Poll /triggers/events query=', req.query);
    const userId = req.user!.id;
    const eventType = req.query.event_type as string | undefined;
    const since = req.query.since as string | undefined;
    const cursor = req.query.cursor as string | undefined; // ISO8601 cursor
    const limit = Math.min(parseInt(req.query.limit as string || '50'), 100);
    const sinceDate = since ? new Date(since) : null;

    // Validate event type if provided
    if (eventType && !Object.values(EVENT_TYPES).includes(eventType as any)) {
      return res.status(400).json({ error: 'invalid_event_type', allowed: Object.values(EVENT_TYPES) });
    }

    let query = supabaseDb
      .from('zap_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // fetch one extra for next_cursor detection

    if (eventType) query = query.eq('event_type', eventType);
    if (sinceDate) query = query.gte('created_at', sinceDate.toISOString());
    if (cursor) query = query.lt('created_at', cursor);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? slice[slice.length - 1]?.created_at : null;

    return res.status(200).json({
      events: slice.reverse(), // oldest-first for consumers
      meta: { limit, event_type: eventType, since, next_cursor: nextCursor }
    });
  } catch (err: any) {
    console.error('[Zapier] /triggers/events error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * List unique lead tags for the authenticated (API-key) user.
 * Useful for Zapier dropdowns / validation.
 *
 * GET /api/zapier/lead-tags
 * Optional query:
 *  - q: substring filter (case-insensitive)
 *  - limit: max tags to return (default 200, max 1000)
 */
router.get('/lead-tags', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const q = String((req.query.q as any) ?? '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(1000, Number((req.query.limit as any) ?? 200)));

    // Fetch tags only; avoid pulling entire lead rows.
    // Note: tags appears to be stored as array/json on leads.
    const { data, error } = await supabaseDb
      .from('leads')
      .select('tags')
      .eq('user_id', userId)
      .not('tags', 'is', null)
      .limit(5000);
    if (error) throw error;

    const set = new Set<string>();
    for (const row of data || []) {
      const tags = (row as any)?.tags;
      if (!Array.isArray(tags)) continue;
      for (const t of tags) {
        const s = String(t ?? '').trim();
        if (!s) continue;
        if (q && !s.toLowerCase().includes(q)) continue;
        set.add(s);
      }
    }

    const tags = Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, limit);
    return res.status(200).json({ tags, meta: { q: q || null, limit, returned: tags.length } });
  } catch (err: any) {
    console.error('[Zapier] /lead-tags error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Polling trigger: leads whose status was updated (pipeline stage change)
 * after a provided `since` ISO timestamp. Zapier can use this to fire
 * workflows when a lead moves stages. Optional query param `stage`
 * can filter to a specific status value.
 * 
 * @deprecated Use /triggers/events with event_type=lead_stage_changed instead
 */
router.get('/triggers/pipeline-stage-changes', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const since = req.query.since as string | undefined;
    const stageFilter = req.query.stage as string | undefined;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 15 * 60 * 1000);

    let query = supabaseDb
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', sinceDate.toISOString())
      .order('updated_at', { ascending: true })
      .limit(50);

    if (stageFilter) {
      query = query.eq('status', stageFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ leads: data });
  } catch (err: any) {
    console.error('[Zapier] /triggers/pipeline-stage-changes error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Move a candidate to a pipeline stage (Zapier/Make action)
 * Body can include either candidate_job_id OR (candidate_id + job_id)
 * Destination can be dest_stage_id OR stage_title (we'll map to enum if needed)
 */
router.post('/move-candidate', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { candidate_job_id, candidate_id, job_id, dest_stage_id, stage_title } = req.body || {};
    if (!dest_stage_id && !stage_title) return res.status(400).json({ error: 'Missing destination stage' });
    if (!candidate_job_id && !(candidate_id && job_id)) return res.status(400).json({ error: 'Missing candidate reference' });

    // Resolve candidate_jobs row
    let cjRow: any = null;
    if (candidate_job_id) {
      const { data, error } = await supabaseDb
        .from('candidate_jobs')
        .select('id, candidate_id, job_id')
        .eq('id', candidate_job_id)
        .maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Candidate job not found' });
      cjRow = data;
    } else {
      let { data, error } = await supabaseDb
        .from('candidate_jobs')
        .select('id, candidate_id, job_id')
        .eq('candidate_id', candidate_id)
        .eq('job_id', job_id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      // If candidate is not attached to the job yet, create the link
      if (!data) {
        // Validate ownership first
        const { data: candOwn, error: ownErr } = await supabaseDb
          .from('candidates')
          .select('user_id')
          .eq('id', candidate_id)
          .single();
        if (ownErr || !candOwn || candOwn.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

        // Attempt to resolve stage_id from stage_title using pipeline_id or job_id
        let resolvedStageId: string | null = null;
        if (stage_title) {
          const { data: jobRow } = await supabaseDb
            .from('job_requisitions')
            .select('pipeline_id')
            .eq('id', job_id)
            .maybeSingle();
          if (jobRow?.pipeline_id) {
            const resId = await supabaseDb
              .from('pipeline_stages')
              .select('id')
              .eq('pipeline_id', jobRow.pipeline_id)
              .ilike('title', stage_title)
              .maybeSingle();
            resolvedStageId = (resId.data as any)?.id || null;
          }
          if (!resolvedStageId) {
            const resId = await supabaseDb
              .from('pipeline_stages')
              .select('id')
              .eq('job_id', job_id)
              .ilike('title', stage_title)
              .maybeSingle();
            resolvedStageId = (resId.data as any)?.id || null;
          }
        }

        const canonicalFrom = (title: string) => {
          const t = String(title || '').toLowerCase();
          if (['sourced','contacted','interviewed','offered','hired','rejected'].includes(t)) return t;
          if (t.includes('offer')) return 'offered';
          if (t.includes('hire')) return 'hired';
          if (t.includes('reject')) return 'rejected';
          if (t.includes('contact')) return 'contacted';
          if (t.includes('interview')) return 'interviewed';
          return 'sourced';
        };

        const insertPayload: any = {
          candidate_id,
          job_id
        };
        if (resolvedStageId || dest_stage_id) insertPayload.stage_id = dest_stage_id || resolvedStageId;
        else if (stage_title) insertPayload.status = canonicalFrom(stage_title);

        const { data: inserted, error: insErr } = await supabaseDb
          .from('candidate_jobs')
          .insert(insertPayload)
          .select('id, candidate_id, job_id')
          .single();
        if (insErr || !inserted) return res.status(500).json({ error: insErr?.message || 'Failed to attach candidate to job' });
        data = inserted;
      }
      cjRow = data;
    }

    // Validate ownership
    const { data: cand, error: candErr } = await supabaseDb
      .from('candidates')
      .select('user_id')
      .eq('id', cjRow.candidate_id)
      .single();
    if (candErr || !cand || cand.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    // Resolve stage_id from title if provided
    let resolvedStageId: string | null = null;
    if (stage_title && !dest_stage_id) {
      // Prefer pipeline_id path if available
      const { data: jobRow } = await supabaseDb
        .from('job_requisitions')
        .select('pipeline_id')
        .eq('id', cjRow.job_id)
        .maybeSingle();
      // Helper to attempt resolution by various strategies
      const tryResolve = async (filterCol: 'pipeline_id' | 'job_id', filterVal: string) => {
        // Exact ilike on title
        let q = await supabaseDb
          .from('pipeline_stages')
          .select('id, title, name')
          .eq(filterCol, filterVal)
          .ilike('title', stage_title)
          .maybeSingle();
        if (q.data?.id) return q.data.id as string;
        // Exact ilike on name
        q = await supabaseDb
          .from('pipeline_stages')
          .select('id, title, name')
          .eq(filterCol, filterVal)
          .ilike('name', stage_title)
          .maybeSingle();
        if (q.data?.id) return q.data.id as string;
        // Contains match on title/name
        const all = await supabaseDb
          .from('pipeline_stages')
          .select('id, title, name')
          .eq(filterCol, filterVal);
        const lc = String(stage_title).toLowerCase();
        const hit = (all.data || []).find((s: any) => (s.title || s.name || '').toLowerCase().includes(lc));
        return hit?.id || null;
      };
      if (jobRow?.pipeline_id) {
        resolvedStageId = await tryResolve('pipeline_id', jobRow.pipeline_id);
      }
      if (!resolvedStageId) {
        resolvedStageId = await tryResolve('job_id', cjRow.job_id);
      }
    }

    // Try stage_id first
    const now = new Date().toISOString();
    let updErr = null;
    if (dest_stage_id || resolvedStageId) {
      const { error } = await supabaseDb
        .from('candidate_jobs')
        .update({ stage_id: dest_stage_id || resolvedStageId, updated_at: now })
        .eq('id', cjRow.id);
      updErr = error;
    }
    if (!(dest_stage_id || resolvedStageId) || (updErr && (updErr as any).code === '42703')) {
      // Fallback to status enum mapping from stage_title
      const canonicalFrom = (title: string) => {
        const t = String(title || '').toLowerCase();
        if (['sourced','contacted','interviewed','offered','hired','rejected'].includes(t)) return t;
        if (t.includes('offer')) return 'offered';
        if (t.includes('hire')) return 'hired';
        if (t.includes('reject')) return 'rejected';
        if (t.includes('contact')) return 'contacted';
        if (t.includes('interview')) return 'interviewed';
        return 'interviewed';
      };
      const canonical = canonicalFrom(stage_title || 'Interviewed');
      const { error } = await supabaseDb
        .from('candidate_jobs')
        .update({ status: canonical, updated_at: now })
        .eq('id', cjRow.id);
      updErr = error;
    }
    if (updErr) {
      console.error('[Zapier] move-candidate error', updErr);
      return res.status(500).json({ error: 'Failed to move candidate' });
    }

    return res.json({ success: true, candidate_job_id: cjRow.id, dest_stage_id, stage_title: stage_title || null });
  } catch (err: any) {
    console.error('[Zapier] /move-candidate error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Search / list leads owned by the API-key user.
 *
 * GET /api/zapier/leads
 * Query params (all optional):
 *  - email          exact match on lead email (case-insensitive)
 *  - linkedin_url   exact match on linkedin_url
 *  - q              free-text substring match against name / email / company / title
 *  - status         exact match on status (sourced/contacted/...)
 *  - tag            return only leads whose tags array contains this value
 *  - limit          page size (default 25, max 100)
 *  - offset         row offset for pagination (default 0)
 */
router.get('/leads', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = String((req.query.email as any) ?? '').trim().toLowerCase();
    const linkedinUrl = String((req.query.linkedin_url as any) ?? '').trim();
    const q = String((req.query.q as any) ?? '').trim();
    const status = String((req.query.status as any) ?? '').trim().toLowerCase();
    const tag = String((req.query.tag as any) ?? '').trim();
    const limit = Math.max(1, Math.min(100, Number((req.query.limit as any) ?? 25)));
    const offset = Math.max(0, Number((req.query.offset as any) ?? 0));

    let query = supabaseDb
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (email) query = query.ilike('email', email);
    if (linkedinUrl) query = query.eq('linkedin_url', linkedinUrl);
    if (status) query = query.eq('status', status);
    if (tag) query = query.contains('tags', [tag]);
    if (q) {
      const like = `%${q.replace(/[%_]/g, m => `\\${m}`)}%`;
      query = query.or(
        [
          `name.ilike.${like}`,
          `email.ilike.${like}`,
          `company.ilike.${like}`,
          `title.ilike.${like}`
        ].join(',')
      );
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      leads: data || [],
      meta: {
        limit,
        offset,
        returned: (data || []).length,
        total: typeof count === 'number' ? count : null,
        filters: { email: email || null, linkedin_url: linkedinUrl || null, q: q || null, status: status || null, tag: tag || null }
      }
    });
  } catch (err: any) {
    console.error('[Zapier] GET /leads error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Get a single lead by id (must belong to API-key user).
 *
 * GET /api/zapier/leads/:id
 */
router.get('/leads/:id', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = String(req.params.id || '').trim();
    if (!leadId) return res.status(400).json({ error: 'Missing lead id' });

    const { data: lead, error } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    return res.status(200).json({ lead });
  } catch (err: any) {
    console.error('[Zapier] GET /leads/:id error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * List activities for a lead (must belong to API-key user).
 *
 * GET /api/zapier/leads/:id/activities
 * Query params:
 *  - limit  default 50, max 200
 *  - since  ISO timestamp; only return activities at/after this time
 */
router.get('/leads/:id/activities', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = String(req.params.id || '').trim();
    if (!leadId) return res.status(400).json({ error: 'Missing lead id' });

    const limit = Math.max(1, Math.min(200, Number((req.query.limit as any) ?? 50)));
    const since = String((req.query.since as any) ?? '').trim();

    const { data: lead, error: leadErr } = await supabaseDb
      .from('leads')
      .select('id,user_id')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if ((lead as any).user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    let query = supabaseDb
      .from('lead_activities')
      .select('id, lead_id, user_id, activity_type, tags, notes, activity_timestamp, created_at, updated_at')
      .eq('lead_id', leadId)
      .order('activity_timestamp', { ascending: false })
      .limit(limit);

    if (since) {
      const d = new Date(since);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid since timestamp' });
      query = query.gte('activity_timestamp', d.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ lead_id: leadId, activities: data || [] });
  } catch (err: any) {
    console.error('[Zapier] GET /leads/:id/activities error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Log an activity on a lead (Call / Meeting / Outreach / Email / LinkedIn / Note / Other).
 *
 * POST /api/zapier/leads/:id/activities
 * Body:
 *  - activity_type        required, one of Call|Meeting|Outreach|Email|LinkedIn|Note|Other
 *  - notes                optional free-text
 *  - tags                 optional string[]
 *  - activity_timestamp   optional ISO timestamp (defaults to now)
 */
router.post('/leads/:id/activities', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = String(req.params.id || '').trim();
    if (!leadId) return res.status(400).json({ error: 'Missing lead id' });

    const body = (req.body || {}) as any;
    const activity_type = String(body.activity_type || '').trim();
    const notes = body.notes != null ? String(body.notes) : null;
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: any) => String(t || '').trim()).filter(Boolean)
      : [];
    const activity_timestamp = body.activity_timestamp
      ? String(body.activity_timestamp)
      : new Date().toISOString();

    const VALID = ['Call', 'Meeting', 'Outreach', 'Email', 'LinkedIn', 'Note', 'Other'];
    if (!activity_type) return res.status(400).json({ error: 'activity_type required' });
    if (!VALID.includes(activity_type)) {
      return res.status(400).json({ error: `Invalid activity_type. Must be one of: ${VALID.join(', ')}` });
    }
    if (activity_timestamp && isNaN(new Date(activity_timestamp).getTime())) {
      return res.status(400).json({ error: 'Invalid activity_timestamp' });
    }

    const { data: lead, error: leadErr } = await supabaseDb
      .from('leads')
      .select('id,user_id')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if ((lead as any).user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const insertRow = {
      lead_id: leadId,
      user_id: userId,
      activity_type,
      tags,
      notes,
      activity_timestamp
    };

    const { data: activity, error } = await supabaseDb
      .from('lead_activities')
      .insert(insertRow)
      .select('id, lead_id, user_id, activity_type, tags, notes, activity_timestamp, created_at, updated_at')
      .single();
    if (error) throw error;

    return res.status(201).json({
      success: true,
      activity,
      message: `${activity_type} activity logged`
    });
  } catch (err: any) {
    console.error('[Zapier] POST /leads/:id/activities error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * List activities for a candidate (must belong to API-key user).
 *
 * GET /api/zapier/candidates/:id/activities
 * Query params:
 *  - limit  default 50, max 200
 *  - since  ISO timestamp; only return activities created at/after this time
 *  - job_id optional; filter to a specific job_requisition
 */
router.get('/candidates/:id/activities', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const candidateId = String(req.params.id || '').trim();
    if (!candidateId) return res.status(400).json({ error: 'Missing candidate id' });

    const limit = Math.max(1, Math.min(200, Number((req.query.limit as any) ?? 50)));
    const since = String((req.query.since as any) ?? '').trim();
    const jobIdFilter = String((req.query.job_id as any) ?? '').trim();

    const { data: candidate, error: candErr } = await supabaseDb
      .from('candidates')
      .select('id,user_id')
      .eq('id', candidateId)
      .maybeSingle();
    if (candErr) throw candErr;
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if ((candidate as any).user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    let query = supabaseDb
      .from('candidate_activities')
      .select('id, candidate_id, job_id, status, notes, created_at, created_by')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      const d = new Date(since);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid since timestamp' });
      query = query.gte('created_at', d.toISOString());
    }
    if (jobIdFilter) query = query.eq('job_id', jobIdFilter);

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ candidate_id: candidateId, activities: data || [] });
  } catch (err: any) {
    console.error('[Zapier] GET /candidates/:id/activities error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Log an activity on a candidate (Call / Meeting / Outreach / Email / LinkedIn / Note / Other).
 *
 * Note: the underlying `candidate_activities` table only stores
 * (candidate_id, job_id, status, notes, created_at, created_by). The
 * `activity_type` / `tags` you pass are echoed back in a normalized response
 * payload but are not currently persisted as separate columns.
 *
 * POST /api/zapier/candidates/:id/activities
 * Body:
 *  - activity_type   optional, one of Call|Meeting|Outreach|Email|LinkedIn|Note|Other
 *                    (defaults to "Note")
 *  - notes           optional free-text notes
 *  - status          optional, one of sourced|contacted|interviewed|offered|hired|rejected
 *                    (must match the candidate_status enum to be persisted)
 *  - tags            optional string[] (echoed back, not persisted)
 *  - job_id          optional UUID of a job_requisition this activity is tied to
 */
router.post('/candidates/:id/activities', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const candidateId = String(req.params.id || '').trim();
    if (!candidateId) return res.status(400).json({ error: 'Missing candidate id' });

    const body = (req.body || {}) as any;
    const activity_type = body.activity_type ? String(body.activity_type).trim() : 'Note';
    const notes = body.notes != null ? String(body.notes) : null;
    const status = body.status != null ? String(body.status).trim().toLowerCase() : null;
    const job_id = body.job_id ? String(body.job_id).trim() : null;
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: any) => String(t || '').trim()).filter(Boolean)
      : [];

    const VALID_TYPES = ['Call', 'Meeting', 'Outreach', 'Email', 'LinkedIn', 'Note', 'Other'];
    if (!VALID_TYPES.includes(activity_type)) {
      return res.status(400).json({ error: `Invalid activity_type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const VALID_STATUS = new Set(['sourced', 'contacted', 'interviewed', 'offered', 'hired', 'rejected']);
    if (status && !VALID_STATUS.has(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${Array.from(VALID_STATUS).join(', ')}` });
    }

    if (!notes && !status && activity_type === 'Note') {
      return res.status(400).json({ error: 'Provide notes, status, or activity_type to log an activity' });
    }

    const { data: candidate, error: candErr } = await supabaseDb
      .from('candidates')
      .select('id,user_id')
      .eq('id', candidateId)
      .maybeSingle();
    if (candErr) throw candErr;
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if ((candidate as any).user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    if (job_id) {
      const { data: job, error: jobErr } = await supabaseDb
        .from('job_requisitions')
        .select('id,user_id')
        .eq('id', job_id)
        .maybeSingle();
      if (jobErr) throw jobErr;
      if (!job) return res.status(400).json({ error: 'job_id not found' });
      if ((job as any).user_id !== userId) return res.status(403).json({ error: 'Forbidden (job)' });
    }

    const insertRow: any = {
      candidate_id: candidateId,
      job_id: job_id || null,
      notes,
      created_by: userId,
      created_at: new Date().toISOString()
    };
    if (status) insertRow.status = status;

    const { data: row, error } = await supabaseDb
      .from('candidate_activities')
      .insert(insertRow)
      .select('id, candidate_id, job_id, status, notes, created_at, created_by')
      .single();
    if (error) throw error;

    // Normalized payload (mirrors UI ActivityLogSection shape used elsewhere)
    const activity = {
      id: row.id,
      candidate_id: row.candidate_id,
      job_id: row.job_id,
      activity_type,
      tags: tags.length ? tags : (row.status ? [row.status] : [activity_type]),
      status: row.status || null,
      notes: row.notes || null,
      activity_timestamp: row.created_at,
      created_at: row.created_at,
      created_by: row.created_by,
      origin: 'candidate'
    };

    // Emit a candidate_updated zap event so Zapier/Make polling triggers can react.
    try {
      await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES }) => {
        emitZapEvent({
          userId,
          eventType: ZAP_EVENT_TYPES.CANDIDATE_UPDATED,
          eventData: {
            candidate_id: candidateId,
            action: 'activity_logged',
            activity_type,
            status: row.status || null,
            notes: row.notes || null,
            tags,
            job_id: row.job_id
          },
          sourceTable: 'candidate_activities',
          sourceId: row.id
        });
      });
    } catch (e) {
      console.warn('[Zapier] candidate activity emit event failed', (e as any)?.message || e);
    }

    return res.status(201).json({
      success: true,
      activity,
      message: `${activity_type} activity logged`
    });
  } catch (err: any) {
    console.error('[Zapier] POST /candidates/:id/activities error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Get a single candidate by id (must belong to API-key user).
 *
 * GET /api/zapier/candidates/:id
 */
router.get('/candidates/:id', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const candidateId = String(req.params.id || '').trim();
    if (!candidateId) return res.status(400).json({ error: 'Missing candidate id' });

    const { data: candidate, error } = await supabaseDb
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    return res.status(200).json({ candidate });
  } catch (err: any) {
    console.error('[Zapier] GET /candidates/:id error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Convert a lead → client (and optionally seed decision-maker contacts).
 * Mirrors POST /api/clients/convert-lead but is authenticated via X-API-Key
 * so external agents can run it.
 *
 * POST /api/zapier/leads/:id/convert-to-client
 * Body:
 *  - include_contacts   boolean (default false)
 *  - contacts           array of { name, title, email, phone } (used when include_contacts=true)
 *  - archive_lead       boolean (default true) – if true, marks lead status=archived
 */
router.post('/leads/:id/convert-to-client', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = String(req.params.id || '').trim();
    if (!leadId) return res.status(400).json({ error: 'Missing lead id' });

    const body = (req.body || {}) as any;
    const include_contacts = Boolean(body.include_contacts);
    const contacts: any[] = Array.isArray(body.contacts) ? body.contacts : [];
    const archive_lead = body.archive_lead === undefined ? true : Boolean(body.archive_lead);

    const { data: lead, error: leadErr } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if ((lead as any).user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    // Derive company info from enrichment if available
    const enrich: any = (lead as any).enrichment_data || {};
    const apolloOrg: any = enrich?.apollo?.organization || {};
    const domainFromEnrich = apolloOrg.website_url || apolloOrg.domain || null;
    const industryFromEnrich = apolloOrg.industry || null;
    const locationFromEnrich =
      apolloOrg.location ||
      (enrich?.apollo?.location?.city
        ? `${enrich.apollo.location.city}${enrich.apollo.location.state ? ', ' + enrich.apollo.location.state : ''}`
        : null);

    const parseRevenue = (value: any): number | null => {
      if (value == null) return null;
      if (typeof value === 'number') return value;
      const s = String(value).trim().toUpperCase();
      const mult = s.endsWith('B') ? 1_000_000_000 : s.endsWith('M') ? 1_000_000 : s.endsWith('K') ? 1_000 : 1;
      const cleaned = s.replace(/[^0-9.]/g, '');
      const n = Number(cleaned);
      if (isNaN(n)) return null;
      return Math.round(n * mult);
    };
    const revenueFromEnrich = parseRevenue(apolloOrg.estimated_annual_revenue || apolloOrg.revenue || null);

    const insertClient: any = {
      name: lead.company || apolloOrg.name || 'Untitled Company',
      domain: domainFromEnrich ? normalizeDomain(domainFromEnrich) : null,
      industry: industryFromEnrich || null,
      revenue: revenueFromEnrich,
      location: locationFromEnrich || (lead as any).location || null,
      owner_id: userId,
      created_at: new Date().toISOString()
    };

    const { data: clientRow, error: clientErr } = await supabaseDb
      .from('clients')
      .insert(insertClient)
      .select('*')
      .single();
    if (clientErr || !clientRow) {
      console.error('[Zapier] convert-to-client insert error', clientErr);
      return res.status(500).json({ error: 'failed_create_client', details: clientErr?.message });
    }

    let createdContacts: any[] = [];
    if (include_contacts && contacts.length) {
      const rows = contacts.map((c: any) => ({
        client_id: clientRow.id,
        name: c?.name || null,
        title: c?.title || null,
        email: c?.email || null,
        phone: c?.phone || null,
        owner_id: userId,
        created_at: new Date().toISOString()
      }));
      const { data: ins, error: cErr } = await supabaseDb
        .from('contacts')
        .insert(rows)
        .select('*');
      if (cErr) console.warn('[Zapier] convert-to-client: contacts insert warning', cErr.message);
      createdContacts = ins || [];
    }

    if (archive_lead) {
      await supabaseDb
        .from('leads')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('user_id', userId);
    }

    // Emit a client_created event so polling triggers (event_type=client_created) can react.
    try {
      await import('../lib/zapEventEmitter').then(({ emitZapEvent }) => {
        emitZapEvent({
          userId,
          eventType: 'client_created' as any,
          eventData: {
            client_id: clientRow.id,
            client_name: clientRow.name,
            client_domain: clientRow.domain,
            from_lead_id: leadId,
            contacts_created: createdContacts.length
          },
          sourceTable: 'clients',
          sourceId: clientRow.id
        });
      });
    } catch (e) {
      console.warn('[Zapier] convert-to-client: emit event failed', (e as any)?.message || e);
    }

    // Also emit lead_converted so existing automations watching that event still fire.
    try {
      await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES }) => {
        emitZapEvent({
          userId,
          eventType: ZAP_EVENT_TYPES.LEAD_CONVERTED,
          eventData: {
            lead_id: leadId,
            client_id: clientRow.id,
            client_name: clientRow.name,
            target: 'client'
          },
          sourceTable: 'leads',
          sourceId: leadId
        });
      });
    } catch (e) {
      console.warn('[Zapier] convert-to-client: emit lead_converted event failed', (e as any)?.message || e);
    }

    return res.status(200).json({
      success: true,
      client: clientRow,
      contacts: createdContacts,
      lead_archived: archive_lead
    });
  } catch (err: any) {
    console.error('[Zapier] POST /leads/:id/convert-to-client error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Create an opportunity (deal) tied to a client owned by the API-key user.
 *
 * POST /api/zapier/opportunities
 * Body:
 *  - title           required, string
 *  - client_id       required, UUID of a `clients` row owned by the API-key user
 *  - stage           optional string (free-form pipeline stage label)
 *  - status          optional string (defaults to "open")
 *  - value           optional number (deal value)
 *  - billing_type    optional string ("contingency" | "retained" | "one_time" | etc.)
 *  - tag             optional string (e.g. "rss", "job_seeker", custom tag)
 *  - forecast_date   optional YYYY-MM-DD or ISO timestamp (date-only is stored)
 *  - start_date      optional YYYY-MM-DD or ISO timestamp (date-only is stored)
 *  - term_months     optional, must be one of 1, 3, 6, 12
 *  - margin          optional number
 *  - margin_type     optional, "currency" or "percent" (defaults to "currency")
 *  - idempotency_key optional, used to dedupe repeat calls (recommended for Zapier/Make)
 */
router.post('/opportunities', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body = (req.body || {}) as any;

    const title = String(body.title || '').trim();
    const client_id = String(body.client_id || '').trim();
    const stage = body.stage != null ? String(body.stage).trim() : null;
    const status = body.status != null && String(body.status).trim() ? String(body.status).trim() : 'open';
    const billing_type = body.billing_type != null ? String(body.billing_type).trim() : null;
    const tag = body.tag != null ? String(body.tag).trim() : null;
    const idempotency_key = String(body.idempotency_key || '').trim();

    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });

    // Numeric: value
    let value: number | null = null;
    if (body.value != null && body.value !== '') {
      const n = Number(body.value);
      if (!isFinite(n)) return res.status(400).json({ error: 'invalid value' });
      value = n;
    }

    // Dates: forecast_date, start_date — accept either YYYY-MM-DD or full ISO; store date-only
    const parseDate = (raw: any): string | null | 'INVALID' => {
      if (raw == null || raw === '') return null;
      if (typeof raw !== 'string') return 'INVALID';
      const v = raw.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'INVALID';
      return v;
    };
    const forecast_date = parseDate(body.forecast_date);
    if (forecast_date === 'INVALID') return res.status(400).json({ error: 'invalid forecast_date' });
    const start_date = parseDate(body.start_date);
    if (start_date === 'INVALID') return res.status(400).json({ error: 'invalid start_date' });

    // term_months: must be one of 1, 3, 6, 12 (or null)
    let term_months: number | null = null;
    if (body.term_months != null && body.term_months !== '') {
      const n = Number(body.term_months);
      if (![1, 3, 6, 12].includes(n)) return res.status(400).json({ error: 'invalid term_months (must be 1, 3, 6, or 12)' });
      term_months = n;
    }

    // margin: numeric or null
    let margin: number | null = null;
    if (body.margin != null && body.margin !== '') {
      const n = Number(body.margin);
      if (!isFinite(n)) return res.status(400).json({ error: 'invalid margin' });
      margin = n;
    }

    // margin_type: 'currency' | 'percent'
    let margin_type: string = 'currency';
    if (body.margin_type != null && body.margin_type !== '') {
      const v = String(body.margin_type).toLowerCase();
      if (v !== 'currency' && v !== 'percent') return res.status(400).json({ error: 'invalid margin_type (must be "currency" or "percent")' });
      margin_type = v;
    }

    // Idempotency: dedupe by user-scoped key
    if (idempotency_key) {
      const ok = await ensureIdempotent(`opportunity:${userId}:${idempotency_key}`);
      if (!ok) {
        // On repeat, try to look up the previously created opportunity by title+client+owner
        const { data: existing } = await supabaseDb
          .from('opportunities')
          .select('*')
          .eq('owner_id', userId)
          .eq('client_id', client_id)
          .eq('title', title)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return res.status(200).json({ deduped: true, opportunity: existing || null });
      }
    }

    // Validate client ownership: the client must belong to the API-key user
    const { data: client, error: clientErr } = await supabaseDb
      .from('clients')
      .select('id, owner_id')
      .eq('id', client_id)
      .maybeSingle();
    if (clientErr) throw clientErr;
    if (!client) return res.status(400).json({ error: 'client_id not found' });
    if ((client as any).owner_id !== userId) return res.status(403).json({ error: 'Forbidden (client)' });

    const nowIso = new Date().toISOString();
    const insertRow: any = {
      title,
      client_id,
      stage,
      status,
      value,
      billing_type,
      tag,
      forecast_date,
      start_date,
      term_months,
      margin,
      margin_type,
      owner_id: userId,
      created_at: nowIso,
      updated_at: nowIso
    };

    const { data: opp, error } = await supabaseDb
      .from('opportunities')
      .insert(insertRow)
      .select('*')
      .single();
    if (error) {
      // If the schema lacks margin_type (older DBs), retry without it.
      if ((error as any).code === '42703') {
        const fallback = { ...insertRow };
        delete fallback.margin_type;
        const retry = await supabaseDb.from('opportunities').insert(fallback).select('*').single();
        if (retry.error) throw retry.error;
        return res.status(201).json({ success: true, opportunity: retry.data });
      }
      throw error;
    }

    return res.status(201).json({ success: true, opportunity: opp });
  } catch (err: any) {
    console.error('[Zapier] POST /opportunities error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Get a single opportunity by id (must belong to API-key user).
 *
 * GET /api/zapier/opportunities/:id
 */
router.get('/opportunities/:id', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const oppId = String(req.params.id || '').trim();
    if (!oppId) return res.status(400).json({ error: 'Missing opportunity id' });

    const { data: opp, error } = await supabaseDb
      .from('opportunities')
      .select('*')
      .eq('id', oppId)
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

    return res.status(200).json({ opportunity: opp });
  } catch (err: any) {
    console.error('[Zapier] GET /opportunities/:id error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Mount test endpoints
router.use('/', zapierTestRouter);

export default router; 