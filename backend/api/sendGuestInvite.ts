import { Request, Response } from 'express';
import sgMail from '@sendgrid/mail';

export default async function sendGuestInvite(req: Request, res: Response) {
  try {
    const { email, job_id, role } = req.body || {};
    if (!email || !job_id) return res.status(400).json({ error: 'Missing email or job_id' });

    const apiKey = process.env.SENDGRID_API_KEY || '';
    const appUrl = process.env.APP_URL || 'https://thehirepilot.com';

    const inviteUrl = `${appUrl}/invite?job=${encodeURIComponent(job_id)}&email=${encodeURIComponent(email)}&role=${encodeURIComponent(role || 'View Only')}`;

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
