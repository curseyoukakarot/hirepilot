import { Router, Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function isUuid(v?: string): boolean { return !!v && /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(v); }

router.post('/submitCandidate', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
    const { data: job, error: jobErr } = await supabaseDb
      .from('job_requisitions')
      .select('id, title, user_id')
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr || !job) return res.status(404).json({ error: 'Job not found' });
    const ownerId = (job as any).user_id as string;

    // Resolve candidate info (existing by ID or provided fields)
    let candidateRow: any | null = null;
    if (isUuid(candidateIdOrName)) {
      const { data: existing, error } = await supabaseDb
        .from('candidates')
        .select('*')
        .eq('id', candidateIdOrName)
        .maybeSingle();
      if (!error && existing) candidateRow = existing;
    }

    // If not existing, create a new candidate owned by job owner
    if (!candidateRow) {
      const safeEmail = (email && String(email).trim()) || `unknown+sub_${userId.slice(0,8)}+${Date.now()}@noemail.hirepilot`;
      const firstNameGuess = (String(candidateIdOrName || '').trim().split(' ')[0] || '').slice(0, 60);
      const lastNameGuess = (String(candidateIdOrName || '').trim().split(' ').slice(1).join(' ') || '').slice(0, 60);
      const insertPayload: any = {
        user_id: ownerId,
        first_name: firstNameGuess || null,
        last_name: lastNameGuess || null,
        email: safeEmail,
        phone: phone || null,
        title: title || null,
        linkedin_url: linkedin || null,
        location: location || null,
        resume_url: resume || null,
        status: 'sourced',
        enrichment_data: {},
        notes: [impact, motivation, accolades].filter(Boolean).join('\n\n') || null
      };
      const { data: created, error: cErr } = await supabaseDb
        .from('candidates')
        .insert(insertPayload)
        .select('*')
        .maybeSingle();
      if (cErr || !created) return res.status(500).json({ error: 'Failed to create candidate' });
      candidateRow = created;
    }

    // Ensure association to job via candidate_jobs
    // Pick stage: first stage for job's pipeline if exists
    let stageId: string | null = null;
    try {
      const { data: p } = await supabaseDb.from('pipelines').select('id').eq('job_id', jobId).maybeSingle();
      if (p?.id) {
        const { data: s } = await supabaseDb.from('pipeline_stages').select('id').eq('pipeline_id', p.id).order('position', { ascending: true }).limit(1).maybeSingle();
        stageId = (s as any)?.id || null;
      }
    } catch {}

    // Upsert candidate_jobs
    const { data: linkExisting } = await supabaseDb
      .from('candidate_jobs')
      .select('id')
      .eq('candidate_id', candidateRow.id)
      .eq('job_id', jobId)
      .maybeSingle();
    if (!linkExisting?.id) {
      await supabaseDb
        .from('candidate_jobs')
        .insert({ candidate_id: candidateRow.id, job_id: jobId, stage_id: stageId });
    }

    // Notify owner via email + Slack
    try {
      const { sendCandidateSubmissionEmail } = await import('../lib/notifications/email');
      const ownerEmailRes = await supabaseDb.from('user_settings').select('email, slack_webhook_url').eq('user_id', ownerId).maybeSingle();
      const ownerEmail = (ownerEmailRes.data as any)?.email || (await (async () => {
        const admin = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
        const { data } = await admin.from('users').select('email').eq('id', ownerId).maybeSingle();
        return (data as any)?.email || null;
      })());

      const name = `${candidateRow.first_name || ''} ${candidateRow.last_name || ''}`.trim() || candidateRow.email;
      const years = (experience ? `${experience}` : '').trim();
      if (ownerEmail) {
        await sendCandidateSubmissionEmail({
          ownerEmail,
          ownerName: null,
          jobTitle: (job as any).title,
          candidateName: name,
          email: candidateRow.email,
          linkedin: candidateRow.linkedin_url || linkedin || '',
          years,
          impact: impact || '',
          motivation: motivation || '',
          accolades: accolades || '',
          resume: candidateRow.resume_url || resume || '',
          collaboratorName: (req as any).user?.email || 'Collaborator'
        });
      }

      // Slack webhook from settings
      const slackUrl = (ownerEmailRes.data as any)?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL;
      if (slackUrl) {
        const { sendSlackCandidateNotification } = await import('../lib/notifications/slack');
        await sendSlackCandidateNotification({ name, jobTitle: (job as any).title, resume: candidateRow.resume_url || resume || '', motivation }, slackUrl);
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


