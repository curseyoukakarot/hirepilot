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
  // Robust template resolution for various build layouts
  const tryPaths = [
    path.join(__dirname, `../emails/freeForever/${templateFile}`),              // /app/dist/emails
    path.join(__dirname, `../../emails/freeForever/${templateFile}`),           // /app/emails
    path.join(__dirname, `../../../backend/emails/freeForever/${templateFile}`),// /app/backend/emails
    path.join(process.cwd(), `backend/emails/freeForever/${templateFile}`),     // cwd -> backend/emails
    path.join(process.cwd(), `emails/freeForever/${templateFile}`)              // cwd -> emails
  ];
  let htmlFile = '';
  for (const p of tryPaths) { if (fs.existsSync(p)) { htmlFile = p; break; } }
  if (!htmlFile) throw new Error(`Template not found for ${templateFile}`);
  const html = fs.readFileSync(htmlFile, 'utf-8');
  const personalizedHtml = html.replace(/{{first_name}}/g, substitutions.first_name || 'there');

  const msg = {
    to,
    from: 'support@thehirepilot.com',
    subject,
    html: personalizedHtml,
  } as any;

  await sgMail.send(msg);
}


