import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function getJob(req: Request, res: Response) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { id } = req.params as { id: string };
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return res.status(500).json({ error: 'Server auth is not configured' });

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Extract bearer token to identify the caller
    const auth = (req.headers.authorization || '').split(' ')[1] || '';
    let callerId: string | null = null;
    let callerEmail: string | null = null;
    if (auth) {
      try {
        const { data: userRes } = await admin.auth.getUser(auth);
        callerId = userRes.user?.id || null;
        callerEmail = (userRes.user as any)?.email || userRes.user?.user_metadata?.email || null;
      } catch {}
    }

    // Load job
    const { data: job } = await admin.from('job_requisitions').select('*').eq('id', id).maybeSingle();
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Authorization: owner, collaborator, or guest
    let allowed = false;
    if (callerId && (job.user_id === callerId || job.created_by === callerId)) allowed = true;
    if (!allowed && callerId) {
      const { data: collab } = await admin
        .from('job_collaborators')
        .select('id')
        .eq('job_id', id)
        .eq('user_id', callerId)
        .maybeSingle();
      if (collab) allowed = true;
    }
    if (!allowed && callerEmail) {
      const { data: guest } = await admin
        .from('job_guest_collaborators')
        .select('id')
        .eq('job_id', id)
        .eq('email', callerEmail)
        .maybeSingle();
      if (guest) allowed = true;
    }

    if (!allowed) {
      const normalizedEmail = (callerEmail || '').trim().toLowerCase();
      // Provide clearer diagnostics for guest authorization mismatch
      return res.status(403).json({ error: 'Forbidden', details: { callerId, callerEmail: normalizedEmail, reason: 'Not owner/collaborator/guest for this job' } });
    }

    return res.json({ job });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to fetch job' });
  }
}
