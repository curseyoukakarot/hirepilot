import { supabaseDb } from '../lib/supabase';
import { sendUpgradeNudgeEmail, sendActivationPushEmail } from '../services/sendUserHtmlEmail';

// Use raw HTML templates instead of SendGrid dynamic templates

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
        // Skip drips if user is upgraded/paid
        if (row.plan && row.plan !== 'free') continue;

        // Day 3: upgrade nudge
        if (days >= 3 && !row.powerup_sent) {
          console.log(`📧 Sending upgrade nudge to user ${row.user_id} (day ${days})`);
          await sendUpgradeNudgeEmail(row.user_id);
          await supabaseDb.from('trial_emails').update({ powerup_sent: true }).eq('user_id', row.user_id);
        }

        // Day 6: activation push
        if (days >= 6 && !row.expiry_sent) {
          console.log(`📧 Sending activation push to user ${row.user_id} (day ${days})`);
          await sendActivationPushEmail(row.user_id);
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