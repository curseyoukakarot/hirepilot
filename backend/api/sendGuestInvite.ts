import { Request, Response } from 'express';
import sgMail from '@sendgrid/mail';
import { createClient } from '@supabase/supabase-js';

export default async function sendGuestInvite(req: Request, res: Response) {
  try {
    let { email, job_id, role } = req.body || {};
    if (!email || !job_id) return res.status(400).json({ error: 'Missing email or job_id' });
    email = String(email).trim().toLowerCase();

    // Provision Auth user at invite time (idempotent)
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return res.status(500).json({ error: 'Server auth is not configured' });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Try to create first
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'guest' },
    });
    if (createError) {
      // List and update if exists
      let existing: any | null = null;
      for (let page = 1; page <= 10 && !existing; page++) {
        const { data: users, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listError) throw new Error(`List users failed: ${listError.message}`);
        existing = (users?.users || []).find(u => String(u.email || '').toLowerCase() === email) || null;
        if ((users?.users || []).length < 1000) break;
      }
      if (existing?.id) {
        const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: 'guest' },
        });
        if (updateError) throw new Error(`Update user failed: ${updateError.message}`);
      } else {
        // If still not found, bubble the original error
        console.warn('[sendGuestInvite] create user failed and no existing user found', createError.message);
      }
    }

    const apiKey = process.env.SENDGRID_API_KEY || '';
    const appUrl = process.env.APP_URL || 'https://thehirepilot.com';

    const inviteUrl = `${appUrl}/accept-guest?job_id=${encodeURIComponent(job_id)}&email=${encodeURIComponent(email)}&role=${encodeURIComponent(role || 'View Only')}`;

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@thehirepilot.com',
        subject: 'You have been invited to collaborate on a Job Requisition',
        html: `
          <p>You have been invited to collaborate on a job requisition.</p>
          <p>Role: <strong>${role || 'View Only'}</strong></p>
          <p><a href="${inviteUrl}">Click here to accept the invite</a></p>
        `,
      } as any;
      await sgMail.send(msg);
    } else {
      console.info('[sendGuestInvite] SENDGRID_API_KEY not set; no-op invite', { email, job_id, role, inviteUrl });
    }

    res.json({ success: true, invite_url: inviteUrl });
  } catch (e: any) {
    console.error('[sendGuestInvite] error', e);
    res.status(500).json({ error: e.message || 'Failed to send invite' });
  }
}
