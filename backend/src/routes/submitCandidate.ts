import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function isUuid(v?: string): boolean { return !!v && /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(v); }

router.post('/submitCandidate', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    // Create a local admin client to avoid undefined imports in some runtimes
    const db = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });

    const {
      jobId,
      candidateIdOrName,
      email,
      phone,
      linkedin,
      title,
      salary,
      location,
      experience,
      impact,
      motivation,
      accolades,
      resume
    } = req.body || {};

    if (!jobId) return res.status(400).json({ error: 'Missing jobId' });

    // Load job + owner
    const { data: job, error: jobErr } = await db
      .from('job_requisitions')
      .select('id, title, user_id')
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });
    const ownerId = (job as any).user_id as string;

    // Resolve candidate info (existing by ID or provided fields)
    let candidateRow: any | null = null;
    if (isUuid(candidateIdOrName)) {
      const { data: existing, error } = await db
        .from('candidates')
        .select('*')
        .eq('id', candidateIdOrName)
        .maybeSingle();
      if (!error && existing) candidateRow = existing;
    }

    // If not existing, create or reuse by email (global unique)
    if (!candidateRow) {
      const providedEmail = typeof email === 'string' && email.trim().length ? String(email).trim() : undefined;
      if (providedEmail) {
        const { data: existingByEmail } = await db.from('candidates').select('*').eq('email', providedEmail).maybeSingle();
        if (existingByEmail) {
          candidateRow = existingByEmail;
        }
      }
    }

    if (!candidateRow) {
      const safeEmail = (typeof email === 'string' && email.trim().length ? String(email).trim() : undefined) || `unknown+sub_${userId.slice(0,8)}+${Date.now()}@noemail.hirepilot`;
      const firstNameGuess = (typeof (req.body?.first_name) === 'string' && req.body.first_name.trim())
        ? String(req.body.first_name).trim().slice(0, 60)
        : (String(candidateIdOrName || '').trim().split(' ')[0] || '').slice(0, 60);
      const lastNameGuess = (typeof (req.body?.last_name) === 'string' && req.body.last_name.trim())
        ? String(req.body.last_name).trim().slice(0, 60)
        : (String(candidateIdOrName || '').trim().split(' ').slice(1).join(' ') || '').slice(0, 60);
      const insertPayload: any = {
        user_id: ownerId,
        first_name: firstNameGuess || null,
        last_name: lastNameGuess || null,
        email: safeEmail,
        phone: phone || null,
        title: title || null,
        linkedin_url: linkedin || null,
        resume_url: resume || null,
        status: 'sourced',
        enrichment_data: {},
        notes: [impact, motivation, accolades].filter(Boolean).join('\n\n') || null
      };
      const { data: created, error: cErr } = await db
        .from('candidates')
        .insert(insertPayload)
        .select('*')
        .maybeSingle();
      if (cErr || !created) {
        // Handle duplicate email globally: use existing row
        if ((cErr as any)?.code === '23505' && insertPayload.email) {
          const { data: existing } = await db.from('candidates').select('*').eq('email', insertPayload.email).maybeSingle();
          if (existing) {
            candidateRow = existing;
          } else {
            console.error('[submitCandidate] insert duplicate but select missing', cErr);
            return res.status(500).json({ error: 'Failed to create candidate', details: (cErr as any)?.message || String(cErr) });
          }
        } else {
          console.error('[submitCandidate] insert error', cErr);
          return res.status(500).json({ error: 'Failed to create candidate', details: (cErr as any)?.message || String(cErr) });
        }
      } else {
        candidateRow = created;
      }
    }

    // Ensure association to job via candidate_jobs
    // Pick stage: first stage for job's pipeline if exists
    let stageId: string | null = null;
    try {
      const { data: p } = await db.from('pipelines').select('id').eq('job_id', jobId).maybeSingle();
      if (p?.id) {
        const { data: s } = await db.from('pipeline_stages').select('id').eq('pipeline_id', p.id).order('position', { ascending: true }).limit(1).maybeSingle();
        stageId = (s as any)?.id || null;
      }
    } catch {}

    // Upsert candidate_jobs
    const { data: linkExisting } = await db
      .from('candidate_jobs')
      .select('id')
      .eq('candidate_id', candidateRow.id)
      .eq('job_id', jobId)
      .maybeSingle();
    if (!linkExisting?.id) {
      const insertJob = { candidate_id: candidateRow.id, job_id: jobId, stage_id: stageId } as any;
      const { error: linkErr } = await db.from('candidate_jobs').insert(insertJob);
      if (linkErr && (linkErr as any).code !== '23505') {
        console.error('[submitCandidate] link error', linkErr);
        // If not unique violation, return error
        return res.status(500).json({ error: 'Failed to link candidate to job', details: (linkErr as any)?.message || String(linkErr) });
      }
    }

    // Notify owner via email + Slack
    try {
      const { sendCandidateSubmissionEmail } = await import('../lib/notifications/email');
      const ownerEmailRes = await db.from('user_settings').select('email, slack_webhook_url').eq('user_id', ownerId).maybeSingle();
      // Resolve owner's display name
      const ownerUserRes = await db.from('users').select('first_name,last_name,email').eq('id', ownerId).maybeSingle();
      const submitterRes = await db.from('users').select('first_name,last_name,email').eq('id', userId).maybeSingle();
      const ownerEmail = (ownerEmailRes.data as any)?.email || (await (async () => {
        const admin = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
        const { data } = await admin.from('users').select('email').eq('id', ownerId).maybeSingle();
        return (data as any)?.email || null;
      })());

      const name = `${candidateRow.first_name || req.body?.first_name || ''} ${candidateRow.last_name || req.body?.last_name || ''}`.trim() || candidateRow.email;
      const years = (experience ? `${experience}` : '').trim();
      if (ownerEmail) {
        await sendCandidateSubmissionEmail({
          ownerEmail,
          ownerName: `${(ownerUserRes.data as any)?.first_name || ''} ${(ownerUserRes.data as any)?.last_name || ''}`.trim() || (ownerUserRes.data as any)?.email || '',
          jobTitle: (job as any).title,
          candidateName: name,
          email: candidateRow.email,
          linkedin: candidateRow.linkedin_url || linkedin || '',
          years,
          impact: impact || '',
          motivation: motivation || '',
          accolades: accolades || '',
          resume: candidateRow.resume_url || resume || '',
          collaboratorName: `${(submitterRes.data as any)?.first_name || ''} ${(submitterRes.data as any)?.last_name || ''}`.trim() || (submitterRes.data as any)?.email || 'Collaborator'
        });
      }

      // Slack webhook from settings
      const slackUrl = (ownerEmailRes.data as any)?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL;
      if (slackUrl) {
        const { sendSlackCandidateNotification } = await import('../lib/notifications/slack');
        await sendSlackCandidateNotification({ name: `${name} (submitted by ${(submitterRes.data as any)?.email || 'collaborator'})`, jobTitle: (job as any).title, resume: candidateRow.resume_url || resume || '', motivation }, slackUrl);
      }
    } catch (e) {
      console.warn('[submitCandidate] notify failed', (e as any)?.message || e);
    }

    return res.json({ success: true, candidate_id: candidateRow.id });
  } catch (e: any) {
    console.error('[submitCandidate] error', e);
    return res.status(500).json({ error: e?.message || 'internal_error' });
  }
});

export default router;


