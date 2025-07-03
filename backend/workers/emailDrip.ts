import { supabaseDb } from '../lib/supabase';
import { sendTemplateEmail } from '../lib/emailDrip';

const TEMPLATES = {
  welcome: process.env.SENDGRID_TEMPLATE_WELCOME!,
  power: process.env.SENDGRID_TEMPLATE_POWERUP!,
  expiry: process.env.SENDGRID_TEMPLATE_EXPIRY!
};

(async ()=>{
  const today = new Date();
  const { data: rows } = await supabaseDb.rpc('get_trial_email_status');
  if(!rows) return;
  for(const row of rows){
    const days = Math.floor((today.getTime() - new Date(row.created_at).getTime())/86400000);
    if(!row.welcome_sent){
      await sendTemplateEmail(row.user_id, TEMPLATES.welcome);
      await supabaseDb.from('trial_emails').update({ welcome_sent:true }).eq('user_id', row.user_id);
    } else if(days>=1 && !row.powerup_sent){
      await sendTemplateEmail(row.user_id, TEMPLATES.power);
      await supabaseDb.from('trial_emails').update({ powerup_sent:true }).eq('user_id', row.user_id);
    } else if(days>=6 && !row.expiry_sent){
      await sendTemplateEmail(row.user_id, TEMPLATES.expiry);
      await supabaseDb.from('trial_emails').update({ expiry_sent:true }).eq('user_id', row.user_id);
    }
  }
  process.exit(0);
})(); 