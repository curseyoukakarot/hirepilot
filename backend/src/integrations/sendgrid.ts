type SendArgs = { from: string; to: string; subject: string; html: string; headers?: Record<string,string> };

export async function sendEmail(args: SendArgs): Promise<void> {
  // Minimal stub: log instead of actual send; replace with real SendGrid impl later
  console.log('[sendEmail] sending', { to: args.to, subject: args.subject });
}


