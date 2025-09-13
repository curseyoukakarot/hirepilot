import express, { Request, Response } from 'express';
import { supabase, supabaseDb } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { notifySlack } from '../lib/slack';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/jobs/:id/share
router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    // Validate auth via Supabase JWT in Authorization header
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: auth } = await supabase.auth.getUser(token);
    const userId = auth?.user?.id || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Ensure job exists and is owned by user or same org (best-effort)
    const { data: job } = await supabaseDb
      .from('job_requisitions')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Upsert share row: if exists for this job+recruiter, update; else create
    const existing = await supabaseDb
      .from('job_shares')
      .select('*')
      .eq('job_id', jobId)
      .eq('recruiter_id', userId)
      .maybeSingle();

    const body = req.body || {};
    const applyMode = ['hirepilot', 'external'].includes(String(body.apply_mode)) ? body.apply_mode : undefined;
    const applyUrl = typeof body.apply_url === 'string' ? body.apply_url : undefined;

    let shareRow: any = existing.data || null;
    if (shareRow) {
      const update: any = {};
      if (applyMode) update.apply_mode = applyMode;
      if (applyUrl !== undefined) update.apply_url = applyUrl || null;
      const { data: upd, error } = await supabaseDb
        .from('job_shares')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', shareRow.id)
        .select('*')
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      shareRow = upd;
    } else {
      const uuid = uuidv4();
      const { data: created, error } = await supabaseDb
        .from('job_shares')
        .insert({
          job_id: jobId,
          recruiter_id: userId,
          uuid_link: uuid,
          apply_mode: applyMode || 'hirepilot',
          apply_url: applyUrl || null
        })
        .select('*')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      shareRow = created;
    }

    const publicUrl = `/jobs/share/${shareRow.uuid_link}`;
    return res.json({ ...shareRow, url: publicUrl });
  } catch (e: any) {
    console.error('[jobs:share] error', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// GET /api/jobs/share/:uuid
router.get('/share/:uuid', async (req: Request, res: Response) => {
  try {
    const uuid = req.params.uuid;
    const { data: share, error } = await supabaseDb
      .from('job_shares')
      .select('*')
      .eq('uuid_link', uuid)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!share) return res.status(404).json({ error: 'Share not found' });

    // Increment view counter (best-effort)
    try {
      await supabaseDb
        .from('job_shares')
        .update({ view_count: (share.view_count || 0) + 1 })
        .eq('id', share.id);
    } catch {}

    const { data: job } = await supabaseDb
      .from('job_requisitions')
      .select('*')
      .eq('id', share.job_id)
      .maybeSingle();

    return res.json({ share, job });
  } catch (e: any) {
    console.error('[jobs:share:get] error', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/jobs/share/:uuid/apply-click – increment apply_clicks (for external redirects)
router.post('/share/:uuid/apply-click', async (req: Request, res: Response) => {
  try {
    const uuid = req.params.uuid;
    const { data: share } = await supabaseDb
      .from('job_shares')
      .select('id, apply_clicks')
      .eq('uuid_link', uuid)
      .maybeSingle();
    if (!share) return res.status(404).json({ error: 'Share not found' });
    await supabaseDb
      .from('job_shares')
      .update({ apply_clicks: (share.apply_clicks || 0) + 1 })
      .eq('id', share.id);
    res.json({ success: true });
  } catch (e: any) {
    console.error('[jobs:share:apply-click] error', e);
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/jobs/:id/generate-social-copy
router.post('/:id/generate-social-copy', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const { data: job } = await supabaseDb
      .from('job_requisitions')
      .select('id, title, location, department, description')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const link = String(req.body?.link || '');
    const prompt = `Write a short, compelling social post to attract candidates.
Role: ${job.title}
Location: ${job.location || 'Remote/Onsite'}
Department: ${job.department || ''}
Tone: professional, concise, energetic. Include a brief CTA and relevant emoji. End with the provided link.
Link: ${link}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 180
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    res.json({ text });
  } catch (e: any) {
    console.error('[jobs:generate-social-copy] error', e);
    res.status(500).json({ error: e.message || 'Failed to generate copy' });
  }
});

// Utility upload to storage bucket (public)
async function uploadResume(userId: string, fileBase64: string, filename: string): Promise<string | null> {
  try {
    const base64 = (fileBase64 || '').split(',').pop() || '';
    const bytes = Buffer.from(base64, 'base64');
    const path = `resumes/${userId}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;
    const storage = (await import('@supabase/supabase-js')).createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await storage.storage.from('uploads').upload(path, bytes, { upsert: false, contentType: 'application/pdf' });
    if (error) { console.warn('[uploadResume] storage error', error.message); return null; }
    const { data: pub } = storage.storage.from('uploads').getPublicUrl(path);
    return pub?.publicUrl || null;
  } catch (e) {
    console.warn('[uploadResume] failed', e);
    return null;
  }
}

// POST /api/jobs/:id/apply
router.post('/:id/apply', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const { name, email, phone, linkedin_url, resume_file, cover_note, share_uuid } = req.body || {};

    if (!name || !email) return res.status(400).json({ error: 'Missing name or email' });

    const { data: job } = await supabaseDb
      .from('job_requisitions')
      .select('id, user_id, title')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    let resumeUrl: string | null = null;
    if (typeof resume_file?.data === 'string' && typeof resume_file?.name === 'string') {
      resumeUrl = await uploadResume(String(job.user_id), resume_file.data, resume_file.name);
    }

    const recruiterId = String(job.user_id);
    const first = String(name).split(' ')[0] || '';
    const last = String(name).split(' ').slice(1).join(' ') || '';

    const insert: any = {
      user_id: recruiterId,
      job_id: jobId,
      recruiter_id: recruiterId,
      first_name: first,
      last_name: last,
      name,
      email,
      phone: phone || null,
      linkedin_url: linkedin_url || null,
      resume_url: resumeUrl,
      cover_note: cover_note || null,
      status: 'sourced',
      created_at: new Date().toISOString()
    };

    const { data: candidate, error } = await supabaseDb
      .from('candidates')
      .insert(insert)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    try {
      if (share_uuid) {
        const { data: share } = await supabaseDb
          .from('job_shares')
          .select('id, apply_clicks')
          .eq('uuid_link', share_uuid)
          .maybeSingle();
        if (share) {
          await supabaseDb
            .from('job_shares')
            .update({ apply_clicks: (share.apply_clicks || 0) + 1 })
            .eq('id', share.id);
        }
      }
    } catch {}

    try {
      const { sendUserHtmlEmail } = await import('../services/sendUserHtmlEmail');
      const html = `<p>New application for <b>${job.title || 'your job'}</b></p>
        <ul>
          <li>Name: ${name}</li>
          <li>Email: ${email}</li>
          <li>Phone: ${phone || '-'}</li>
          <li>LinkedIn: ${linkedin_url || '-'}</li>
        </ul>`;
      await sendUserHtmlEmail(recruiterId, 'New Candidate Application', html);
    } catch (e) { console.warn('notify email failed', e); }

    // Slack notification (optional)
    try {
      const recruiter = await supabaseDb.from('users').select('email').eq('id', recruiterId).maybeSingle();
      const recEmail = (recruiter.data as any)?.email || 'unknown';
      await notifySlack(`✅ New application for *${job.title || 'Job'}*\n• Candidate: ${name} (${email})\n• Recruiter: ${recEmail}`);
    } catch (e) { console.warn('notify slack failed', e); }

    try {
      const { data: integ } = await supabaseDb
        .from('integrations')
        .select('webhook_url, provider')
        .eq('user_id', recruiterId)
        .eq('provider', 'zapier')
        .maybeSingle();
      const webhook = (integ as any)?.webhook_url || null;
      if (webhook) {
        await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, candidate }) });
      }
    } catch (e) { console.warn('zapier webhook post failed', e); }

    return res.json({ success: true, candidate_id: candidate.id });
  } catch (e: any) {
    console.error('[jobs:apply] error', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;
