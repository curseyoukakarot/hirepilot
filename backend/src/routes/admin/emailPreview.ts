import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/admin/email-preview/:template', async (req: Request, res: Response) => {
  try {
    const template = String(req.params.template || '').trim();
    if (!template) {
      res.status(400).json({ error: 'template required' });
      return;
    }

    const candidates = [
      path.resolve(process.cwd(), 'frontend', 'src', 'templates', 'emails', `${template}.html`),
      path.resolve(__dirname, '../../../../frontend/src/templates/emails', `${template}.html`)
    ];
    const filePath = candidates.find((p) => fs.existsSync(p));
    if (!filePath) {
      res.status(404).json({ error: 'template_not_found' });
      return;
    }

    let html = fs.readFileSync(filePath, 'utf8');

    const APP_URL = process.env.APP_URL || 'https://thehirepilot.com';
    const BLOG_URL = process.env.BLOG_URL || 'https://thehirepilot.com/blog';
    const testTokens: Record<string, string> = {
      first_name: 'Ava',
      cta_url: `${APP_URL}`,
      article_url: `${BLOG_URL}`,
      app_url: APP_URL,
      plan_tier: 'free'
    };

    for (const [k, v] of Object.entries(testTokens)) {
      const needle = `{{${k}}}`;
      html = html.split(needle).join(v);
    }

    res.set('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'preview_failed' });
  }
});

export default router;


