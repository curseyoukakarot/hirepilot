import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';

const router = express.Router();

async function getRoleTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).maybeSingle();
  return { role: String((data as any)?.role || ''), team_id: (data as any)?.team_id || null };
}

async function canViewOpportunities(userId: string): Promise<boolean> {
  const { role, team_id } = await getRoleTeam(userId);
  const lc = String(role || '').toLowerCase();
  if (['super_admin','superadmin'].includes(lc)) return true;
  // Block Free plan explicitly (do not gate on missing/unknown)
  try {
    const { data: sub } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier === 'free') return false;
    if (!tier) {
      const { data: usr } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle();
      const plan = String((usr as any)?.plan || '').toLowerCase();
      if (plan === 'free') return false;
    }
  } catch {}
  // Team members (non-admin) use explicit permissions only for Team plan
  try {
    const { data: sub2 } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier2 = String((sub2 as any)?.plan_tier || '').toLowerCase();
    if (tier2 === 'team' && team_id && lc !== 'team_admin') {
    const { data } = await supabase.from('deal_permissions').select('can_view_opportunities').eq('user_id', userId).maybeSingle();
    return Boolean((data as any)?.can_view_opportunities);
    }
  } catch {}
  // Everyone else (paid roles, including team_admin, recruitpro, member, admin)
  return true;
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
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let base = supabase
      .from('opportunities')
      .select('id,title,value,billing_type,stage,status,owner_id,client_id,created_at');

    if (isSuper) {
      // no filter
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else {
      base = base.eq('owner_id', userId);
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
      clientIds.length ? supabase.from('clients').select('id,name,domain').in('id', clientIds) : Promise.resolve({ data: [] as any }),
      ownerIds.length ? supabase.from('users').select('id,first_name,last_name,avatar_url').in('id', ownerIds) : Promise.resolve({ data: [] as any }),
      oppIds.length ? supabase.from('opportunity_job_reqs').select('opportunity_id,req_id').in('opportunity_id', oppIds) : Promise.resolve({ data: [] as any })
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

// GET /api/opportunities/:id (detail)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { id } = req.params;
    const { data: opp, error } = await supabase.from('opportunities').select('*').eq('id', id).maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!opp) { res.status(404).json({ error: 'not_found' }); return; }

    // fetch req links
    const { data: links } = await supabase.from('opportunity_job_reqs').select('req_id').eq('opportunity_id', id);
    // fetch client and owner
    const [{ data: clientRow }, { data: ownerRow }] = await Promise.all([
      opp.client_id ? supabase.from('clients').select('id,name,domain').eq('id', opp.client_id).maybeSingle() : Promise.resolve({ data: null }),
      opp.owner_id ? supabase.from('users').select('id,first_name,last_name,email').eq('id', opp.owner_id).maybeSingle() : Promise.resolve({ data: null })
    ] as any);
    const owner_name = ownerRow ? [ownerRow.first_name, ownerRow.last_name].filter(Boolean).join(' ') || ownerRow.email : null;
    // Attach candidate cards from applications and submissions
    const reqIds = (links || []).map((l: any) => l.req_id);
    const [{ data: apps }, { data: subs }, { data: legacy }] = await Promise.all([
      supabase.from('candidate_applications').select('*').eq('opportunity_id', id).order('created_at', { ascending: false }),
      supabase.from('candidate_submissions').select('*').eq('opportunity_id', id).order('created_at', { ascending: false }),
      (reqIds.length
        ? supabase
            .from('candidates')
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
        const { data: cjobRows } = await supabase
          .from('candidate_jobs')
          .select('candidate_id')
          .in('job_id', reqIds);
        const candIds = Array.from(new Set((cjobRows || []).map((r: any) => r.candidate_id).filter(Boolean)));
        if (candIds.length) {
          const { data: cands } = await supabase
            .from('candidates')
            .select('id,first_name,last_name,email,linkedin_url,resume_url,title,years_experience,created_at')
            .in('id', candIds);
          linkedReqCandidates = (cands || []).map((c: any) => ({
            id: `jobreq_${c.id}`,
            candidate_id: c.id,
            first_name: c.first_name || null,
            last_name: c.last_name || null,
            email: c.email || null,
            linkedin_url: c.linkedin_url || null,
            title: c.title || null,
            years_experience: c.years_experience || null,
            resume_url: c.resume_url || null,
            created_at: c.created_at || null,
            _from_job_req: true
          }));
        }
      } catch {}
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

// PATCH /api/opportunities/:id/notes
router.patch('/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { id } = req.params;
    const { notes } = req.body || {};
    const { data, error } = await supabase.from('opportunities').update({ notes: notes ?? null }).eq('id', id).select('id,notes').maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
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
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
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
    const { data, error } = await supabase.from('opportunity_activity').select('*').eq('opportunity_id', id).order('created_at', { ascending: false });
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
    const { data, error } = await supabase.from('opportunity_activity').insert({ opportunity_id: id, user_id: userId, message, created_at: new Date().toISOString() }).select('*').single();
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
    try { await supabase.from('opportunity_activity').insert({ opportunity_id: id, user_id: userId, message: 'Submitted candidate to client', created_at: new Date().toISOString() }); } catch {}
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
    const { data: job } = await supabase
      .from('job_requisitions')
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
    res.status(201).json({ id: (data as any)?.id || null });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// Collaborators (basic by email)
router.get('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('opportunity_collaborators').select('*').eq('opportunity_id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e:any) { res.status(500).json({ error: e.message || 'Internal server error' }); }
});

router.post('/:id/collaborators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body || {};
    const { data, error } = await supabase.from('opportunity_collaborators').insert({ opportunity_id: id, email, role: role || 'collaborator', created_at: new Date().toISOString() }).select('*').single();
    if (error) { res.status(500).json({ error: error.message }); return; }
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
          const { data: jobRow } = await supabase
            .from('job_requisitions')
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
  let base = supabase.from('job_requisitions').select('id,title,user_id');
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
    const { data: job } = await supabase
      .from('job_requisitions')
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

    const { title, client_id, stage, value, billing_type } = req.body || {};
    const insert = { title, client_id, stage, value, billing_type, status: 'open', owner_id: userId, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('opportunities').insert(insert).select('*').single();
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
    const up: any = {};
    const fields = ['title','client_id','stage','value','billing_type','status','owner_id'];
    for (const f of fields) if (req.body?.[f] !== undefined) up[f] = req.body[f];
    const { data, error } = await supabase.from('opportunities').update(up).eq('id', id).select('*').maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }

    // Update REQ links if provided
    if (Array.isArray(req.body?.req_ids)) {
      // delete existing and re-insert
      await supabase.from('opportunity_job_reqs').delete().eq('opportunity_id', id);
      const rows = (req.body.req_ids as string[]).map((reqId) => ({ opportunity_id: id, req_id: reqId }));
      if (rows.length) await supabase.from('opportunity_job_reqs').insert(rows);
    }

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

    // Best-effort: delete req links first to avoid FK constraints; do NOT delete job reqs themselves
    await supabase.from('opportunity_job_reqs').delete().eq('opportunity_id', id);
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/opportunities/stages
router.get('/stages', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const allowed = await canViewOpportunities(userId);
    if (!allowed) { res.status(403).json({ error: 'access_denied' }); return; }

    const { team_id } = await getRoleTeam(userId);
    const { data, error } = await supabase
      .from('opportunity_stages')
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

export default router;


