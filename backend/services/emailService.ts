import sgMail, { MailDataRequired } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY environment variable is not set');
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com';
    const fromName = process.env.SENDGRID_FROM_NAME || 'HirePilot';
    const msg = {
      to,
      from: { email: fromEmail, name: fromName },
      replyTo: process.env.SENDGRID_REPLY_TO_EMAIL || fromEmail,
      subject,
      text,
      html: html || text,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendTeamInviteEmail = async (data: {
  to: string;
  firstName: string;
  lastName: string;
  inviteLink: string;
  tempPassword?: string;
  invitedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  company?: string;
  role: string;
}) => {
  try {
    // Create a simple HTML email instead of using templates
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to HirePilot!</h2>
        <p>Hi ${data.firstName},</p>
        <p>You've been invited to join HirePilot as a <strong>${data.role}</strong> by ${data.invitedBy.firstName} ${data.invitedBy.lastName}.</p>
        ${data.company ? `<p>Company: ${data.company}</p>` : ''}
        <p>Click the link below to get started:</p>
        <div style="margin: 20px 0;">
          <a href="${data.inviteLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        ${data.tempPassword ? `<p><strong>Temporary Password:</strong> ${data.tempPassword}</p>` : ''}
        <p>Best regards,<br>The HirePilot Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          This invitation was sent by ${data.invitedBy.email}. If you didn't expect this invitation, you can ignore this email.
        </p>
      </div>
    `;

    const inviteFromEmail = process.env.SENDGRID_INVITE_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com';
    const inviteFromName = process.env.SENDGRID_INVITE_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'HirePilot';

    const msg = {
      to: data.to,
      from: { email: inviteFromEmail, name: inviteFromName },
      replyTo: data.invitedBy.email,
      subject: `You're invited to join HirePilot${data.company ? ` at ${data.company}` : ''}`,
      text: `Hi ${data.firstName}, you've been invited to join HirePilot as a ${data.role} by ${data.invitedBy.firstName} ${data.invitedBy.lastName}. Click this link to get started: ${data.inviteLink}`,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log('Team invite email sent successfully to:', data.to);
    return { success: true };
  } catch (error) {
    console.error('Error sending team invite email:', error);
    throw error;
  }
}; 