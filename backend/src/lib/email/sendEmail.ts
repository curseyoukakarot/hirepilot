/**
 * Email sender for backend. Delegates to SendGrid via services/emailService.
 * Use this for task notifications and other server-side transactional emails.
 */
import { sendEmail as sendEmailImpl } from '../../../services/emailService';

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean }> {
  const { to, subject, html, text } = params;
  await sendEmailImpl(to, subject, text || html, html);
  return { success: true };
}
