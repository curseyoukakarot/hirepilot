/**
 * Email notification helper
 * Sends email notifications when users are added as collaborators
 */

import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendEmail({ to, subject, text, html }: { 
  to: string; 
  subject: string; 
  text: string; 
  html?: string; 
}) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('SENDGRID_API_KEY not configured, skipping email notification');
      return;
    }

    const msg = {
      to,
      from: process.env.FROM_EMAIL || 'no-reply@thehirepilot.com',
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    };

    await sgMail.send(msg);
    console.log('Email notification sent successfully to', to);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

export async function sendCollaboratorNotificationEmail(userEmail: string, jobTitle: string, jobUrl?: string) {
  const subject = 'New Job Collaboration - HirePilot';
  const text = `You've been added as a collaborator to "${jobTitle}". Login to HirePilot to view the job.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">New Job Collaboration</h2>
      <p>Hello!</p>
      <p>You've been added as a collaborator to the job requisition: <strong>"${jobTitle}"</strong></p>
      <p>You can now view and collaborate on this job requisition in HirePilot.</p>
      ${jobUrl ? `<p><a href="${jobUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Job Requisition</a></p>` : ''}
      <p>Best regards,<br>The HirePilot Team</p>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject,
    text,
    html
  });
}
