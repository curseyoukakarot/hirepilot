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

const TEAM_INVITE_TEMPLATE_ID = process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID || 'd-f9601ed966b7477289c18871b289e1da';

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
  expiresInHours?: number;
}) => {
  try {
    const inviteFromEmail = process.env.SENDGRID_INVITE_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com';
    const inviteFromName = process.env.SENDGRID_INVITE_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'HirePilot';
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SENDGRID_SUPPORT_EMAIL || 'support@thehirepilot.com';
    const unsubscribeUrl = process.env.SENDGRID_INVITE_UNSUBSCRIBE_URL || process.env.SENDGRID_DEFAULT_UNSUBSCRIBE_URL || 'https://thehirepilot.com/unsubscribe';
    const preferencesUrl = process.env.SENDGRID_INVITE_PREFERENCES_URL || process.env.SENDGRID_DEFAULT_PREFERENCES_URL || 'https://app.thehirepilot.com/settings/notifications';
    const templateId = TEAM_INVITE_TEMPLATE_ID;

    const invitedByName = `${data.invitedBy.firstName || ''} ${data.invitedBy.lastName || ''}`.trim() || data.invitedBy.email;
    const dynamicTemplateData = {
      first_name: data.firstName,
      invited_by_name: invitedByName,
      invite_link: data.inviteLink,
      support_email: supportEmail,
      unsubscribe_url: unsubscribeUrl,
      preferences_url: preferencesUrl,
      company: data.company || '',
      role: data.role,
      temp_password: data.tempPassword || '',
      inviter_email: data.invitedBy.email,
      expires_in_hours: data.expiresInHours || Number(process.env.TEAM_INVITE_EXPIRATION_HOURS || '24')
    };

    const baseMsg: MailDataRequired = {
      to: data.to,
      from: { email: inviteFromEmail, name: inviteFromName },
      replyTo: data.invitedBy.email,
      subject: `You're invited to join HirePilot${data.company ? ` at ${data.company}` : ''}`,
      text: `Hi ${data.firstName}, you've been invited to join HirePilot as a ${data.role}. Click this link to get started: ${data.inviteLink}`,
      templateId,
      dynamicTemplateData
    };

    // If template id is not configured, fall back to legacy HTML rendering
    if (!templateId) {
      const fallbackHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to HirePilot!</h2>
          <p>Hi ${data.firstName},</p>
          <p>You've been invited to join HirePilot as a <strong>${data.role}</strong> by ${invitedByName}.</p>
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
      await sgMail.send({ ...baseMsg, html: fallbackHtml, templateId: undefined, dynamicTemplateData: undefined } as MailDataRequired);
    } else {
      await sgMail.send(baseMsg);
    }
    console.log('Team invite email sent successfully to:', data.to);
    return { success: true };
  } catch (error) {
    console.error('Error sending team invite email:', error);
    throw error;
  }
}; 

export const sendWorkspaceInviteEmail = async (data: {
  to: string;
  inviteLink: string;
  invitedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  workspaceName: string;
  role: string;
  expiresInHours?: number;
}) => {
  try {
    const fromEmail = process.env.SENDGRID_INVITE_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com';
    const fromName = process.env.SENDGRID_INVITE_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'HirePilot';
    const invitedByName = `${data.invitedBy.firstName || ''} ${data.invitedBy.lastName || ''}`.trim() || data.invitedBy.email;
    const subject = `You're invited to join "${data.workspaceName}" on HirePilot`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color:#111;">Join ${data.workspaceName}</h2>
        <p>${invitedByName} invited you to join the workspace <strong>${data.workspaceName}</strong> as <strong>${data.role}</strong>.</p>
        <p>Click the button below to accept this workspace invite:</p>
        <p style="margin: 24px 0;">
          <a href="${data.inviteLink}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
            Accept Workspace Invite
          </a>
        </p>
        <p style="color:#666;font-size:12px;">If you did not expect this invite, you can ignore this email.</p>
      </div>
    `;
    const text = `You were invited to join the workspace "${data.workspaceName}" as ${data.role}. Accept here: ${data.inviteLink}`;
    await sgMail.send({
      to: data.to,
      from: { email: fromEmail, name: fromName },
      replyTo: data.invitedBy.email,
      subject,
      text,
      html
    } as MailDataRequired);
    return { success: true };
  } catch (error) {
    console.error('Error sending workspace invite email:', error);
    throw error;
  }
};

const KANBAN_EXISTING_USER_TEMPLATE_ID = 'd-4965e76d434d4134b5384dfe3ad39109';
const KANBAN_GUEST_TEMPLATE_ID = 'd-7cbd9c659dfd487d8ad111d8cf0d1ed4';

type KanbanInviteEmailPayload = {
  to: string;
  workspaceName: string;
  boardName: string;
  boardUrl: string;
  inviteEmail: string;
  acceptInviteUrl: string;
  declineInviteUrl: string;
  inviteExpiresIn: string;
  addedAt: string;
  year: string;
  brandAddress: string;
  invitedBy: {
    name: string;
    email: string;
  };
  memberRole: string;
};

async function sendKanbanTemplateEmail(templateId: string, payload: KanbanInviteEmailPayload) {
  const fromEmail = process.env.SENDGRID_INVITE_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com';
  const fromName = process.env.SENDGRID_INVITE_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'HirePilot';
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.SENDGRID_SUPPORT_EMAIL || 'support@thehirepilot.com';
  const preferencesUrl = process.env.SENDGRID_INVITE_PREFERENCES_URL || process.env.SENDGRID_DEFAULT_PREFERENCES_URL || 'https://app.thehirepilot.com/settings/notifications';

  const dynamicTemplateData = {
    workspace_name: payload.workspaceName,
    inviter_name: payload.invitedBy.name,
    board_name: payload.boardName,
    member_role: payload.memberRole,
    board_url: payload.boardUrl,
    invite_email: payload.inviteEmail,
    accept_invite_url: payload.acceptInviteUrl,
    decline_invite_url: payload.declineInviteUrl,
    invite_expires_in: payload.inviteExpiresIn,
    added_at: payload.addedAt,
    year: payload.year,
    brand_address: payload.brandAddress,
    support_email: supportEmail,
    preferences_url: preferencesUrl,
  };

  const msg: MailDataRequired = {
    to: payload.to,
    from: { email: fromEmail, name: fromName },
    replyTo: payload.invitedBy.email,
    subject: `You've been added to "${payload.boardName}"`,
    text: `You've been added to the Kanban board "${payload.boardName}". Open: ${payload.boardUrl || payload.acceptInviteUrl}`,
    templateId,
    dynamicTemplateData,
  };

  await sgMail.send(msg);
  return { success: true };
}

export const sendKanbanExistingUserEmail = async (payload: KanbanInviteEmailPayload) => {
  try {
    return await sendKanbanTemplateEmail(KANBAN_EXISTING_USER_TEMPLATE_ID, payload);
  } catch (error) {
    console.error('Error sending kanban existing-user email:', error);
    throw error;
  }
};

export const sendKanbanGuestInviteEmail = async (payload: KanbanInviteEmailPayload) => {
  try {
    return await sendKanbanTemplateEmail(KANBAN_GUEST_TEMPLATE_ID, payload);
  } catch (error) {
    console.error('Error sending kanban guest invite email:', error);
    throw error;
  }
};