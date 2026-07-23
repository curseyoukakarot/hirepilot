import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
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

const FORMS = new Set(['general', 'studio', 'advisory']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
