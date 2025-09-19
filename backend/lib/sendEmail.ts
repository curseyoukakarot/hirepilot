import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

export async function sendEmail(
  to: string,
  subject: string,
  templateFile: string,
  substitutions: Record<string, string>
) {
  const html = fs.readFileSync(path.join(__dirname, `../emails/freeForever/${templateFile}`), 'utf-8');
  const personalizedHtml = html.replace(/{{first_name}}/g, substitutions.first_name);

  const msg = {
    to,
    from: 'support@thehirepilot.com',
    subject,
    html: personalizedHtml,
  } as any;

  await sgMail.send(msg);
}


