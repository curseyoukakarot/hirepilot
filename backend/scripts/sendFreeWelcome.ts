import 'dotenv/config';
import { sendEmail } from '../lib/sendEmail';
import { supabaseDb } from '../lib/supabase';

type Recipient = { id?: string; email: string; first_name: string };

async function sendToRecipients(recipients: Recipient[]) {
  for (const r of recipients) {
    try {
      await sendEmail(r.email, '🎉 Your Free HirePilot Account is Live!', 'welcome.html', { first_name: r.first_name || 'there' });
      if (r.id) {
        await supabaseDb.from('users').update({ free_welcome_sent_at: new Date().toISOString() }).eq('id', r.id);
      } else {
        await supabaseDb.from('users').update({ free_welcome_sent_at: new Date().toISOString() }).eq('email', r.email);
      }
      console.log(`Sent welcome email to ${r.email}`);
    } catch (e: any) {
      console.error(`Failed to send to ${r.email}:`, e?.message || e);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const emailsArg = args.find(a => a.startsWith('--emails='));
  const backfill = args.includes('--backfill');

  if (emailsArg) {
    const emails = emailsArg.replace('--emails=', '').split(',').map(s => s.trim()).filter(Boolean);
    const recipients: Recipient[] = emails.map(e => ({ email: e, first_name: 'there' }));
    await sendToRecipients(recipients);
    return;
  }

  if (backfill) {
    const { data, error } = await supabaseDb
      .from('users')
      .select('id,email,first_name,last_name,role,plan,free_welcome_sent_at')
      .is('free_welcome_sent_at', null)
      .or('role.eq.free,plan.eq.free');
    if (error) throw error;
    const recipients: Recipient[] = (data || [])
      .filter((u: any) => !!u.email)
      .map((u: any) => ({ id: u.id, email: u.email, first_name: u.first_name || 'there' }));
    console.log(`Backfilling ${recipients.length} users...`);
    await sendToRecipients(recipients);
    return;
  }

  console.log('Usage: ts-node scripts/sendFreeWelcome.ts --backfill OR --emails=email1,email2');
}

main().catch((e) => { console.error(e); process.exit(1); });
