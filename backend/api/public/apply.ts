import { Request, Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { notifySlack } from '../../lib/slack';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Accept share_id from both body and query parameters
    const share_id = (req.body as any).share_id || (req.query as any).share_id;
    const {
      name,
      email,
      linkedin,
      resume_url,
      cover_note,
      form_json,
      // New candidate-style fields (optional)
      first_name,
      last_name,
      phone,
      title,
      location,
      expected_compensation,
      years_experience,
      notable_impact,
      motivation,
      additional_notes
    } = (req.body || {}) as any;

    const resolvedName = (name || [first_name, last_name].filter(Boolean).join(' ')).trim();

    if (!share_id || !resolvedName || !email) {
      return res.status(400).json({
        error: 'Missing required fields: share_id, name (or first/last), and email',
        details: {
          share_id: !share_id ? 'Missing' : 'Present',
          name: !resolvedName ? 'Missing' : 'Present',
          email: !email ? 'Missing' : 'Present'
        }
      });
    }

    // Get job by share_id
    const { data: job, error: jobError } = await supabaseDb
      .from('job_requisitions')
      .select('id, title, user_id')
      .eq('share_id', share_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Try to resolve an attached opportunity for this req
    let opportunity_id: string | null = null;
    try {
      const { data: link } = await supabaseDb
        .from('opportunity_job_reqs')
        .select('opportunity_id')
        .eq('req_id', job.id)
        .limit(1)
        .single();
      opportunity_id = (link as any)?.opportunity_id || null;
    } catch {}

    // Check for duplicate application (best-effort)
    try {
      if (opportunity_id) {
        const { data: existingApp } = await supabaseDb
          .from('candidate_applications')
          .select('id')
          .eq('opportunity_id', opportunity_id)
          .eq('email', email)
          .maybeSingle();
        if (existingApp) {
          return res.status(400).json({ error: 'You have already applied to this job' });
        }
      }
    } catch {}

    const fullForm = form_json || {
      first_name: first_name || resolvedName.split(' ')[0] || '',
      last_name: last_name || resolvedName.split(' ').slice(1).join(' ') || '',
      email,
      phone: phone || '',
      linkedin_url: linkedin || '',
      title: title || '',
      location: location || '',
      expected_compensation: expected_compensation || '',
      years_experience: years_experience || '',
      notable_impact: notable_impact || cover_note || '',
      motivation: motivation || '',
      additional_notes: additional_notes || '',
      resume_url: resume_url || ''
    };

    // Insert candidate_applications row if table exists
    try {
      await supabaseDb
        .from('candidate_applications')
        .insert({
          opportunity_id,
          full_name: resolvedName,
          email,
          linkedin_url: linkedin || null,
          resume_url: resume_url || null,
          cover_note: cover_note || notable_impact || motivation || additional_notes || null,
          form_json: fullForm
        });
    } catch (e) {
      // ignore if table not present; continue to legacy path
    }

    // Legacy: also upsert into candidates tied to the job owner for visibility
    // Check if candidate already exists for this user/email
    const { data: existingCandidate } = await supabaseDb
      .from('candidates')
      .select('id')
      .eq('email', email)
      .eq('job_id', job.id)
      .maybeSingle();

    if (existingCandidate) {
      return res.status(400).json({ error: 'You have already applied to this job' });
    }

    const first = first_name || resolvedName.split(' ')[0] || resolvedName;
    const last = last_name || resolvedName.split(' ').slice(1).join(' ') || '';

    const { data: candidate, error: insertError } = await supabaseDb
      .from('candidates')
      .insert({
        user_id: job.user_id,
        job_id: job.id,
        first_name: first,
        last_name: last,
        email,
        phone: phone || null,
        title: title || null,
        location: location || null,
        linkedin_url: linkedin || null,
        resume_url: resume_url || null,
        notes: cover_note || notable_impact || motivation || additional_notes || null,
        status: 'sourced',
        source: 'public_application',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      return res.status(500).json({ error: 'Failed to submit application' });
    }

    // Log the application in job_activity_log (best-effort)
    try {
      await supabaseDb
        .from('job_activity_log')
        .insert({
          job_id: job.id,
          actor_id: null,
          type: 'candidate_applied',
          metadata: {
            candidate_id: candidate.id,
            candidate_name: resolvedName,
            candidate_email: email,
            source: 'public_application',
            opportunity_id
          },
          created_at: new Date().toISOString()
        });
    } catch {}

    // Slack notification to job owner (best-effort)
    try {
      const { data: owner } = await supabaseDb
        .from('users')
        .select('email')
        .eq('id', job.user_id)
        .maybeSingle();
      const ownerEmail = (owner as any)?.email || 'unknown';
      await notifySlack(`✅ Public application for *${job.title || 'Job'}*\n• Candidate: ${resolvedName} (${email})\n• Recruiter: ${ownerEmail}`);
    } catch (e) {
      console.warn('[public/apply] slack notify failed', e);
    }

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      candidate_id: (candidate as any)?.id || null
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
