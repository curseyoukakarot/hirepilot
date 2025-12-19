import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { sendEmail as sendgridSend } from '../integrations/sendgrid';

export type LifecycleTokens = {
  first_name: string;
  cta_url?: string;
  article_url?: string;
  app_url?: string;
  plan_tier?: 'free' | 'paid';
  onboarding_url?: string;
  resume_builder_url?: string;
  landing_page_url?: string;
  year?: string;
  unsubscribe_url?: string;
};

export async function sendLifecycleEmail(params: {
  to: string;
  template: string; // e.g. 'feature-deals'
  tokens: LifecycleTokens;
  from?: string;
  subject?: string;
}) {
  const { to, template, tokens } = params;
  // Default sender: prefer configured SendGrid sender (verified) to avoid 403s from SendGrid.
  // Special-case founder intro display name.
  const fromEmail = (process.env.SENDGRID_FROM_EMAIL || '').trim() || 'noreply@hirepilot.com';
  const fromName =
    (process.env.SENDGRID_FROM_NAME || '').trim() ||
    (template === 'founder-intro' ? 'Brandon @ HirePilot' : 'HirePilot');
  const from = params.from || `${fromName} <${fromEmail}>`;

  try {
    // Resolve template path (works from ts-node and built dist)
    const candidates = [
      // Repo root (common local/dev)
      path.resolve(process.cwd(), 'frontend', 'src', 'templates', 'emails', `${template}.html`),
      // If backend runs with CWD=backend (common Railway "root directory" deployments)
      path.resolve(process.cwd(), '..', 'frontend', 'src', 'templates', 'emails', `${template}.html`),
      path.resolve(__dirname, '../../../frontend/src/templates/emails', `${template}.html`),
      path.resolve(__dirname, `../../frontend/src/templates/emails/${template}.html`)
    ];

    const templatePath = candidates.find((p) => fs.existsSync(p));
    if (!templatePath) {
      logger.error({ at: 'sendLifecycleEmail.missing_template', template, to });
      throw new Error(`template_not_found:${template}`);
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    // Inject tokens by simple replaceAll
    const replaceToken = (key: keyof LifecycleTokens, val?: string) => {
      const value = val ?? '';
      const needle = `{{${key}}}`;
      html = html.split(needle).join(value);
    };

    replaceToken('first_name', tokens.first_name);
    replaceToken('cta_url', tokens.cta_url);
    replaceToken('article_url', tokens.article_url);
    replaceToken('app_url', tokens.app_url);
    replaceToken('plan_tier', tokens.plan_tier);
    replaceToken('onboarding_url', tokens.onboarding_url);
    replaceToken('resume_builder_url', tokens.resume_builder_url);
    replaceToken('landing_page_url', tokens.landing_page_url);
    replaceToken('year', tokens.year);
    replaceToken('unsubscribe_url', tokens.unsubscribe_url);

    // Derive subject from <title> if not provided
    let subject = params.subject;
    if (!subject) {
      const m = html.match(/<title>([^<]+)<\/title>/i);
      subject = (m && m[1]) ? m[1].trim() : 'HirePilot update';
    }

    const replyTo = template === 'founder-intro' ? 'brandon@thehirepilot.com' : undefined;
    await sendgridSend({ from, to, subject: subject!, html, replyTo });
    logger.info({ at: 'sendLifecycleEmail.sent', template, to });
    return { ok: true } as const;
  } catch (err: any) {
    logger.error({ at: 'sendLifecycleEmail.error', template, to, error: err?.message || String(err) });
    throw err;
  }
}


