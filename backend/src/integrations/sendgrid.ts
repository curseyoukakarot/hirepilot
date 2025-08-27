import sg from '@sendgrid/mail';

type SendArgs = { from: string; to: string; subject: string; html: string; headers?: Record<string,string>; apiKey?: string };

export async function sendEmail(args: SendArgs){
  const key = args.apiKey || process.env.SENDGRID_API_KEY;
  if (!key) {
    throw new Error('missing_sendgrid_api_key');
  }
  sg.setApiKey(key);
  const msg = { to: args.to, from: args.from, subject: args.subject, html: args.html, headers: args.headers || {} } as any;
  await sg.send(msg);
}


