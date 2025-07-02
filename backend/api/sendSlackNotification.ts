import { Request, Response } from 'express';
import { notifySlack } from '../lib/slack';

export default async function sendSlackNotification(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event_type, user_email, role, details } = req.body;

  try {
    let message = '';
    switch (event_type) {
      case 'user_signed_up':
        message = `🆕 New user signed up: ${user_email}`;
        break;
      case 'campaign_created':
        message = `🚀 Campaign created: ${details?.title || ''} by ${user_email}`;
        break;
      case 'error':
        message = `⚠️ Error reported by ${user_email || 'system'}: ${details?.error}`;
        break;
      default:
        message = `ℹ️ Event: ${event_type} – ${JSON.stringify(details)}`;
    }

    await notifySlack(message);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('sendSlackNotification error', err);
    res.status(500).json({ error: 'Failed to send slack notification' });
  }
} 