import axios from 'axios';
import { supabase } from '../lib/supabase';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface SourcingReplyNotification {
  campaignId: string;
  leadId: string;
  replyId: string;
  from: string;
  subject: string;
  classification: string;
  nextAction: string;
  leadName?: string;
  leadCompany?: string;
  leadTitle?: string;
  campaignTitle?: string;
  userId?: string;
}

export async function sendSourcingReplyNotification(data: SourcingReplyNotification) {
  try {
    console.log(`📢 Sending sourcing reply notification for reply ${data.replyId}`);
    
    // Get campaign and lead details if not provided
    let campaignTitle = data.campaignTitle;
    let userId = data.userId;
    let leadName = data.leadName;
    let leadCompany = data.leadCompany;
    let leadTitle = data.leadTitle;
    
    if (!campaignTitle || !userId) {
      const { data: campaign } = await supabase
        .from('sourcing_campaigns')
        .select('title, created_by')
        .eq('id', data.campaignId)
        .single();
      
      if (campaign) {
        campaignTitle = campaign.title;
        userId = campaign.created_by;
      }
    }
    
    if (!leadName || !leadCompany || !leadTitle) {
      const { data: lead } = await supabase
        .from('sourcing_leads')
        .select('name, company, title')
        .eq('id', data.leadId)
        .single();
      
      if (lead) {
        leadName = lead.name;
        leadCompany = lead.company;
        leadTitle = lead.title;
      }
    }
    
    if (!userId) {
      console.warn('⚠️ Could not find user ID for notification');
      return;
    }
    
    // Get user notification settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('slack_webhook_url, email_notifications, slack_notifications, email, campaign_updates')
      .eq('user_id', userId)
      .single();
    
    if (settingsError) {
      console.error('Error fetching user settings:', settingsError);
      return;
    }
    
    // Prepare notification content
    const leadInfo = leadName || data.from;
    const companyInfo = leadCompany ? ` at ${leadCompany}` : '';
    const titleInfo = leadTitle ? ` (${leadTitle})` : '';
    
    const classificationEmoji = getClassificationEmoji(data.classification);
    const actionEmoji = getActionEmoji(data.nextAction);
    
    const slackMessage = `${classificationEmoji} *New ${data.classification} reply* from *${leadInfo}*${titleInfo}${companyInfo}
    
📧 *Subject:* ${data.subject}
📋 *Campaign:* ${campaignTitle}
${actionEmoji} *Suggested Action:* ${data.nextAction}

View: ${process.env.FRONTEND_BASE_URL}/admin/sourcing/campaigns/${data.campaignId}/replies/${data.replyId}`;
    
    const emailSubject = `New ${data.classification} reply from ${leadInfo}`;
    const emailText = `New ${data.classification} reply received!

From: ${leadInfo}${titleInfo}${companyInfo}
Subject: ${data.subject}
Campaign: ${campaignTitle}
Classification: ${data.classification}
Suggested Action: ${data.nextAction}

View reply: ${process.env.FRONTEND_BASE_URL}/admin/sourcing/campaigns/${data.campaignId}/replies/${data.replyId}`;
    
    // Send Slack notification if enabled
    if (settings.campaign_updates && settings.slack_webhook_url) {
      try {
        await axios.post(settings.slack_webhook_url, { 
          text: slackMessage,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: slackMessage
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Reply'
                  },
                  url: `${process.env.FRONTEND_BASE_URL}/admin/sourcing/campaigns/${data.campaignId}/replies/${data.replyId}`
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Campaign'
                  },
                  url: `${process.env.FRONTEND_BASE_URL}/admin/sourcing/campaigns/${data.campaignId}`
                }
              ]
            }
          ]
        });
        console.log('✅ Slack notification sent');
      } catch (error) {
        console.error('❌ Error sending Slack notification:', error);
      }
    }
    
    // Send email notification if enabled
    if (settings.campaign_updates && settings.email_notifications && settings.email) {
      try {
        await sgMail.send({
          to: settings.email,
          from: process.env.SENDGRID_FROM || 'noreply@hirepilot.ai',
          subject: emailSubject,
          text: emailText,
          html: `
            <h2>${classificationEmoji} New ${data.classification} reply</h2>
            <p><strong>From:</strong> ${leadInfo}${titleInfo}${companyInfo}</p>
            <p><strong>Subject:</strong> ${data.subject}</p>
            <p><strong>Campaign:</strong> ${campaignTitle}</p>
            <p><strong>Classification:</strong> ${data.classification}</p>
            <p><strong>Suggested Action:</strong> ${actionEmoji} ${data.nextAction}</p>
            <br>
            <a href="${process.env.FRONTEND_BASE_URL}/admin/sourcing/campaigns/${data.campaignId}/replies/${data.replyId}" 
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Reply
            </a>
          `
        });
        console.log('✅ Email notification sent');
      } catch (error) {
        console.error('❌ Error sending email notification:', error);
      }
    }
    
    console.log('✅ Sourcing reply notification completed');
    
  } catch (error) {
    console.error('❌ Error sending sourcing reply notification:', error);
  }
}

function getClassificationEmoji(classification: string): string {
  switch (classification) {
    case 'positive': return '🟢';
    case 'neutral': return '🟡';
    case 'negative': return '🔴';
    case 'oos': return '🟤';
    case 'auto': return '🤖';
    default: return '📧';
  }
}

function getActionEmoji(action: string): string {
  switch (action) {
    case 'reply': return '💬';
    case 'book': return '📅';
    case 'disqualify': return '❌';
    case 'hold': return '⏸️';
    default: return '📋';
  }
}

export async function sendSourcingCampaignNotification(
  type: 'launched' | 'completed' | 'paused' | 'failed',
  campaignId: string,
  details?: {
    leadsScheduled?: number;
    error?: string;
  }
) {
  try {
    const { data: campaign } = await supabase
      .from('sourcing_campaigns')
      .select('title, created_by')
      .eq('id', campaignId)
      .single();
    
    if (!campaign) return;
    
    const { data: settings } = await supabase
      .from('user_settings')
      .select('slack_webhook_url, email_notifications, campaign_updates, email')
      .eq('user_id', campaign.created_by)
      .single();
    
    if (!settings?.campaign_updates) return;
    
    let message = '';
    let subject = '';
    
    switch (type) {
      case 'launched':
        message = `🚀 Sourcing campaign *${campaign.title}* has been launched with ${details?.leadsScheduled || 0} leads!`;
        subject = 'Sourcing campaign launched';
        break;
      case 'completed':
        message = `✅ Sourcing campaign *${campaign.title}* has completed successfully!`;
        subject = 'Sourcing campaign completed';
        break;
      case 'paused':
        message = `⏸️ Sourcing campaign *${campaign.title}* has been paused.`;
        subject = 'Sourcing campaign paused';
        break;
      case 'failed':
        message = `❌ Sourcing campaign *${campaign.title}* failed: ${details?.error || 'Unknown error'}`;
        subject = 'Sourcing campaign failed';
        break;
    }
    
    // Send Slack notification
    if (settings.slack_webhook_url) {
      await axios.post(settings.slack_webhook_url, { text: message });
    }
    
    // Send email notification
    if (settings.email_notifications && settings.email) {
      await sgMail.send({
        to: settings.email,
        from: process.env.SENDGRID_FROM || 'noreply@hirepilot.ai',
        subject,
        text: message.replace(/\*/g, '')
      });
    }
    
  } catch (error) {
    console.error('Error sending sourcing campaign notification:', error);
  }
}
