import sgMail from '@sendgrid/mail';
import { supabaseDb } from './supabase';
import { notifySlack } from './slack';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendTemplateEmail(userId:string, templateId:string){
  const { data:user } = await supabaseDb.from('users').select('email,first_name,email_notifications').eq('id', userId).single();
  if(!user?.email) return;
  if(user.email_notifications===false) return;

  const msg = {
    to: user.email,
    from: process.env.SENDGRID_FROM_EMAIL!,
    templateId,
    dynamic_template_data: {
      first_name: user.first_name || '',
      frontend_url: process.env.FRONTEND_URL
    }
  } as any;
  await sgMail.send(msg);
  await notifySlack(`📧 Trial email sent (${templateId}) to ${user.email}`);
} 