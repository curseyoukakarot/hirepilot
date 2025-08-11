import sgMail from '@sendgrid/mail';
import { supabaseDb } from './supabase';
import { notifySlack } from './slack';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendTemplateEmail(userId:string, templateId:string){
  const { data:user } = await supabaseDb.from('users').select('email,firstName,email_notifications').eq('id', userId).single();
  if(!user?.email) return;
  if(user.email_notifications===false) return;

  const msg = {
    to: user.email,
    from: process.env.SENDGRID_FROM_EMAIL!,
    templateId,
    dynamic_template_data: {
      first_name: user.firstName || '',
      frontend_url: process.env.FRONTEND_URL
    }
  } as any;
  await sgMail.send(msg);
  await notifySlack(`📧 Trial email sent (${templateId}) to ${user.email}`);
} 

export async function sendAffiliateWelcomeEmail(userId: string) {
  const templateId = process.env.SENDGRID_TEMPLATE_AFFILIATE_WELCOME;
  if (!templateId) return; // silently skip if not configured

  const { data: user } = await supabaseDb
    .from('users')
    .select('email,firstName,email_notifications')
    .eq('id', userId)
    .single();
  if (!user?.email) return;
  if (user.email_notifications === false) return;

  const msg = {
    to: user.email,
    from: process.env.SENDGRID_FROM_AFFILIATES || process.env.SENDGRID_FROM_EMAIL!,
    replyTo: process.env.SENDGRID_REPLY_TO_AFFILIATES || process.env.SENDGRID_SUPPORT_EMAIL || undefined,
    templateId,
    dynamic_template_data: {
      first_name: user.firstName || '',
      dashboard_url: 'https://affiliates.thehirepilot.com/partners/dashboard',
      signup_url: 'https://affiliates.thehirepilot.com/partners/signup'
    }
  } as any;
  await sgMail.send(msg);
  await notifySlack(`🤝 Affiliate welcome email sent to ${user.email}`);
}