import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { WebClient } from '@slack/web-api';
import { supabaseDb } from '../lib/supabase';

/**
 * Public intake endpoint for the IgniteGTM contact forms
 * (served at contact.ignitegtm.com from /ignite-contact).
 * No auth — validated, honeypotted, and written to its own table.
 */
const router = Router();

// the no-JS fallback posts urlencoded; JSON is parsed globally upstream
router.use(express.urlencoded({ extended: true }));

// temporary diagnostics for the contact.ignitegtm.com static serving
router.get('/diag', (req: Request, res: Response) => {
  const candidates = [
    path.join(__dirname, '../ignite-contact'),
    path.join(__dirname, '../../ignite-contact'),
    path.join(process.cwd(), 'ignite-contact'),
  ];
  res.json({
    dirname: __dirname,
    cwd: process.cwd(),
    candidates: candidates.map((p) => ({
      p,
      exists: fs.existsSync(p),
      files: fs.existsSync(p) ? fs.readdirSync(p).slice(0, 10) : null,
    })),
    hostname: req.hostname,
    hostHeader: req.headers.host || null,
    xForwardedHost: req.headers['x-forwarded-host'] || null,
  });
});

const FORMS = new Set(['general', 'studio', 'advisory', 'events', 'chatbot']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Per-form Slack routing in the IgniteGTM workspace (events + chatbot → general)
const IGNITE_SLACK_CHANNELS: Record<string, string> = {
  general: process.env.IGNITE_SLACK_CHANNEL_GENERAL || '#ignite-leads-general',
  advisory: process.env.IGNITE_SLACK_CHANNEL_ADVISORY || '#ignite-leads-advisory',
  studio: process.env.IGNITE_SLACK_CHANNEL_STUDIO || '#ignite-leads-studio',
  events: process.env.IGNITE_SLACK_CHANNEL_GENERAL || '#ignite-leads-general',
  chatbot: process.env.IGNITE_SLACK_CHANNEL_GENERAL || '#ignite-leads-general',
};

export async function notifyIgniteLeadSlack(form: string, lead: {
  first_name: string; last_name?: string | null; email: string;
  company?: string | null; interests?: string[]; source?: string | null; notes?: string | null;
}) {
  const token = process.env.IGNITE_SLACK_BOT_TOKEN || '';
  const channel = IGNITE_SLACK_CHANNELS[form] || IGNITE_SLACK_CHANNELS.general;
  if (!token || !channel) return;
  const label = form === 'chatbot' ? 'ignite-bot lead' : `${form} form`;
  const text = [
    `:zap: New IgniteGTM lead — ${label}`,
    `Name: ${[lead.first_name, lead.last_name].filter(Boolean).join(' ')} <${lead.email}>`,
    lead.company ? `Company: ${lead.company}` : null,
    lead.interests?.length ? `Interested in: ${lead.interests.join(', ')}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
    lead.source ? `Source: ${lead.source}` : null,
  ].filter(Boolean).join('\n');
  try {
    const slack = new WebClient(token);
    try {
      await slack.chat.postMessage({ channel, text, unfurl_links: false, unfurl_media: false });
    } catch (err: any) {
      if (err?.data?.error === 'not_in_channel') {
        await slack.conversations.join({ channel });
        await slack.chat.postMessage({ channel, text, unfurl_links: false, unfurl_media: false });
      } else {
        throw err;
      }
    }
  } catch (err: any) {
    console.error('[igniteIntake] slack notify failed:', err?.data?.error || err?.message || err);
  }
}

router.post('/intake', async (req: Request, res: Response) => {
  try {
    const b: any = req.body || {};

    // honeypot: real users never fill "website"
    if (typeof b.website === 'string' && b.website.trim() !== '') {
      res.json({ ok: true });
      return;
    }

    const form = String(b.form || '').toLowerCase();
    const firstName = String(b.first_name || '').trim().slice(0, 120);
    const lastName = String(b.last_name || '').trim().slice(0, 120);
    const email = String(b.email || '').trim().slice(0, 200);
    const company = String(b.company || '').trim().slice(0, 200);
    let interests: string[] = Array.isArray(b.interests)
      ? b.interests
      : b.interests ? [b.interests] : [];
    interests = interests.map((i: any) => String(i).slice(0, 80)).slice(0, 10);

    if (!FORMS.has(form) || !firstName || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Missing or invalid fields' });
      return;
    }

    const { error } = await supabaseDb.from('ignite_intake').insert({
      form,
      first_name: firstName,
      last_name: lastName || null,
      email,
      company: company || null,
      interests,
      source: String(b.source || '').slice(0, 300) || null,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300) || null,
    });
    if (error) throw error;

    // fire-and-forget: never let Slack slow down or fail the submission
    void notifyIgniteLeadSlack(form, {
      first_name: firstName,
      last_name: lastName,
      email,
      company,
      interests,
      source: String(b.source || '') || null,
    });

    // no-JS form posts get redirected back to the page with a success flag
    const isFormPost = (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
    if (isFormPost) {
      const back = form === 'general' ? '/' : `/${form}`;
      res.redirect(303, `${back}?sent=1`);
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[igniteIntake] submit failed:', e);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

export default router;
