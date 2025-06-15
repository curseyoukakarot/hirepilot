import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface CampaignInfo {
  title: string;
  user_id: string;
}

export interface NotificationPayload {
  campaign: CampaignInfo | CampaignInfo[];
  run_id?: string;
  lead_count?: number;
  error?: string;
  status?: string;
}

export async function sendNotify(type: string, payload: NotificationPayload) {
  // Handle both single campaign and campaign array cases
  const campaign = Array.isArray(payload.campaign) ? payload.campaign[0] : payload.campaign;
  if (!campaign) {
    console.error('Invalid campaign data in notification payload');
    return;
  }

  try {
    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('slack_webhook_url, email_notifications, slack_notifications, email, campaign_updates, team_activity')
      .eq('user_id', campaign.user_id)
      .single();

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError);
      return;
    }

    // Prepare message
    let msg = '';
    let subject = '';

    switch (type) {
      case 'launch':
        msg = `🚀 Campaign *${campaign.title}* just went live!`;
        subject = 'Your campaign is live!';
        break;
      case 'complete':
        msg = `✅ Campaign *${campaign.title}* finished pulling **${payload.lead_count}** leads.`;
        subject = 'Leads ready to review';
        break;
      case 'failed':
        msg = `❌ Campaign *${campaign.title}* failed to complete.`;
        subject = 'Campaign failed';
        break;
      case 'enrichment_progress':
        msg = `🔄 Enriching leads for *${campaign.title}*... **${payload.lead_count}** leads enriched so far.`;
        subject = 'Enriching leads...';
        break;
      case 'enrichment_complete':
        msg = `✨ All leads for *${campaign.title}* have been enriched and are ready to review!`;
        subject = 'Leads enriched and ready';
        break;
    }

    // Send Slack notification if enabled and webhook URL exists
    if (settings.campaign_updates && settings.slack_webhook_url) {
      try {
        await axios.post(settings.slack_webhook_url, { text: msg });
      } catch (error) {
        console.error('Error sending Slack notification:', error);
      }
    }

    // Send email notification if enabled
    if (settings.campaign_updates && settings.email_notifications && settings.email) {
      try {
        await sgMail.send({
          to: settings.email,
          from: 'noreply@hirepilot.ai',
          subject,
          text: msg.replace(/\*/g, '') // Remove markdown for email
        });
      } catch (error) {
        console.error('Error sending email notification:', error);
      }
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export async function sendTeamNotify(
  event: 'member_joined' | 'member_left' | 'role_changed',
  userId: string,
  details: {
    memberName: string;
    role?: string;
  }
) {
  try {
    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('slack_webhook_url, email_notifications, slack_notifications, email, team_activity')
      .eq('user_id', userId)
      .single();

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError);
      return;
    }

    // Prepare message
    let msg = '';
    let subject = '';

    switch (event) {
      case 'member_joined':
        msg = `👋 *${details.memberName}* has joined the team!`;
        subject = 'New team member joined';
        break;
      case 'member_left':
        msg = `👋 *${details.memberName}* has left the team.`;
        subject = 'Team member left';
        break;
      case 'role_changed':
        msg = `🔄 *${details.memberName}*'s role has been updated to *${details.role}*.`;
        subject = 'Team member role updated';
        break;
    }

    // Send Slack notification if enabled and webhook URL exists
    if (settings.team_activity && settings.slack_webhook_url) {
      try {
        await axios.post(settings.slack_webhook_url, { text: msg });
      } catch (error) {
        console.error('Error sending Slack notification:', error);
      }
    }

    // Send email notification if enabled
    if (settings.team_activity && settings.email_notifications && settings.email) {
      try {
        await sgMail.send({
          to: settings.email,
          from: 'noreply@hirepilot.ai',
          subject,
          text: msg.replace(/\*/g, '') // Remove markdown for email
        });
      } catch (error) {
        console.error('Error sending email notification:', error);
      }
    }
  } catch (error) {
    console.error('Notification error:', error);
  }
} 