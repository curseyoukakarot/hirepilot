import sg from '@sendgrid/mail';
sg.setApiKey(process.env.SENDGRID_API_KEY!);

type SendArgs = { from: string; to: string; subject: string; html: string; headers?: Record<string,string> };

export async function sendEmail(args: SendArgs){
  const msg = { to: args.to, from: args.from, subject: args.subject, html: args.html, headers: args.headers || {} } as any;
  await sg.send(msg);
}


