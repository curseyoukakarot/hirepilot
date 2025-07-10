import 'dotenv/config';
import path from 'path';
import { supabase } from '../lib/supabase';
import { launchQueue } from '../../api/campaigns/launch';
import sgMail from '@sendgrid/mail';
import { enrichLead as proxycurlEnrichLead } from '../../services/proxycurl/enrichLead';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  sourceLeads,
  enrichLead: enrichLeadTool,
  sendMessage,
  getPipelineStats,
  moveCandidate,
  triggerZapier,
  triggerMakeWorkflow,
  fetchCredits: fetchCreditsTool,
  openHelpArticle,
  getEmailStatus,
  scheduleBulkMessages,
  getScheduledMessages,
  cancelScheduledMessage,
  getSchedulerStatus,
  getCampaignLeadCount
} = require('../../tools/rexToolFunctions');

// Resolve SDK root then require specific compiled files to sidestep export mapping quirks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sdkRoot = path.dirname(require.resolve('@modelcontextprotocol/sdk/package.json'));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Server } = require(path.join(sdkRoot, 'server/index.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StdioServerTransport } = require(path.join(sdkRoot, 'server/stdio.js'));

// ---------------------------------------------------------------------------------
// Minimal REX MCP server (stdio transport)
// ---------------------------------------------------------------------------------
const server = new Server({ name: 'REX Server', version: '0.1.0' });

// ------------------ Tool capabilities ------------------
server.registerCapabilities({
  tools: {
    add_numbers: {
      parameters: { a: { type: 'number' }, b: { type: 'number' } },
      handler: async ({ a, b }: { a: number; b: number }) => a + b
    },
    schedule_campaign: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'}, send_time:{type:'string'} },
      handler: async ({ userId, campaign_id, send_time }) => {
        await assertPremium(userId);
        if (!launchQueue) throw new Error('Launch queue not configured');
        const job = await launchQueue.add('launch',{ campaignId:campaign_id, scheduleAt:send_time, userId });
        return { queued:true, jobId:job.id };
      }
    },
    list_available_senders: {
      parameters: { userId:{type:'string'} },
      handler: async ({ userId }) => {
        await assertPremium(userId);
        const { listSenders } = require('../../tools/rexToolFunctions');
        const senders = await listSenders({ userId });
        return { 
          available_senders: senders,
          total_count: senders.length,
          message: senders.length > 1 ? 'Multiple email accounts available. Please specify which one to use.' : 'Single email account found.'
        };
      }
    },
    send_email: {
      parameters: { userId:{type:'string'}, to:{type:'string'}, subject:{type:'string'}, body:{type:'string'}, provider:{type:'string', optional:true} },
      handler: async ({ userId, to, subject, body, provider }) => {
        await assertPremium(userId);
        const { listSenders } = require('../../tools/rexToolFunctions');
        const availableSenders = await listSenders({ userId });
        
        if (availableSenders.length === 0) {
          throw new Error('No email accounts configured. Please set up SendGrid, Google, or Outlook in Settings.');
        }
        
        // If no provider specified but multiple available, ask user to choose
        if (!provider && availableSenders.length > 1) {
          const senderList = availableSenders.map(s => `${s.provider}: ${s.from}`).join(', ');
          throw new Error(`Multiple email accounts available (${senderList}). Please specify which provider to use: sendgrid, google, or outlook.`);
        }
        
        // If only one sender available, use it automatically
        let selectedSender = availableSenders[0];
        if (provider) {
          selectedSender = availableSenders.find(s => s.provider === provider);
          if (!selectedSender) {
            const available = availableSenders.map(s => s.provider).join(', ');
            throw new Error(`Provider '${provider}' not found. Available providers: ${available}`);
          }
        }
        
        // Convert line breaks to HTML breaks for proper email formatting
        const htmlBody = body.replace(/\n/g, '<br/>');
        
        // Send via the selected provider
        if (selectedSender.provider === 'sendgrid') {
          const { data } = await supabase.from('user_sendgrid_keys').select('api_key, default_sender').eq('user_id', userId).single();
          if (!data?.api_key || !data?.default_sender) throw new Error('SendGrid configuration incomplete');
          sgMail.setApiKey(data.api_key);
          const [resp] = await sgMail.send({ to, from: data.default_sender, subject, html: htmlBody });
          return { messageId: resp.headers['x-message-id'], provider: 'sendgrid', from: data.default_sender };
                 } else if (selectedSender.provider === 'google') {
           // Use Gmail API directly
           const { google } = require('googleapis');
           const { getGoogleAccessToken } = require('../../services/googleTokenHelper');
           
           const accessToken = await getGoogleAccessToken(userId);
           const oauth2client = new google.auth.OAuth2();
           oauth2client.setCredentials({ access_token: accessToken });
           const gmail = google.gmail({ version: 'v1', auth: oauth2client });
           
           const raw = Buffer.from(
             `To: ${to}\r\n` +
             `Subject: ${subject}\r\n` +
             'Content-Type: text/html; charset=utf-8\r\n' +
             '\r\n' +
             htmlBody
           ).toString('base64url');
           
           const result = await gmail.users.messages.send({
             userId: 'me',
             requestBody: { raw },
           });
           
           return { messageId: result.data.id, provider: 'google', from: selectedSender.from };
         } else if (selectedSender.provider === 'outlook') {
           // Use Outlook API directly
           const { Client } = require('@azure/msal-node');
           const { getOutlookAccessToken } = require('../../services/outlookTokenHelper');
           
           const accessToken = await getOutlookAccessToken(userId);
           const client = require('@microsoft/microsoft-graph-client').Client.init({
             authProvider: (done) => {
               done(null, accessToken);
             }
           });
           
           const message = {
             message: {
               subject,
               body: {
                 contentType: 'HTML',
                 content: htmlBody
               },
               toRecipients: [{
                 emailAddress: {
                   address: to
                 }
               }]
             }
           };
           
           const result = await client.api('/me/sendMail').post(message);
           return { messageId: 'outlook_sent', provider: 'outlook', from: selectedSender.from };
         } else {
           throw new Error(`Unsupported provider: ${selectedSender.provider}`);
         }
      }
    },
    enrich_lead: {
      parameters: { userId:{type:'string'}, identifier:{type:'string'} },
      handler: async (rawArgs: any) => {
        const { userId } = rawArgs;
        // Accept multiple possible keys for identifier
        const identifier: string | undefined = rawArgs.identifier || rawArgs.linkedin_identifier || rawArgs.linkedin_url || rawArgs.lead_id;

        await assertPremium(userId);

        if (!identifier) throw new Error('Missing LinkedIn identifier');

        let url = identifier.trim();

        // Helper to check UUID v4
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(url);

        // If UUID or clearly not a LinkedIn URL, look up lead by id/slug
        if (isUUID || !/linkedin\.com\//i.test(url)) {
          const { data, error } = await supabase
            .from('leads')
            .select('linkedin_url')
            .eq('id', url)
            .single();
          if (error) throw error;
          if (!data?.linkedin_url) throw new Error('Lead does not have a LinkedIn URL');
          url = data.linkedin_url as string;
        }

        return await proxycurlEnrichLead(url);
      }
    },
    get_campaign_metrics: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'} },
      handler: async ({ userId, campaign_id }) => {
        await assertPremium(userId);

        let targetId = campaign_id;

        // Resolve special sentinel or non-UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId);
        if (!isUUID) {
          // Treat 'latest' or any non-uuid as request for most recent campaign for user
          const { data: ctxRow } = await supabase
            .from('rex_user_context')
            .select('latest_campaign_id')
            .eq('supabase_user_id', userId)
            .maybeSingle();
          if (!ctxRow?.latest_campaign_id) {
            throw new Error('No recent campaign found for user');
          }
          targetId = ctxRow.latest_campaign_id;
        }

        // Get both email metrics and actual lead counts
        let emailMetrics = null;
        let { data: emailData, error: emailError } = await supabase
          .from('campaign_metrics')
          .select('*')
          .eq('campaign_id', targetId)
          .maybeSingle();

        if (emailError && emailError.code === '42P01') {
          ({ data: emailData, error: emailError } = await supabase
            .from('vw_campaign_metrics_debug')
            .select('*')
            .eq('campaign_id', targetId)
            .maybeSingle());
        }

        emailMetrics = emailData;

        // Get actual lead counts using the new function
        let leadCounts = null;
        try {
          leadCounts = await getCampaignLeadCount({ userId, campaignId: targetId });
        } catch (err) {
          console.error('Error getting lead counts:', err);
        }

        // Combine the data
        return {
          campaign_id: targetId,
          email_metrics: emailMetrics,
          lead_data: leadCounts,
          // Legacy fields for backwards compatibility
          campaign_title: leadCounts?.campaign_title || emailMetrics?.campaign_title,
          total_leads: leadCounts?.actual_total_leads || 0,
          enriched_leads: leadCounts?.actual_enriched_leads || 0,
          sent_emails: emailMetrics?.sent_emails || 0,
          opens: emailMetrics?.opens || 0,
          replies: emailMetrics?.replies || 0,
          // New detailed fields
          actual_total_leads: leadCounts?.actual_total_leads || 0,
          actual_enriched_leads: leadCounts?.actual_enriched_leads || 0,
          enrichment_rate: leadCounts?.enrichment_rate || 0,
          campaign_status: leadCounts?.campaign_status || 'unknown'
        };
      }
    },
    get_email_status: {
      parameters: { userId:{type:'string'}, emailId:{type:'string'} },
      handler: async ({ userId, emailId }) => {
        await assertPremium(userId);
        return await getEmailStatus({ emailId });
      }
    },
    // ----------------- Newly added dynamic REX tools -----------------
    source_leads: {
      parameters: {
        userId: { type:'string' },
        campaignId:{ type:'string' },
        source:{ type:'string' },
        filters:{ type:'object' }
      },
      handler: async ({ userId, campaignId, source, filters }) => {
        await assertPremium(userId);
        const creditInfo = await fetchCreditsTool({ userId });
        if (creditInfo.creditsRemaining <= 0) throw new Error('Insufficient credits to source leads.');
        return await sourceLeads({ userId, campaignId, source, filters });
      }
    },
    enrich_lead_advanced: {
      parameters: { userId:{type:'string'}, leadId:{type:'string'}, fields:{type:'array'} },
      handler: async ({ userId, leadId, fields }) => {
        await assertPremium(userId);
        const creditInfo = await fetchCreditsTool({ userId });
        if (creditInfo.creditsRemaining <= 0) throw new Error('Insufficient credits to enrich lead.');
        return await enrichLeadTool({ userId, leadId, fields });
      }
    },
    send_message: {
      parameters: {
        userId:{type:'string'},
        leadId:{type:'string'},
        messageType:{type:'string'},
        tone:{type:'string'},
        jobDetails:{type:'object'}
      },
      handler: async ({ userId, leadId, messageType, tone, jobDetails }) => {
        await assertPremium(userId);
        return await sendMessage({ userId, leadId, messageType, tone, jobDetails });
      }
    },
    get_pipeline_stats: {
      parameters: { userId:{type:'string'}, campaignId:{type:'string'}, stage:{type:'string'} },
      handler: async ({ userId, campaignId, stage }) => {
        await assertPremium(userId);
        return await getPipelineStats({ campaignId, stage });
      }
    },
    move_candidate: {
      parameters: { userId:{type:'string'}, candidateId:{type:'string'}, newStage:{type:'string'} },
      handler: async ({ userId, candidateId, newStage }) => {
        await assertPremium(userId);
        return await moveCandidate({ candidateId, newStage });
      }
    },
    trigger_zapier: {
      parameters: { userId:{type:'string'}, webhookName:{type:'string'}, payload:{type:'object'} },
      handler: async ({ userId, webhookName, payload }) => {
        await assertPremium(userId);
        return await triggerZapier({ webhookName, payload });
      }
    },
    trigger_make_workflow: {
      parameters: { userId:{type:'string'}, workflowId:{type:'string'}, payload:{type:'object'} },
      handler: async ({ userId, workflowId, payload }) => {
        await assertPremium(userId);
        return await triggerMakeWorkflow({ workflowId, payload });
      }
    },
    fetch_credits: {
      parameters: { userId:{type:'string'} },
      handler: async ({ userId }) => {
        return await fetchCreditsTool({ userId });
      }
    },
    open_help_article: {
      parameters: { userId:{type:'string'}, topic:{type:'string'} },
      handler: async ({ userId, topic }) => {
        await assertPremium(userId);
        return await openHelpArticle({ topic });
      }
    },
    schedule_bulk_messages: {
      parameters: { 
        userId: {type:'string'}, 
        leadIds: {type:'array'}, 
        templateId: {type:'string'}, 
        scheduledFor: {type:'string'}, 
        channel: {type:'string'} 
      },
      handler: async ({ userId, leadIds, templateId, scheduledFor, channel }) => {
        await assertPremium(userId);
        return await scheduleBulkMessages({ userId, leadIds, templateId, scheduledFor, channel });
      }
    },
    get_scheduled_messages: {
      parameters: { userId: {type:'string'}, status: {type:'string'} },
      handler: async ({ userId, status }) => {
        await assertPremium(userId);
        return await getScheduledMessages({ userId, status });
      }
    },
    cancel_scheduled_message: {
      parameters: { userId: {type:'string'}, messageId: {type:'string'} },
      handler: async ({ userId, messageId }) => {
        await assertPremium(userId);
        return await cancelScheduledMessage({ userId, messageId });
      }
    },
    get_scheduler_status: {
      parameters: { userId: {type:'string'} },
      handler: async ({ userId }) => {
        await assertPremium(userId);
        return await getSchedulerStatus({ userId });
      }
    },
    get_campaign_lead_count: {
      parameters: { userId: {type:'string'}, campaignId: {type:'string'} },
      handler: async ({ userId, campaignId }) => {
        await assertPremium(userId);
        return await getCampaignLeadCount({ userId, campaignId });
      }
    }
  }
});

// Attach stdio transport (must be after capabilities registration)
server.connect(new StdioServerTransport());

console.log('✅ REX MCP server running on stdio');

async function assertPremium(userId: string) {
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
  if (error) throw error;
  const role = data?.role ?? '';
  if (!['RecruitPro','TeamAdmin','SuperAdmin','super_admin'].includes(role)) {
    throw new Error('REX access restricted to premium plans.');
  }
}

export { server }; 