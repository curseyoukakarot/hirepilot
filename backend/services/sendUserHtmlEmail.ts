import sgMail from '@sendgrid/mail';
import { supabaseDb } from '../lib/supabase';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendUserHtmlEmail(userId: string, subject: string, rawHtml: string): Promise<boolean> {
  try {
    const { data: user } = await supabaseDb
      .from('users')
      .select('email, firstName, email_notifications, plan')
      .eq('id', userId)
      .single();

    if (!user?.email) return false;
    if (user.email_notifications === false) return false;

    const fromAddress = process.env.SENDGRID_FROM_EMAIL;
    if (!fromAddress) return false;

    const msg: any = {
      to: user.email,
      from: fromAddress,
      subject,
      html: rawHtml,
      trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
    };

    await sgMail.send(msg);
    return true;
  } catch (err) {
    console.error('[sendUserHtmlEmail] Failed to send email:', err);
    return false;
  }
}

export async function sendSignupWelcomeEmail(userId: string): Promise<boolean> {
  try {
    const { data: user } = await supabaseDb
      .from('users')
      .select('firstName')
      .eq('id', userId)
      .single();
    const firstName = user?.firstName || '';
    const { welcomeEmail } = await import('../emails/welcomeEmail');
    const html = welcomeEmail(firstName);
    const subject = '🚀 Welcome to HirePilot – Let’s start hiring';
    return await sendUserHtmlEmail(userId, subject, html);
  } catch (err) {
    console.error('[sendSignupWelcomeEmail] Error building welcome email:', err);
    return false;
  }
}

export async function sendUpgradeNudgeEmail(userId: string): Promise<boolean> {
  try {
    const { data: user } = await supabaseDb
      .from('users')
      .select('firstName')
      .eq('id', userId)
      .single();
    const firstName = user?.firstName || '';
    const { upgradeNudgeEmail } = await import('../emails/upgradeNudgeEmail');
    const html = upgradeNudgeEmail(firstName);
    const subject = 'Unlock more with HirePilot';
    return await sendUserHtmlEmail(userId, subject, html);
  } catch (err) {
    console.error('[sendUpgradeNudgeEmail] Error building upgrade email:', err);
    return false;
  }
}

export async function sendActivationPushEmail(userId: string): Promise<boolean> {
  try {
    const { data: user } = await supabaseDb
      .from('users')
      .select('firstName')
      .eq('id', userId)
      .single();
    const firstName = user?.firstName || '';
    const { activationPushEmail } = await import('../emails/activationPushEmail');
    const html = activationPushEmail(firstName);
    const subject = 'Turn Free into First Placement';
    return await sendUserHtmlEmail(userId, subject, html);
  } catch (err) {
    console.error('[sendActivationPushEmail] Error building activation email:', err);
    return false;
  }
}


