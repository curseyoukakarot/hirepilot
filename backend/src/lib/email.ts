import sgMail from "@sendgrid/mail";
import { randomUUID } from "crypto";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const SUPPORT_FROM_EMAIL = process.env.SUPPORT_FROM_EMAIL!;

if (!SENDGRID_API_KEY || !SUPPORT_FROM_EMAIL) {
  console.warn("[email] SENDGRID_API_KEY or SUPPORT_FROM_EMAIL not set (staging?)");
}

export async function startSupportEmailThread(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
}) {
  if (!SENDGRID_API_KEY) {
    return { thread_id: `stub_${randomUUID()}`, sent: false, note: "SendGrid key missing" };
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  const msg = {
    to: params.to,
    from: SUPPORT_FROM_EMAIL,
    subject: params.subject,
    html: params.body,
    cc: params.cc && params.cc.length ? params.cc : undefined
  } as any;

  await sgMail.send(msg);
  return { thread_id: randomUUID(), sent: true };
}


