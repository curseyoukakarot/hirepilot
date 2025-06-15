import sgMail, { MailDataRequired } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY environment variable is not set');
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com',
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
    const msg: MailDataRequired = {
      to: data.to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com',
      templateId: process.env.SENDGRID_TEMPLATE_ID || '',
      dynamicTemplateData: {
        first_name: data.firstName,
        last_name: data.lastName,
        invite_link: data.inviteLink,
        temp_password: data.tempPassword,
        invited_by_name: `${data.invitedBy.firstName} ${data.invitedBy.lastName}`,
        invited_by_email: data.invitedBy.email,
        company: data.company,
        role: data.role,
        is_new_user: !!data.tempPassword
      },
      content: [{ type: 'text/plain', value: 'Team Invitation' }]
    };

    await sgMail.send(msg);
    console.log('Team invite email sent successfully to:', data.to);
    return { success: true };
  } catch (error) {
    console.error('Error sending team invite email:', error);
    throw error;
  }
}; 