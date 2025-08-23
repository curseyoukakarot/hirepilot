console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase';
import OpenAI from 'openai';
import { updateLeadOutreachStage } from '../services/sourcingUtils';
import { sendSourcingReplyNotification } from '../services/sourcingNotifications';

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
    const campaignId = headers['X-Campaign-Id'] || headers['x-campaign-id'];
    const leadId = headers['X-Lead-Id'] || headers['x-lead-id'];
    
    console.log(`🏷️ Campaign ID: ${campaignId}, Lead ID: ${leadId}`);
    
    if (!campaignId || !leadId) {
      console.warn('⚠️ Missing campaign or lead ID in headers, storing as unassigned');
      // Could implement fallback logic here (e.g., parse plus addressing)
      return res.status(200).json({ 
        ok: true, 
        message: 'Reply received but not assigned to campaign' 
      });
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
    
    // Send notifications via multiple channels
    await Promise.all([
      // Primary notification service (Slack + Email)
      sendSourcingReplyNotification({
        campaignId,
        leadId,
        replyId: replyRow.id,
        from,
        subject,
        classification: classification.label,
        nextAction: classification.next_action
      }),
      // Secondary notification system (for future integrations)
      sendReplyNotification({
        campaignId,
        leadId,
        from,
        subject,
        classification: classification.label,
        nextAction: classification.next_action,
        replyId: replyRow.id
      })
    ]);
    
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

export default router;
