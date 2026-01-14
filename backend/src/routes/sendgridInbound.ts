console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase';
import OpenAI from 'openai';
import { updateLeadOutreachStage } from '../services/sourcingUtils';
import { sendSourcingReplyNotification } from '../services/sourcingNotifications';
import { SourcingNotifications } from '../lib/notifications';
import { sendCardToSlack } from '../services/slack';

const upload = multer();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Debug logging for route registration
console.log('Registering SendGrid sourcing inbound routes...');

// SendGrid Inbound Parse webhook for sourcing campaigns
// Configure SendGrid to POST to: /api/webhooks/sendgrid/sourcing/inbound
router.post('/webhooks/sendgrid/sourcing/inbound', upload.any(), async (req: Request, res: Response) => {
  try {
    console.log('📧 Received SendGrid inbound webhook for sourcing');
    
    // SendGrid sends form-data with parsed fields
    const payload = req.body;
    const headers = payload.headers ? JSON.parse(payload.headers) : {};
    
    // Extract email data
    const from = payload.from;
    const to = payload.to;
    const subject = payload.subject || '';
    const text = payload.text || '';
    const html = payload.html || '';
    const body = text || html || '';
    
    console.log(`📨 Email from: ${from}, to: ${to}, subject: ${subject}`);
    
    // Extract campaign and lead IDs from headers
    let campaignId = headers['X-Campaign-Id'] || headers['x-campaign-id'];
    let leadId = headers['X-Lead-Id'] || headers['x-lead-id'];
    
    console.log(`🏷️ Campaign ID: ${campaignId}, Lead ID: ${leadId}`);
    
    if (!campaignId || !leadId) {
      console.warn('⚠️ Missing campaign or lead ID in headers, attempting fallback resolution…');
      // Try to parse reply-to address format: msg_{messageId}.u_{userId}.c_{campaignOrNone}@domain
      const parseAddr = (addr: string) => {
        const raw = String(addr || '');
        // Supports optional lead: msg_<id>.u_<user>.c_<campaign|none>.l_<lead|none>@domain
        const match = raw.match(/msg_([^.\s]+)\.u_([0-9a-fA-F-]+)\.c_([0-9a-fA-F-]+|none)(?:\.l_([0-9a-fA-F-]+|none))?/i);
        if (match) {
          return { messageId: match[1], userId: match[2], campaignId: match[3], leadId: match[4] || null };
        }
        return { messageId: null, userId: null, campaignId: null, leadId: null };
      };
      const { messageId: trackingMsgId, userId: addrUserId, campaignId: addrCampaignId, leadId: addrLeadId } = parseAddr(to || '');
      // Use c_/l_ parts if present (may be 'none')
      if (!campaignId && addrCampaignId && String(addrCampaignId).toLowerCase() !== 'none') campaignId = addrCampaignId;
      if (!leadId && addrLeadId && String(addrLeadId).toLowerCase() !== 'none') leadId = addrLeadId;
      // Try to recover lead/campaign from messages or email_events by trackingMsgId
      if (trackingMsgId) {
        try {
          const { data: msgRow } = await supabase
            .from('messages')
            .select('lead_id,campaign_id,user_id')
            .eq('message_id', trackingMsgId)
            .maybeSingle();
          if (msgRow) {
            leadId = leadId || (msgRow as any).lead_id || null;
            campaignId = campaignId || (msgRow as any).campaign_id || null;
          } else {
            const { data: evRow } = await supabase
              .from('email_events')
              .select('lead_id,campaign_id,user_id')
              .eq('message_id', trackingMsgId)
              .maybeSingle();
            if (evRow) {
              leadId = leadId || (evRow as any).lead_id || null;
              campaignId = campaignId || (evRow as any).campaign_id || null;
            }
          }
        } catch (e) {
          console.warn('[inbound] lookup by tracking message_id failed', (e as any)?.message || e);
        }
      }
      // If still no leadId, try email-based resolution
      if (!leadId) {
        const extractEmail = (s: string) => {
          const m = String(s || '').match(/<([^>]+)>/);
          const v = (m ? m[1] : String(s || '')).trim();
          // Remove display names or quotes if any remain
          const clean = v.replace(/^"+|"+$/g, '');
          return clean.toLowerCase();
        };
        const fromEmail = extractEmail(from || '');
        const userScopeId = addrUserId || null;
        if (fromEmail && userScopeId) {
          try {
            // Prefer sourcing_leads (since sourcing_replies.lead_id references sourcing_leads)
            if (campaignId) {
              const { data: srcLeadByCampaign } = await supabase
                .from('sourcing_leads')
                .select('id,campaign_id')
                .eq('campaign_id', campaignId)
                .ilike('email', fromEmail)
                .maybeSingle();
              if (srcLeadByCampaign?.id) {
                leadId = srcLeadByCampaign.id;
              }
            }
            // Broader fallback: any sourcing_lead matching the email (may be ambiguous across campaigns)
            if (!leadId) {
              const { data: srcLeadAny } = await supabase
                .from('sourcing_leads')
                .select('id,campaign_id,created_at')
                .ilike('email', fromEmail)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (srcLeadAny?.id) {
                leadId = srcLeadAny.id;
                campaignId = campaignId || (srcLeadAny as any).campaign_id || null;
              }
            }
          } catch (e) {
            console.warn('[inbound] email-based lead resolution failed', (e as any)?.message || e);
          }
        }
      }
      if (!leadId) {
        console.warn('⚠️ Could not resolve lead; proceeding without attribution');
      }
    }
    
    // Store the reply in database
    const { data: replyRow, error: insertError } = await supabase
      .from('sourcing_replies')
      .insert({
        campaign_id: campaignId,
        lead_id: leadId,
        direction: 'inbound',
        subject,
        body,
        email_from: from,
        email_to: to,
        received_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error storing reply:', insertError);
      return res.status(500).json({ error: insertError.message });
    }
    
    console.log(`✅ Reply stored with ID: ${replyRow.id}`);
    
    // Classify the reply using AI
    console.log('🤖 Classifying reply with AI...');
    const classification = await classifyReply(body);
    console.log(`🏷️ Classification: ${classification.label}, Next action: ${classification.next_action}`);
    
    // Update reply with classification
    const { error: updateError } = await supabase
      .from('sourcing_replies')
      .update({
        classified_as: classification.label,
        next_action: classification.next_action
      })
      .eq('id', replyRow.id);
    
    if (updateError) {
      console.error('❌ Error updating classification:', updateError);
    }
    
    // Update lead status to 'replied'
    try {
      await updateLeadOutreachStage(leadId, 'replied');
      console.log(`✅ Updated lead ${leadId} status to 'replied'`);
    } catch (error) {
      console.error('❌ Error updating lead status:', error);
    }
    
    // Get campaign owner for notifications
    const { data: campaign } = await supabase
      .from('sourcing_campaigns')
      .select('created_by')
      .eq('id', campaignId)
      .single();

    const userId = campaign?.created_by;

    // Compute recipients: campaign owner + REX-enabled users on the same team (if any)
    let recipients: string[] = [];
    if (userId) {
      recipients.push(userId);
      try {
        const { data: owner } = await supabase
          .from('users')
          .select('team_id')
          .eq('id', userId)
          .single();
        if (owner?.team_id) {
          const { data: teamUsers } = await supabase
            .from('users')
            .select('id')
            .eq('team_id', owner.team_id);
          const ids = (teamUsers || []).map(u => u.id);
          if (ids.length) {
            const { data: rexEnabled } = await supabase
              .from('user_settings')
              .select('user_id, agent_mode_enabled')
              .in('user_id', ids);
            const extra = (rexEnabled || []).filter(r => r.agent_mode_enabled).map(r => r.user_id);
            recipients.push(...extra);
          }
        }
      } catch (e) {
        console.warn('Failed to resolve team recipients', e);
      }
    }

    // De-dup recipients
    recipients = Array.from(new Set(recipients.filter(Boolean)));

    // Send notifications via multiple channels to each recipient
    await Promise.all(recipients.map(rid => Promise.all([
      // Primary notification service (Slack + Email) per recipient
      sendSourcingReplyNotification({
        campaignId,
        leadId,
        replyId: replyRow.id,
        from,
        subject,
        classification: classification.label,
        nextAction: classification.next_action,
        userId: rid
      }),
      // In-app Action Inbox card per recipient
      SourcingNotifications.newReply({
        userId: rid,
        campaignId,
        leadId,
        replyId: replyRow.id,
        classification: classification.label,
        subject,
        fromEmail: from,
        body,
        source: 'inapp'
      }),
      // Slack mirror card per recipient
      process.env.SLACK_BOT_TOKEN ? sendSlackReplyNotification({
        userId: rid,
        from,
        classification: classification.label,
        nextAction: classification.next_action,
        body,
        campaignId,
        leadId
      }) : Promise.resolve(null)
    ])));

    // Secondary legacy notification (owner only) for compatibility
    await sendReplyNotification({
      campaignId,
      leadId,
      from,
      subject,
      classification: classification.label,
      nextAction: classification.next_action,
      replyId: replyRow.id
    });
    
    console.log('🎉 Reply processing completed successfully');
    return res.status(200).json({ 
      ok: true, 
      replyId: replyRow.id,
      classification: classification.label,
      nextAction: classification.next_action
    });
    
  } catch (error: any) {
    console.error('💥 Error processing inbound email:', error);
    return res.status(500).json({ error: error.message });
  }
});

// AI-powered reply classification
async function classifyReply(text: string): Promise<{label: string; next_action: string}> {
  try {
    const prompt = `Classify this email reply as one of: positive|neutral|negative|oos|auto

positive: Interested, wants to learn more, positive response
neutral: Neutral response, needs follow-up, asking questions  
negative: Not interested, rejection, negative response
oos: Out-of-scope, unrelated content, forwarded messages
auto: Out-of-office, auto-reply, vacation messages

Suggest next_action as one of: reply|book|disqualify|hold

reply: Send follow-up email
book: Try to book a meeting/call
disqualify: Remove from campaign
hold: Wait before next action

Return JSON only: {"label":"","next_action":""}

Email content:
${text}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    // Validate response
    const validLabels = ['positive', 'neutral', 'negative', 'oos', 'auto'];
    const validActions = ['reply', 'book', 'disqualify', 'hold'];
    
    if (!validLabels.includes(parsed.label)) {
      parsed.label = 'neutral';
    }
    
    if (!validActions.includes(parsed.next_action)) {
      parsed.next_action = 'reply';
    }
    
    return parsed;
    
  } catch (error) {
    console.error('❌ Error classifying reply:', error);
    return { label: 'neutral', next_action: 'reply' };
  }
}

// Send notification about new reply
async function sendReplyNotification(data: {
  campaignId: string;
  leadId: string;
  from: string;
  subject: string;
  classification: string;
  nextAction: string;
  replyId: string;
}) {
  try {
    console.log(`📢 Sending notification for reply ${data.replyId}`);
    
    // Get campaign and lead details
    const { data: campaign } = await supabase
      .from('sourcing_campaigns')
      .select('title, created_by')
      .eq('id', data.campaignId)
      .single();
    
    const { data: lead } = await supabase
      .from('sourcing_leads')
      .select('name, company, title')
      .eq('id', data.leadId)
      .single();
    
    if (!campaign || !lead) {
      console.warn('⚠️ Could not find campaign or lead for notification');
      return;
    }
    
    const notificationData = {
      thread_key: `sourcing:${data.campaignId}:${data.leadId}`,
      title: `New ${data.classification} reply from ${lead.name || data.from}`,
      body_md: `**Campaign:** ${campaign.title}\n**From:** ${lead.name} (${lead.title} at ${lead.company})\n**Subject:** ${data.subject}\n**Classification:** ${data.classification}\n**Suggested Action:** ${data.nextAction}`,
      actions: [
        {
          label: 'View Reply',
          url: `/admin/sourcing/campaigns/${data.campaignId}/replies/${data.replyId}`
        },
        {
          label: 'View Campaign',
          url: `/admin/sourcing/campaigns/${data.campaignId}`
        }
      ],
      user_id: campaign.created_by
    };
    
    // Store notification for future processing or integrate with notification system
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: notificationData.user_id,
        thread_key: notificationData.thread_key,
        title: notificationData.title,
        body: notificationData.body_md,
        actions: JSON.stringify(notificationData.actions),
        type: 'sourcing_reply',
        read: false,
        created_at: new Date().toISOString()
      });
    
    if (notificationError) {
      console.warn('⚠️ Could not store notification:', notificationError);
    }
    
    // TODO: Integrate with additional notification systems (push, in-app, etc.)
    // await pushNotification(notificationData);
    
    console.log('✅ Notification prepared and stored:', notificationData.title);
    
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Send interactive reply notification to Slack
 */
async function sendSlackReplyNotification(params: {
  userId: string;
  from: string;
  classification: string;
  nextAction: string;
  body: string;
  campaignId: string;
  leadId: string;
}) {
  try {
    // Get user's Slack channel or DM (you may need to implement user -> Slack mapping)
    // For now, we'll use a default channel or the user ID as channel
    const slackChannel = process.env.SLACK_DEFAULT_CHANNEL || params.userId;
    
    await sendCardToSlack(slackChannel, {
      title: `New reply from ${params.from}`,
      body_md: `_${params.classification}_ • Suggested next: *${params.nextAction}*\n\n${(params.body || '').slice(0, 500)}${params.body.length > 500 ? '...' : ''}`,
      actions: [
        {
          id: 'reply_draft',
          type: 'button',
          label: '🤖 Draft with REX'
        },
        {
          id: 'book_meeting',
          type: 'button',
          label: '📅 Book Meeting'
        },
        {
          id: 'disqualify',
          type: 'button',
          label: '❌ Disqualify'
        }
      ],
      thread_key: `sourcing:${params.campaignId}:${params.leadId}`,
      metadata: {
        campaign_id: params.campaignId,
        lead_id: params.leadId,
        classification: params.classification,
        from_email: params.from
      }
    });
    
    console.log(`✅ Slack notification sent for reply from ${params.from}`);
  } catch (error) {
    console.error('❌ Failed to send Slack notification:', error);
    // Don't throw - Slack failures shouldn't break the main flow
  }
}

export default router;
