import { supabaseDb } from '../lib/supabase';
import { sendTemplateEmail } from '../lib/emailDrip';

const TEMPLATES = {
  welcome: process.env.SENDGRID_TEMPLATE_WELCOME!,
  power: process.env.SENDGRID_TEMPLATE_POWERUP!,
  expiry: process.env.SENDGRID_TEMPLATE_EXPIRY!
};

export async function processTrialEmails() {
  try {
    console.log('🚀 Processing trial emails...');
    
    const today = new Date();
    const { data: rows, error } = await supabaseDb.rpc('get_trial_email_status');
    
    if (error) {
      console.error('❌ Error fetching trial email status:', error);
      return;
    }
    
    if (!rows || rows.length === 0) {
      console.log('📧 No trial users to process');
      return;
    }
    
    console.log(`📧 Processing ${rows.length} trial users`);
    
    for (const row of rows) {
      const days = Math.floor((today.getTime() - new Date(row.created_at).getTime()) / 86400000);
      
      try {
        if (!row.welcome_sent) {
          console.log(`📧 Sending welcome email to user ${row.user_id} (day 0)`);
          await sendTemplateEmail(row.user_id, TEMPLATES.welcome);
          await supabaseDb.from('trial_emails').update({ welcome_sent: true }).eq('user_id', row.user_id);
        } else if (days >= 1 && !row.powerup_sent) {
          console.log(`📧 Sending powerup email to user ${row.user_id} (day ${days})`);
          await sendTemplateEmail(row.user_id, TEMPLATES.power);
          await supabaseDb.from('trial_emails').update({ powerup_sent: true }).eq('user_id', row.user_id);
        } else if (days >= 6 && !row.expiry_sent) {
          console.log(`📧 Sending expiry email to user ${row.user_id} (day ${days})`);
          await sendTemplateEmail(row.user_id, TEMPLATES.expiry);
          await supabaseDb.from('trial_emails').update({ expiry_sent: true }).eq('user_id', row.user_id);
        }
      } catch (emailError) {
        console.error(`❌ Error sending trial email to user ${row.user_id}:`, emailError);
      }
    }
    
    console.log('✅ Trial email processing complete');
  } catch (error) {
    console.error('❌ Error in processTrialEmails:', error);
  }
} 