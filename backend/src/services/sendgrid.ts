import sg from '@sendgrid/mail';

sg.setApiKey(process.env.SENDGRID_API_KEY!);
const FROM = process.env.SENDGRID_FROM!;

export async function sendEmail(
  to: string, 
  subject: string, 
  html: string, 
  headers?: Record<string, string>
) {
  await sg.send({ 
    from: FROM, 
    to, 
    subject, 
    html, 
    headers 
  });
}
