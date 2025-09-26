import { Request, Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { notifySlack } from '../../lib/slack';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Accept share_id from both body and query parameters
    const share_id = req.body.share_id || req.query.share_id;
    const { name, email, linkedin, resume_url, cover_note } = req.body;

    console.log('[POST /api/public/apply] Request details:', {
      body_share_id: req.body.share_id,
      query_share_id: req.query.share_id,
      resolved_share_id: share_id,
      has_name: !!name,
      has_email: !!email
    });

    if (!share_id || !name || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields: share_id, name, and email',
        details: {
          share_id: !share_id ? 'Missing' : 'Present',
          name: !name ? 'Missing' : 'Present', 
          email: !email ? 'Missing' : 'Present'
        }
      });
    }

    // Get job_id and pipeline_id from share_id
    const { data: job, error: jobError } = await supabaseDb
      .from('job_requisitions')
      .select('id, title, user_id')
      .eq('share_id', share_id)
      .single();

    if (jobError || !job) {
      console.error('Job lookup error:', jobError);
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if candidate already applied to this job
    const { data: existingCandidate } = await supabaseDb
      .from('candidates')
      .select('id')
      .eq('email', email)
      .eq('job_id', job.id)
      .single();

    if (existingCandidate) {
      return res.status(400).json({ error: 'You have already applied to this job' });
    }

    // Insert candidate application
    const { data: candidate, error: insertError } = await supabaseDb
      .from('candidates')
      .insert({
        user_id: job.user_id,
        job_id: job.id,
        first_name: name.split(' ')[0] || name,
        last_name: name.split(' ').slice(1).join(' ') || '',
        email,
        linkedin_url: linkedin || null,
        resume_url: resume_url || null,
        notes: cover_note || null,
        status: 'sourced',
        source: 'public_application',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Candidate insert error:', insertError);
      return res.status(500).json({ error: 'Failed to submit application' });
    }

    // Log the application in job_activity_log
    try {
      await supabaseDb
        .from('job_activity_log')
        .insert({
          job_id: job.id,
          actor_id: null, // Anonymous application
          type: 'candidate_applied',
          metadata: {
            candidate_id: candidate.id,
            candidate_name: name,
            candidate_email: email,
            source: 'public_application'
          },
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.warn('Failed to log application activity:', logError);
      // Don't fail the request if logging fails
    }

    // Slack notification to job owner (best-effort)
    try {
      const { data: owner } = await supabaseDb
        .from('users')
        .select('email')
        .eq('id', job.user_id)
        .maybeSingle();
      const ownerEmail = (owner as any)?.email || 'unknown';
      await notifySlack(`✅ Public application for *${job.title || 'Job'}*\n• Candidate: ${name} (${email})\n• Recruiter: ${ownerEmail}`);
    } catch (e) {
      console.warn('[public/apply] slack notify failed', e);
    }

    console.log(`✅ Public application received for job ${job.id} (${job.title}) from ${name} (${email})`);

    res.status(201).json({ 
      success: true,
      message: 'Application submitted successfully',
      candidate_id: candidate.id
    });
  } catch (error: any) {
    console.error('[POST /api/public/apply] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
