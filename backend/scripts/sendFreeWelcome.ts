import { sendEmail } from '../lib/sendEmail';

async function main() {
  const recipients: Array<{ email: string; first_name: string }> = [
    { email: 'braithwaiteagency@gmail.com', first_name: 'there' },
    { email: 'tyler.bosch@gmail.com', first_name: 'Tyler' }
  ];

  for (const r of recipients) {
    try {
      await sendEmail(r.email, '🎉 Your Free HirePilot Account is Live!', 'welcome.html', { first_name: r.first_name });
      console.log(`Sent welcome email to ${r.email}`);
    } catch (e: any) {
      console.error(`Failed to send to ${r.email}:`, e?.message || e);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
