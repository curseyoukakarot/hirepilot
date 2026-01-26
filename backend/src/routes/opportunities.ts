import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { createZapEvent, EVENT_TYPES } from '../lib/events';
import { getDealsSharingContext } from '../lib/teamDealsScope';
import { isDealsEntitled } from '../lib/dealsEntitlement';
import { applyWorkspaceScope, WORKSPACES_ENFORCE_STRICT } from '../lib/workspaceScope';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const scoped = (req: Request, table: string, ownerColumn: string = 'user_id') => {
  const base: any = supabase.from(table);
  const scopeArgs = {
    workspaceId: (req as any).workspaceId,
    userId: (req as any)?.user?.id,
    ownerColumn
  };
  return {
    select: (columns: string) => applyWorkspaceScope(base.select(columns), scopeArgs),
    insert: (values: any) => base.insert(values),
    update: (values: any) => applyWorkspaceScope(base.update(values), scopeArgs),
    delete: () => applyWorkspaceScope(base.delete(), scopeArgs)
  };
};

const scopedNoOwner = (req: Request, table: string) => {
  const base: any = supabase.from(table);
  const workspaceId = (req as any).workspaceId;
  const applyNoOwnerScope = (query: any) => {
    if (!workspaceId) return query;
    if (WORKSPACES_ENFORCE_STRICT) return query.eq('workspace_id', workspaceId);
    return query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  };
  return {
    select: (columns: string) => applyNoOwnerScope(base.select(columns)),
    insert: (values: any) => base.insert(values),
    update: (values: any) => applyNoOwnerScope(base.update(values)),
    delete: () => applyNoOwnerScope(base.delete())
  };
};

async function getRoleTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).maybeSingle();
  return { role: String((data as any)?.role || ''), team_id: (data as any)?.team_id || null };
}

async function canViewOpportunities(userId: string): Promise<boolean> {
  return await isDealsEntitled(userId);
}

// GET /api/opportunities
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { role, team_id } = await getRoleTeam(userId);
  const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
  // Even if super admin, default to user's scoped view unless explicitly overridden with ?all=true
  const forceAll = String((req.query as any)?.all || 'false').toLowerCase() === 'true';
    const teamCtx = await getDealsSharingContext(userId);

    let base = scoped(req, 'opportunities', 'owner_id')
      .select('id,title,value,billing_type,stage,status,owner_id,client_id,created_at,tag,forecast_date,start_date,term_months,margin,margin_type');

    if (isSuper) {
      // SECURITY: super admins should not see other users' deals by default
      if (!forceAll) base = base.eq('owner_id', userId);
    } else {
      // Team deals pooling: when enabled, show all team opportunities; otherwise only own.
      const visible = teamCtx.visibleOwnerIds || [userId];
      base = base.in('owner_id', visible.length ? visible : [userId]);
    }

    // Basic filters: status, client, search
    const status = String(req.query.status || '').trim();
    const client = String(req.query.client || '').trim();
    const search = String(req.query.search || '').trim();
    if (status) base = base.eq('stage', status);
    if (client) base = base.eq('client_id', client);

    const { data: opps, error } = await base.order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }

    const clientIds = Array.from(new Set((opps || []).map((o: any) => o.client_id).filter(Boolean)));
    const ownerIds = Array.from(new Set((opps || []).map((o: any) => o.owner_id).filter(Boolean)));
    const oppIds = Array.from(new Set((opps || []).map((o: any) => o.id)));

    const [{ data: clients }, { data: owners }, { data: links }] = await Promise.all([
      clientIds.length ? scoped(req, 'clients', 'owner_id').select('id,name,domain').in('id', clientIds) : Promise.resolve({ data: [] as any }),
      ownerIds.length ? supabase.from('users').select('id,first_name,last_name,avatar_url').in('id', ownerIds) : Promise.resolve({ data: [] as any }),
      oppIds.length ? scopedNoOwner(req, 'opportunity_job_reqs').select('opportunity_id,req_id').in('opportunity_id', oppIds) : Promise.resolve({ data: [] as any })
    ] as any);

    type ClientLite = { id: string; name?: string | null; domain?: string | null };
    const clientMap: Map<string, ClientLite> = new Map<string, ClientLite>(
      ((clients || []) as any[]).map((c: any) => [String(c.id), { id: String(c.id), name: c.name ?? null, domain: c.domain ?? null }])
    );
    const ownerMap = new Map((owners || []).map((u: any) => [u.id, u]));
    const reqMap = new Map<string, string[]>();
    for (const l of (links || [])) {
      const arr = reqMap.get(l.opportunity_id) || [];
      arr.push(l.req_id);
      reqMap.set(l.opportunity_id, arr);
    }

    // Optional search over title/company domain
    const filtered = (opps || []).filter((o: any) => {
      if (!search) return true;
      const clientRow = clientMap.get(String(o.client_id)) as ClientLite | undefined;
      const company = (clientRow?.name || clientRow?.domain || '') as string;
      const tags = (reqMap.get(o.id) || []).join(' ');
      const s = search.toLowerCase();
      return String(o.title || '').toLowerCase().includes(s) || String(company).toLowerCase().includes(s) || tags.toLowerCase().includes(s);
    });

    const result = filtered.map((o: any) => ({
      ...o,
      client: clientMap.get(o.client_id) || null,
      owner: ownerMap.get(o.owner_id) || null,
      reqs: reqMap.get(o.id) || []
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/opportunities/available-reqs — list selectable job reqs for the user's scope (name sorted)
router.get('/available-reqs', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const forceAll = String((req.query as any)?.all || 'false').toLowerCase() === 'true';
    const isTeamAdmin = role.toLowerCase() === 'team_admin';
    let base = scoped(req, 'job_requisitions').select('id,title,user_id');
    if (!(isSuper && forceAll)) {
      if (isTeamAdmin && team_id) {
        const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
        const ids = (teamUsers || []).map((u: any) => u.id);
        base = base.in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else {
        base = base.eq('user_id', userId);
      }
    }
    const { data, error } = await base.order('title', { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// GET /api/opportunities/stages
router.get('/stages', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { team_id } = await getRoleTeam(userId);
    const { data, error } = await scopedNoOwner(req, 'opportunity_stages')
      .select('id,name,order_index,team_id')
      .eq('team_id', team_id)
      .order('order_index', { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Fallback defaults if none defined
    const defaults = ["Pipeline","Best Case","Commit","Close Won","Closed Lost"].map((name, i) => ({ id: `default_${i}`, name, order_index: i }));
    res.json((data && data.length) ? data : defaults);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/opportunities/:id (detail)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const { role, team_id } = await getRoleTeam(userId);
    const lc = role.toLowerCase();
    const isSuper = ['super_admin','superadmin'].includes(lc);
    const forceAll = String((req.query as any)?.all || 'false').toLowerCase() === 'true';
    const teamCtx = await getDealsSharingContext(userId);

    let oppQuery = scoped(req, 'opportunities', 'owner_id').select('*').eq('id', id);
    if (isSuper) {
      if (!forceAll) oppQuery = oppQuery.eq('owner_id', userId);
    } else {
      const visible = teamCtx.visibleOwnerIds || [userId];
      oppQuery = oppQuery.in('owner_id', visible.length ? visible : [userId]);
    }

    const { data: opp, error } = await oppQuery.maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!opp) { res.status(404).json({ error: 'not_found' }); return; }

    // fetch req links
    const { data: links } = await scopedNoOwner(req, 'opportunity_job_reqs').select('req_id').eq('opportunity_id', id);
    // fetch client and owner
    const [{ data: clientRow }, { data: ownerRow }] = await Promise.all([
      opp.client_id ? scoped(req, 'clients', 'owner_id').select('id,name,domain').eq('id', opp.client_id).maybeSingle() : Promise.resolve({ data: null }),
      opp.owner_id ? supabase.from('users').select('id,first_name,last_name,email').eq('id', opp.owner_id).maybeSingle() : Promise.resolve({ data: null })
    ] as any);
    const owner_name = ownerRow ? [ownerRow.first_name, ownerRow.last_name].filter(Boolean).join(' ') || ownerRow.email : null;
    // Attach candidate cards from applications and submissions
    const reqIds = (links || []).map((l: any) => l.req_id);
    const [{ data: apps }, { data: subs }, { data: legacy }] = await Promise.all([
      supabase.from('candidate_applications').select('*').eq('opportunity_id', id).order('created_at', { ascending: false }),
      supabase.from('candidate_submissions').select('*').eq('opportunity_id', id).order('created_at', { ascending: false }),
      (reqIds.length
        ? scoped(req, 'candidates')
            .select('id,first_name,last_name,email,linkedin_url,resume_url,notes,job_id,created_at,source')
            .in('job_id', reqIds)
            .eq('source', 'public_application')
        : Promise.resolve({ data: [] as any })) as any
    ] as any);

    // Also surface candidates currently linked to the attached Job REQs via candidate_jobs
    // so they appear in the Opportunity viewer without requiring re-submission.
    let linkedReqCandidates: any[] = [];
    if (reqIds.length) {
      try {
        // Step 1: fetch candidate_ids for the linked REQs
        const { data: cjRows, error: cjErr } = await scopedNoOwner(req, 'candidate_jobs')
          .select('candidate_id')
          .in('job_id', reqIds);
        if (cjErr) {
          console.log('[opportunities/:id] candidate_jobs error', cjErr);
        }
        const candIds = Array.from(new Set((cjRows || []).map((r: any) => r.candidate_id).filter(Boolean)));

        // Step 2: fetch candidates by ids, with progressive fallbacks for columns missing in prod
        if (candIds.length) {
          let candRows: any[] = [];
          let attempt: any = await scoped(req, 'candidates')
            .select('id,first_name,last_name,email,linkedin_url,resume_url,title,years_experience,created_at,enrichment_data')
            .in('id', candIds);
          if (attempt.error && String((attempt.error as any).code || '') === '42703') {
            attempt = await scoped(req, 'candidates')
              .select('id,first_name,last_name,email,linkedin_url,resume_url,title,years_experience,created_at')
              .in('id', candIds);
            if (attempt.error && String((attempt.error as any).code || '') === '42703') {
              attempt = await scoped(req, 'candidates')
                .select('id,first_name,last_name,email,linkedin_url,resume_url,title,created_at')
                .in('id', candIds);
            }
          }
          if (attempt.error) {
            console.log('[opportunities/:id] candidates error', attempt.error);
          }
          candRows = attempt.data || [];

          linkedReqCandidates = (candRows || []).map((c: any) => ({
            id: `jobreq_${c.id}`,
            candidate_id: c.id,
            first_name: c.first_name || null,
            last_name: c.last_name || null,
            email: c.email || null,
            linkedin_url: c.linkedin_url || null,
            title: c.title || null,
            years_experience: (c as any).years_experience || null,
            resume_url: c.resume_url || null,
            notable_impact: (c.enrichment_data?.last_submission?.impact) || null,
            motivation: (c.enrichment_data?.last_submission?.motivation) || null,
            additional_notes: (c.enrichment_data?.last_submission?.accolades) || null,
            created_at: c.created_at || null,
            _from_job_req: true
          }));
        }
      } catch (e) {
        console.log('[opportunities/:id] linkedReqCandidates exception', e);
      }
    }

    // Map legacy candidates into application-like objects so UI can render them
    const legacyApps = (legacy || []).map((c: any) => ({
      id: `legacy_${c.id}`,
      full_name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email,
      email: c.email,
      linkedin_url: c.linkedin_url,
      resume_url: c.resume_url,
      cover_note: c.notes,
      created_at: c.created_at,
      _legacy: true
    }));

    // Merge, preferring explicit candidate_applications if duplicates by email+resume
    const merged: any[] = [];
    const seen = new Set<string>();
    for (const row of ([...(apps || []), ...legacyApps] as any[])) {
      const key = `${String(row.email || '').toLowerCase()}|${String(row.resume_url || '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }

    // Merge job-req-linked candidates into submissions, avoiding duplicates by candidate_id or email
    const subsOut = (() => {
      const out: any[] = [...(subs || [])];
      const seenById = new Set<string>(out.map((s:any)=>String(s.candidate_id||'')));
      const seenByEmail = new Set<string>(out.map((s:any)=>String(s.email||'').toLowerCase()).filter(Boolean));
      for (const row of (linkedReqCandidates || [])) {
        const idKey = String(row.candidate_id || '');
        const emailKey = String(row.email || '').toLowerCase();
        if ((idKey && seenById.has(idKey)) || (emailKey && seenByEmail.has(emailKey))) continue;
        if (idKey) seenById.add(idKey);
        if (emailKey) seenByEmail.add(emailKey);
        out.push(row);
      }
      return out;
    })();

    res.json({
      ...opp,
      req_ids: reqIds,
      client: clientRow,
      owner: { id: ownerRow?.id, name: owner_name, email: ownerRow?.email },
      applications: merged,
      submissions: subsOut
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/opportunities/:id/linked-candidates (diagnostic)
router.get('/:id/linked-candidates', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const { data: links } = await scopedNoOwner(req, 'opportunity_job_reqs').select('req_id').eq('opportunity_id', id);
    const reqIds = (links || []).map((l: any) => l.req_id);

    // Preferred: single join identical to pipeline route
    let joined: any[] = [];
    let joinError: any = null;
    if (reqIds.length) {
      let data: any[] | null = null; let error: any = null;
      // Attempt with years_experience
      let resp: any = await scopedNoOwner(req, 'candidate_jobs')
        .select('candidate_id, candidates(id,first_name,last_name,email,linkedin_url,resume_url,title,years_experience,created_at)')
        .in('job_id', reqIds);
      data = resp.data || null; error = resp.error || null;
      if (error && String(error.code || '') === '42703') {
        // Fallback without years_experience
        resp = await scopedNoOwner(req, 'candidate_jobs')
          .select('candidate_id, candidates(id,first_name,last_name,email,linkedin_url,resume_url,title,created_at)')
          .in('job_id', reqIds);
        data = resp.data || null; error = resp.error || null;
      }
      joined = data || [];
      joinError = error || null;
    }

    const candidatesOut = (joined || []).map((row: any) => {
      const c = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
      return {
        candidate_id: row.candidate_id,
        first_name: c?.first_name || null,
        last_name: c?.last_name || null,
        email: c?.email || null,
        title: c?.title || null,
        years_experience: c?.years_experience || null,
        resume_url: c?.resume_url || null,
        linkedin_url: c?.linkedin_url || null
      };
    });

    res.json({ req_ids: reqIds, count: candidatesOut.length, candidates: candidatesOut, _debug: { joinErrorCode: joinError?.code || null, joinErrorMsg: joinError?.message || null } });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// PATCH /api/opportunities/:id/notes
router.patch('/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const { notes } = req.body || {};
    const { data, error } = await scoped(req, 'opportunities', 'owner_id')
      .update({ notes: notes ?? null })
      .eq('id', id)
      .select('id,notes')
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    // Emit zap event
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.opportunity_note_added,
        user_id: userId,
        entity: 'opportunity',
        entity_id: id,
        payload: { note: data }
      });
    } catch {}
    res.json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// POST /api/opportunities/:id/backfill-submissions — scan recent sent emails and persist recruiter submissions
router.post('/:id/backfill-submissions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const days = Number(req.body?.days || 45);
    const sinceIso = new Date(Date.now() - days*24*60*60*1000).toISOString();

    // Fetch recent messages; filter in Node for our template
    const { data: msgs, error: msgErr } = await scoped(req, 'messages')
      .select('id,subject,content,recipient,to_email,sent_at')
      .eq('user_id', userId)
      .gte('sent_at', sinceIso)
      .order('sent_at', { ascending: false })
      .limit(1000);
    if (msgErr) { res.status(500).json({ error: msgErr.message }); return; }

    const parseSubmission = (html: string) => {
      const txt = String(html || '')
        .replace(/<br\s*\/??>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ');
      const get = (label: string) => {
        const re = new RegExp(label.replace(/[-/\\^$*+?.()|[\]{}]/g, r=>r)+"\s*:\\s*([\\s\\S]*?)\\n(?:[A-Z].*?:|$)", 'i');
        const m = txt.match(re);
        return (m?.[1] || '').trim();
      };
      const byLine = (label: string) => {
        const re = new RegExp(label+"\\s*:\\s*(.*)", 'i');
        const m = txt.match(re); return (m?.[1] || '').trim();
      };
      const name = get('Name') || byLine('Name');
      const [first_name, ...rest] = name.split(/\s+/);
      const last_name = rest.join(' ');
      const email = (get('Email') || byLine('Email')).split(/\s/)[0];
      const linkedin_url = (get('Profile Link') || byLine('Profile Link'));
      const title = get('Position') || byLine('Position');
      const years_experience = (get('Years of Experience') || byLine('Years of Experience'));
      const notable_impact = get('Notable Impact') || byLine('Notable Impact');
      const motivation = get('Motivation') || byLine('Motivation');
      const additional_notes = get('Additional things to note') || get('Additional Accolades') || '';
      const resumeBlock = get('Resume') || byLine('Resume');
      const resume_urlMatch = resumeBlock.match(/https?:[^\s]+/i);
      const resume_url = resume_urlMatch?.[0] || '';
      return { first_name, last_name, email, linkedin_url, title, years_experience, resume_url, notable_impact, motivation, additional_notes, form_json: { raw: txt.slice(0, 4000) } };
    };

    let created = 0; let scanned = 0; const errors: any[] = [];
    for (const m of (msgs || [])) {
      const content = String((m as any).content || '');
      const subject = String((m as any).subject || '');
      if (!content) continue;
      // Heuristics: subject includes our default OR content has key labels
      const looksLike = /Candidate for your review/i.test(subject) || /Name:\s|Profile\s+Link:\s|Resume:/i.test(content);
      if (!looksLike) continue;
      scanned++;
      const s = parseSubmission(content);
      if (!s.email && !s.resume_url && !s.linkedin_url) continue; // too sparse
      try {
        // de-dupe by email+resume per opportunity
        const { data: exists } = await supabase
          .from('candidate_submissions')
          .select('id')
          .eq('opportunity_id', id)
          .eq('email', s.email || null)
          .maybeSingle();
        if (!exists) {
          const insert = { opportunity_id: id, collaborator_user_id: userId, ...s } as any;
          const { error: insErr } = await supabaseAdmin.from('candidate_submissions').insert(insert);
          if (!insErr) created++;
        }
      } catch (e:any) { errors.push(e?.message || 'insert_failed'); }
      if (created >= 50) break; // safety cap
    }

    res.json({ ok: true, scanned, created, errors: errors.slice(0, 5) });
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// Activity log (simple)
router.get('/:id/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await scoped(req, 'opportunity_activity')
      .select('*')
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

router.post('/:id/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const { message } = req.body || {};
    const { data, error } = await scoped(req, 'opportunity_activity')
      .insert({ opportunity_id: id, user_id: userId, message, created_at: new Date().toISOString() })
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// POST /api/opportunities/:id/application — save public application
router.post('/:id/application', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const { full_name, email, linkedin_url, resume_url, cover_note, form_json } = req.body || {};
    const { data, error } = await supabaseAdmin
      .from('candidate_applications')
      .insert({ opportunity_id: id, full_name, email, linkedin_url, resume_url, cover_note, form_json: form_json || {} })
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    // Emit zap event
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.opportunity_application_created,
        user_id: userId,
        entity: 'opportunity',
        entity_id: id,
        payload: { opportunityId: id, application: data }
      });
    } catch {}
    res.status(201).json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// POST /api/opportunities/:id/submission — save collaborator submission
router.post('/:id/submission', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const payload = req.body || {};
    const insert = {
      opportunity_id: id,
      collaborator_user_id: userId,
      first_name: payload.first_name || null,
      last_name: payload.last_name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      linkedin_url: payload.linkedin_url || null,
      title: payload.title || null,
      location: payload.location || null,
      years_experience: payload.years_experience || null,
      expected_compensation: payload.expected_compensation || null,
      resume_url: payload.resume_url || null,
      notable_impact: payload.notable_impact || null,
      motivation: payload.motivation || null,
      additional_notes: payload.additional_notes || null,
      form_json: payload.form_json || {}
    } as any;
    const { data, error } = await supabaseAdmin.from('candidate_submissions').insert(insert).select('*').single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// POST /api/opportunities/:id/submit-to-client — one-click email
router.post('/:id/submit-to-client', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const { to, subject, html, text, provider, submission } = req.body || {};
    if (!to) { res.status(400).json({ error: 'missing_to' }); return; }
    // send via provider service
    const { sendFromUser } = await import('../../services/providerEmail');
    const sent = await sendFromUser(userId, { to, subject: subject || 'Candidate Submission', html: html || text, text, provider });
    if (!sent.ok) { res.status(400).json({ error: sent.reason || 'send_failed' }); return; }
    // Persist submission if payload present
    try {
      if (submission && typeof submission === 'object') {
        const insert = {
          opportunity_id: id,
          collaborator_user_id: userId,
          first_name: submission.first_name || null,
          last_name: submission.last_name || null,
          email: submission.email || null,
          phone: submission.phone || null,
          linkedin_url: submission.linkedin_url || null,
          title: submission.title || null,
          location: submission.location || null,
          years_experience: submission.years_experience || null,
          expected_compensation: submission.expected_compensation || null,
          resume_url: submission.resume_url || null,
          notable_impact: submission.notable_impact || null,
          motivation: submission.motivation || null,
          additional_notes: submission.additional_notes || null,
          form_json: submission.form_json || submission
        } as any;
        await supabaseAdmin.from('candidate_submissions').insert(insert);
      }
    } catch (e) {
      console.warn('persist submission failed', (e as any)?.message || e);
    }
    // log activity
    try {
      await scoped(req, 'opportunity_activity').insert({
        opportunity_id: id,
        user_id: userId,
        message: 'Submitted candidate to client',
        created_at: new Date().toISOString()
      });
    } catch {}
    // Emit zap event (opportunity_submitted)
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.opportunity_submitted,
        user_id: userId,
        entity: 'opportunity',
        entity_id: id,
        payload: { opportunityId: id, submission: submission || null }
      });
    } catch {}
    res.json({ ok: true });
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// POST /api/opportunities/:id/notes — add Internal Note to job_activity_log
router.post('/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params; // job req id
    const text = String((req.body || {}).text || '').trim();
    if (!text) { res.status(400).json({ error: 'missing_text' }); return; }

    // Basic access check: owner, team_admin of same team, collaborator, or guest by email
    const { data: job } = await scoped(req, 'job_requisitions')
      .select('id,user_id,team_id')
      .eq('id', id)
      .maybeSingle();
    if (!job) return res.status(404).json({ error: 'not_found' });

    const { role, team_id } = await getRoleTeam(userId);
    const isOwner = (job as any).user_id === userId;
    const isTeamAdmin = String(role || '').toLowerCase() === 'team_admin' && !!team_id && team_id === (job as any).team_id;

    let allowed = isOwner || isTeamAdmin;
    if (!allowed) {
      const [{ data: collab }, { data: me }] = await Promise.all([
        supabase.from('job_collaborators').select('user_id').eq('job_id', id).eq('user_id', userId).maybeSingle(),
        supabase.from('users').select('email').eq('id', userId).maybeSingle()
      ] as any);
      const email = String((me as any)?.email || '').toLowerCase();
      if (collab) allowed = true;
      else if (email) {
        const { data: guest } = await supabase.from('job_guest_collaborators').select('id').eq('job_id', id).eq('email', email).maybeSingle();
        allowed = Boolean(guest);
      }
    }
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    // Insert server-side to bypass client RLS
    const { data, error } = await supabase
      .from('job_activity_log')
      .insert({ job_id: id, actor_id: userId, type: 'note_added', metadata: { text }, created_at: new Date().toISOString() })
      .select('id')
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    // Emit zap event (map job note to opportunity note for automations)
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.opportunity_note_added,
        user_id: userId,
        entity: 'opportunity',
        entity_id: id,
        payload: { note: { id: (data as any)?.id, text } }
      });
    } catch {}
    res.status(201).json({ id: (data as any)?.id || null });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// Collaborators (basic by email)
router.get('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await scopedNoOwner(req, 'opportunity_collaborators')
      .select('*')
      .eq('opportunity_id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

router.post('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body || {};
    const { data, error } = await scopedNoOwner(req, 'opportunity_collaborators')
      .insert({ opportunity_id: id, email, role: role || 'collaborator', created_at: new Date().toISOString() })
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    // Emit zap event
    try {
      const userId = (req as any).user?.id as string | undefined;
      if (userId) {
        await createZapEvent({
          event_type: EVENT_TYPES.opportunity_collaborator_added,
          user_id: userId,
          entity: 'opportunity',
          entity_id: id,
          payload: { collaborator: data }
        });
      }
    } catch {}
    res.status(201).json(data);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// Invite guest collaborator for a Job REQ (email)
  router.post('/:id/guest-invite', requireAuth, async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user?.id as string | undefined;
    if (!inviterId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params; // job req id
      const { email, role } = req.body || {};
    if (!email) return res.status(400).json({ error: 'missing_email' });

      const normalizedEmail = String(email).toLowerCase();
      const allowedRoles = new Set(['View Only','Commenter','View + Comment']);
      const roleToUse = allowedRoles.has(String(role)) ? String(role) : 'View Only';

      // If email belongs to an existing user, add as full collaborator (job_collaborators)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      let row: any = null;
      if (existingUser?.id) {
        // Ensure single row by (job_id, user_id)
        const { data: existingCollab } = await supabase
          .from('job_collaborators')
          .select('user_id')
          .eq('job_id', id)
          .eq('user_id', existingUser.id)
          .maybeSingle();
        if (!existingCollab) {
          const { error: insErr } = await supabase
            .from('job_collaborators')
            .insert({ job_id: id, user_id: existingUser.id, role: 'Editor' });
          if (insErr) return res.status(500).json({ error: insErr.message });
        }
        // Clean up any legacy guest record for this job/email so frontend doesn't mark as guest
        try {
          await supabase
            .from('job_guest_collaborators')
            .delete()
            .eq('job_id', id)
            .eq('email', normalizedEmail);
        } catch {}
        // Notify existing user by email (no acceptance needed)
        try {
          const appUrl = process.env.APP_URL || 'https://thehirepilot.com';
          const { data: jobRow } = await scoped(req, 'job_requisitions')
            .select('title')
            .eq('id', id)
            .maybeSingle();
          const { data: inviter } = await supabase
            .from('users')
            .select('first_name,last_name,email')
            .eq('id', inviterId)
            .maybeSingle();
          const inviterName = [inviter?.first_name, inviter?.last_name].filter(Boolean).join(' ') || inviter?.email || 'a teammate';
          const subject = `You were added to "${jobRow?.title || 'a Job Requisition'}" on HirePilot`;
          const html = `
            <p>Hi${existingUser?.id ? '' : ''},</p>
            <p>${inviterName} added you as a collaborator to the job requisition <strong>${jobRow?.title || ''}</strong>.</p>
            <p>No action is required. The requisition will now appear in your Jobs list.</p>
            <p><a href="${appUrl}/job/${id}">Open the requisition</a></p>
            <p style="color:#888;font-size:12px">You received this because your email (${normalizedEmail}) is a HirePilot account.</p>
          `;
          try {
            const { sendEmail } = await import('../../services/emailService');
            await sendEmail(normalizedEmail, subject, subject, html);
          } catch (e) {
            console.error('Email send failed (existing user collaborator notice):', e);
          }
        } catch {}
        row = { job_id: id, user_id: existingUser.id, is_member: true };
      } else {
        // Guest path: Ensure single row by (job_id, email) without requiring DB unique
        const { data: existing } = await supabase
          .from('job_guest_collaborators')
          .select('id')
          .eq('job_id', id)
          .eq('email', normalizedEmail)
          .maybeSingle();
        if (existing?.id) {
          const { data: upd, error: upErr } = await supabase
            .from('job_guest_collaborators')
            .update({ invited_by: inviterId, role: roleToUse })
            .eq('id', existing.id)
            .select('*')
            .maybeSingle();
          if (upErr) return res.status(500).json({ error: upErr.message });
          row = upd;
        } else {
          const { data: ins, error: insErr } = await supabase
            .from('job_guest_collaborators')
            .insert({ job_id: id, email: normalizedEmail, role: roleToUse, invited_by: inviterId, created_at: new Date().toISOString() })
            .select('*')
            .maybeSingle();
          if (insErr) return res.status(500).json({ error: insErr.message });
          row = ins;
        }
      }
    // server-side log (not subject to client RLS)
    try {
        const type = existingUser?.id ? 'collaborator_added' : 'guest_invited';
        await supabase.from('job_activity_log').insert({ job_id: id, actor_id: inviterId, type, metadata: { email: normalizedEmail, role: roleToUse, user_id: existingUser?.id || null }, created_at: new Date().toISOString() });
    } catch {}
      res.json(row || {});
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// List selectable job reqs for the user's scope (name sorted)
router.get('/:id/available-reqs', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const forceAll = String((req.query as any)?.all || 'false').toLowerCase() === 'true';
    const isTeamAdmin = role.toLowerCase() === 'team_admin';
    let base = scoped(req, 'job_requisitions').select('id,title,user_id');
  if (!(isSuper && forceAll)) {
      if (isTeamAdmin && team_id) {
        const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
        const ids = (teamUsers || []).map((u: any) => u.id);
        base = base.in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else {
        base = base.eq('user_id', userId);
      }
    }
    const { data, error } = await base.order('title', { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// Unified collaborators for a job (members + guests)
router.get('/:id/collaborators-unified', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;

    // Basic access: owner, team_admin of owner team, or existing collaborator/guest
    const { data: job } = await scoped(req, 'job_requisitions')
      .select('id,user_id,team_id')
      .eq('id', id)
      .maybeSingle();
    if (!job) return res.status(404).json({ error: 'not_found' });

    const { role, team_id } = await getRoleTeam(userId);
    const isOwner = job.user_id === userId;
    const isTeamAdmin = role.toLowerCase() === 'team_admin' && !!team_id && team_id === job.team_id;

    // Also allow if requester is already a collaborator/guest
    let isExisting = false;
    if (!isOwner && !isTeamAdmin) {
      const [{ data: collab }, { data: guest }] = await Promise.all([
        supabase.from('job_collaborators').select('user_id').eq('job_id', id).eq('user_id', userId).maybeSingle(),
        supabase.from('job_guest_collaborators').select('email').eq('job_id', id).maybeSingle()
      ] as any);
      isExisting = Boolean(collab) || false; // Email check omitted; this is an owner/team-admin view endpoint
    }
    if (!(isOwner || isTeamAdmin || isExisting)) return res.status(403).json({ error: 'access_denied' });

    const [{ data: members }, { data: guests }] = await Promise.all([
      supabase.from('job_collaborators').select('user_id,role').eq('job_id', id),
      supabase.from('job_guest_collaborators').select('email,role').eq('job_id', id)
    ] as any);

    const ids = [...new Set(((members || []).map((m:any)=>m.user_id)))];
    const { data: users } = ids.length
      ? await supabase.from('users').select('id,first_name,last_name,email,team_id,avatar_url').in('id', ids)
      : { data: [] as any } as any;
    const byId = new Map((users || []).map((u:any)=>[u.id,u]));

    const unified = [
      ...((members || []).map((m:any)=>({ kind: 'member', user_id: m.user_id, role: m.role || 'Editor', users: byId.get(m.user_id) || null }))),
      ...((guests || []).map((g:any)=>({ kind: 'guest', email: String(g.email||'').toLowerCase(), role: g.role || 'View Only' })))
    ];
    res.json(unified);
  } catch (e:any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// List users visible to Team Admin for assigning
router.get('/:id/available-users', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    if (role.toLowerCase() !== 'team_admin' || !team_id) { res.json([]); return; }
    const { data, error } = await supabase.from('users').select('id,first_name,last_name,email').eq('team_id', team_id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const rows = (data||[]).map((u:any)=>({ id: u.id, name: [u.first_name,u.last_name].filter(Boolean).join(' ') || u.email, email: u.email }));
    res.json(rows);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

// POST /api/opportunities
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const {
      title,
      client_id,
      stage,
      value,
      billing_type,
      tag,
      forecast_date: forecastDateRaw,
      start_date: startDateRaw,
      term_months: termMonthsRaw,
      margin: marginRaw,
      margin_type: marginTypeRaw
    } = req.body || {};
    let forecast_date: string | null = null;
    if (forecastDateRaw === null || forecastDateRaw === undefined || forecastDateRaw === '') {
      forecast_date = null;
    } else if (typeof forecastDateRaw === 'string') {
      // Store date-only (YYYY-MM-DD) even if client sent a full ISO timestamp
      forecast_date = forecastDateRaw.slice(0, 10);
      // basic shape check
      if (!/^\d{4}-\d{2}-\d{2}$/.test(forecast_date)) {
        res.status(400).json({ error: 'invalid_forecast_date' }); return;
      }
    } else {
      res.status(400).json({ error: 'invalid_forecast_date' }); return;
    }
    // start_date supports explicit null to clear
    let start_date: string | null = null;
    if (startDateRaw === null || startDateRaw === undefined || startDateRaw === '') {
      start_date = null;
    } else if (typeof startDateRaw === 'string') {
      start_date = startDateRaw.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
        res.status(400).json({ error: 'invalid_start_date' }); return;
      }
    } else {
      res.status(400).json({ error: 'invalid_start_date' }); return;
    }
    // term_months supports explicit null to clear
    let term_months: number | null = null;
    if (termMonthsRaw === null || termMonthsRaw === undefined || termMonthsRaw === '') {
      term_months = null;
    } else {
      const n = Number(termMonthsRaw);
      if (![1,3,6,12].includes(n)) { res.status(400).json({ error: 'invalid_term_months' }); return; }
      term_months = n;
    }
    // margin supports explicit null to clear
    let margin: number | null = null;
    if (marginRaw === null || marginRaw === undefined || marginRaw === '') {
      margin = null;
    } else {
      const n = Number(marginRaw);
      if (!isFinite(n)) { res.status(400).json({ error: 'invalid_margin' }); return; }
      margin = n;
    }
    let margin_type: string | null = 'currency';
    if (marginTypeRaw === null || marginTypeRaw === undefined || marginTypeRaw === '') {
      margin_type = 'currency';
    } else {
      const v = String(marginTypeRaw || '').toLowerCase();
      if (v !== 'currency' && v !== 'percent') { res.status(400).json({ error: 'invalid_margin_type' }); return; }
      margin_type = v;
    }
    const nowIso = new Date().toISOString();
    const insert = { title, client_id, stage, value, billing_type, tag: tag ?? null, forecast_date, start_date, term_months, margin, margin_type, status: 'open', owner_id: userId, created_at: nowIso, updated_at: nowIso as any };
    const { data, error } = await scoped(req, 'opportunities', 'owner_id').insert(insert).select('*').single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// PATCH /api/opportunities/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    // Fetch current to compare for workflow events
    const { data: beforeRow, error: beforeErr } = await scoped(req, 'opportunities', 'owner_id')
      .select('id,stage,status,tag,owner_id')
      .eq('id', id)
      .maybeSingle();
    if (beforeErr) { res.status(500).json({ error: beforeErr.message }); return; }
    if (!beforeRow) { res.status(404).json({ error: 'not_found' }); return; }

    // Writes: owner can edit; team_admin can edit within their team.
    const ctx = await getDealsSharingContext(userId);
    const roleLc = String(ctx.roleInTeam || '').toLowerCase();
    const isTeamAdmin = roleLc === 'admin';
    const isOwner = String((beforeRow as any).owner_id || '') === userId;
    if (!isOwner) {
      if (!isTeamAdmin || !ctx.teamId) { res.status(403).json({ error: 'access_denied' }); return; }
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', String((beforeRow as any).owner_id || '')).maybeSingle();
      if (!ownerRow || String((ownerRow as any).team_id || '') !== String(ctx.teamId)) {
        res.status(403).json({ error: 'access_denied' }); return;
      }
    }

    const up: any = {};
    // SECURITY: do not allow transferring ownership via API
    const fields = ['title','client_id','stage','value','billing_type','status','tag'];
    for (const f of fields) if (req.body?.[f] !== undefined) up[f] = req.body[f];
    // forecast_date supports explicit null to clear
    if (req.body?.forecast_date !== undefined) {
      const raw = req.body.forecast_date;
      if (raw === null || raw === '') {
        up.forecast_date = null;
      } else if (typeof raw === 'string') {
        const d = raw.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { res.status(400).json({ error: 'invalid_forecast_date' }); return; }
        up.forecast_date = d;
      } else {
        res.status(400).json({ error: 'invalid_forecast_date' }); return;
      }
    }
    // start_date supports explicit null to clear
    if (req.body?.start_date !== undefined) {
      const raw = req.body.start_date;
      if (raw === null || raw === '') {
        up.start_date = null;
      } else if (typeof raw === 'string') {
        const d = raw.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { res.status(400).json({ error: 'invalid_start_date' }); return; }
        up.start_date = d;
      } else {
        res.status(400).json({ error: 'invalid_start_date' }); return;
      }
    }
    // term_months supports explicit null to clear
    if (req.body?.term_months !== undefined) {
      const raw = req.body.term_months;
      if (raw === null || raw === '') {
        up.term_months = null;
      } else {
        const n = Number(raw);
        if (![1,3,6,12].includes(n)) { res.status(400).json({ error: 'invalid_term_months' }); return; }
        up.term_months = n;
      }
    }
    // margin supports explicit null to clear
    if (req.body?.margin !== undefined) {
      const raw = req.body.margin;
      if (raw === null || raw === '') {
        up.margin = null;
      } else {
        const n = Number(raw);
        if (!isFinite(n)) { res.status(400).json({ error: 'invalid_margin' }); return; }
        up.margin = n;
      }
    }
    if (req.body?.margin_type !== undefined) {
      const raw = req.body.margin_type;
      if (raw === null || raw === '') {
        up.margin_type = 'currency';
      } else {
        const v = String(raw || '').toLowerCase();
        if (v !== 'currency' && v !== 'percent') { res.status(400).json({ error: 'invalid_margin_type' }); return; }
        up.margin_type = v;
      }
    }
    up.updated_at = new Date().toISOString() as any;
    const { data, error } = await scoped(req, 'opportunities', 'owner_id')
      .update(up)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Update REQ links if provided
    if (Array.isArray(req.body?.req_ids)) {
      // delete existing and re-insert
      await scopedNoOwner(req, 'opportunity_job_reqs').delete().eq('opportunity_id', id);
      const rows = (req.body.req_ids as string[]).map((reqId) => ({ opportunity_id: id, req_id: reqId }));
      if (rows.length) await scopedNoOwner(req, 'opportunity_job_reqs').insert(rows);
    }

    // Emit workflow event if moved to Close Won with tag Job Seeker
    try {
      const afterStage = String((data as any)?.stage || up.stage || beforeRow?.stage || '').toLowerCase();
      const afterStatus = String((data as any)?.status || up.status || beforeRow?.status || '').toLowerCase();
      const afterTag = String((data as any)?.tag ?? up.tag ?? beforeRow?.tag ?? '').toLowerCase();
      const isCloseWon = /close\s*won/.test(afterStage) || ['close_won','closed_won','won'].includes(afterStatus);
      const isJobSeeker = afterTag === 'job seeker' || afterTag === 'job_seeker';
      if (isCloseWon && isJobSeeker) {
        await createZapEvent({
          event_type: EVENT_TYPES.opportunity_closed_won as any,
          user_id: userId,
          entity: 'opportunity',
          entity_id: id,
          payload: { id, stage: (data as any)?.stage || up.stage || beforeRow?.stage || null, status: (data as any)?.status || up.status || beforeRow?.status || null, tag: (data as any)?.tag ?? up.tag ?? beforeRow?.tag ?? null }
        });
      }
    } catch {}

    res.json(data || {});
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// DELETE /api/opportunities/:id — remove opportunity and unlink any job req associations
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    if (!id) { res.status(400).json({ error: 'id_required' }); return; }

    // Writes: owner can delete; team_admin can delete within their team.
    const { data: existing } = await scoped(req, 'opportunities', 'owner_id')
      .select('id,owner_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
    const ctx = await getDealsSharingContext(userId);
    const roleLc = String(ctx.roleInTeam || '').toLowerCase();
    const isTeamAdmin = roleLc === 'admin';
    const isOwner = String((existing as any).owner_id || '') === userId;
    if (!isOwner) {
      if (!isTeamAdmin || !ctx.teamId) { res.status(403).json({ error: 'access_denied' }); return; }
      const { data: ownerRow } = await supabase.from('users').select('team_id').eq('id', String((existing as any).owner_id || '')).maybeSingle();
      if (!ownerRow || String((ownerRow as any).team_id || '') !== String(ctx.teamId)) {
        res.status(403).json({ error: 'access_denied' }); return;
      }
    }

    // Best-effort: delete req links first to avoid FK constraints; do NOT delete job reqs themselves
    await scopedNoOwner(req, 'opportunity_job_reqs').delete().eq('opportunity_id', id);
    const { error } = await scoped(req, 'opportunities', 'owner_id').delete().eq('id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;


