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
    const { data: existing, error: findErr } = await supabaseDb
      .from('leads')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('email', lead.email)
      .maybeSingle();
    if (findErr) throw findErr;

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

// Mount test endpoints
router.use('/', zapierTestRouter);

export default router; 