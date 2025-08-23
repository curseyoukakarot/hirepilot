import 'dotenv/config';
import path from 'path';
import fetch from 'node-fetch';
import { supabase } from '../lib/supabase';
import { launchQueue } from '../../api/campaigns/launch';
import sgMail from '@sendgrid/mail';
import { personalizeMessage } from '../../utils/messageUtils';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  sourceLeads,
  filterLeads,
  enrichLead: enrichLeadTool,
  enrichLeadProfile,
  sendMessage,
  getPipelineStats,
  moveCandidate,
  moveCandidateToStageId,
  triggerZapier,
  triggerMakeWorkflow,
  fetchCredits: fetchCreditsTool,
  openHelpArticle,
  getEmailStatus,
  scheduleBulkMessages,
  getScheduledMessages,
  cancelScheduledMessage,
  getSchedulerStatus,
  getCampaignLeadCount,
  testZapierIntegration,
  suggestAutomationWorkflows,
  setupIntegrationGuide,
  troubleshootIntegration,
  getRecentAutomationEvents,
  linkedin_connect,
  convertLeadToCandidate
} = require('../../tools/rexToolFunctions');

// Resolve SDK root then require specific compiled files to sidestep export mapping quirks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sdkRoot = path.dirname(require.resolve('@modelcontextprotocol/sdk/package.json'));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Server } = require(path.join(sdkRoot, 'server/index.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StdioServerTransport } = require(path.join(sdkRoot, 'server/stdio.js'));

// ---------------------------------------------------------------------------------
// API utility function for making requests to backend
// ---------------------------------------------------------------------------------
async function api(endpoint: string, options: { method: string; body?: string } = { method: 'GET' }) {
  const baseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8080';
  const url = `${baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Add authentication token if available
  if (process.env.AGENTS_API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.AGENTS_API_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error: any) {
    console.error(`API request to ${endpoint} failed:`, error);
    throw new Error(`Failed to call ${endpoint}: ${error.message}`);
  }
}

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
      parameters: {
        userId:{type:'string'},
        to:{type:'string'},
        subject:{type:'string', optional:true},
        body:{type:'string', optional:true},
        provider:{type:'string', optional:true},
        template_name:{type:'string', optional:true},
        template_id:{type:'string', optional:true}
      },
      handler: async ({ userId, to, subject, body, provider, template_name, template_id }) => {
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
        
        // If a template is specified or subject/body missing, fetch and personalize template
        let finalSubject: string | undefined = subject;
        let finalBody: string | undefined = body;

        if (template_id || template_name || !finalSubject || !finalBody) {
          // Resolve lead by recipient email (for personalization)
          const { data: leadRow } = await supabase
            .from('leads')
            .select('*')
            .eq('user_id', userId)
            .ilike('email', to)
            .maybeSingle();

          if (template_id || template_name) {
            let template: any = null;
            if (template_id) {
              const { data, error } = await supabase
                .from('email_templates')
                .select('id, name, subject, content')
                .eq('id', template_id)
                .eq('user_id', userId)
                .single();
              if (error) throw new Error(`Template not found: ${error.message}`);
              template = data;
            } else if (template_name) {
              const { data: exact } = await supabase
                .from('email_templates')
                .select('id, name, subject, content')
                .eq('user_id', userId)
                .ilike('name', template_name)
                .maybeSingle();
              if (exact) {
                template = exact;
              } else {
                const { data, error } = await supabase
                  .from('email_templates')
                  .select('id, name, subject, content')
                  .eq('user_id', userId)
                  .ilike('name', `%${template_name}%`);
                if (error) throw new Error(`Template search failed: ${error.message}`);
                if (!data || data.length === 0) throw new Error(`Template '${template_name}' not found`);
                if (data.length > 1) throw new Error(`Multiple templates matched '${template_name}'. Please specify exact name or template_id.`);
                template = data[0];
              }
            }
            if (template) {
              finalSubject = personalizeMessage(template.subject || finalSubject || 'Message', leadRow || {});
              finalBody = personalizeMessage(template.content || finalBody || '', leadRow || {});
            }
          }

          if (!finalSubject) finalSubject = 'Message';
          if (!finalBody) finalBody = '';
        }

        // Convert line breaks to HTML breaks for proper email formatting
        const htmlBody = finalBody.replace(/\n/g, '<br/>');
        
        // Send via the selected provider
        if (selectedSender.provider === 'sendgrid') {
          const { data } = await supabase.from('user_sendgrid_keys').select('api_key, default_sender').eq('user_id', userId).single();
          if (!data?.api_key || !data?.default_sender) throw new Error('SendGrid configuration incomplete');
          sgMail.setApiKey(data.api_key);
          const trackingMessageId = require('crypto').randomUUID();
          const [resp] = await sgMail.send({ 
            to, 
            from: data.default_sender, 
            subject: finalSubject, 
            html: htmlBody,
            trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
            customArgs: { user_id: userId, message_id: trackingMessageId },
            replyTo: `msg_${trackingMessageId}.u_${userId}.c_none@${process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com'}`
          } as any);
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
              `Subject: ${finalSubject}\r\n` +
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
                subject: finalSubject,
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
    list_email_templates: {
      parameters: { userId: { type: 'string' }, query: { type: 'string', optional: true } },
      handler: async ({ userId, query }) => {
        await assertPremium(userId);
        let q = supabase
          .from('email_templates')
          .select('id, name, subject, content, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (query && String(query).trim().length > 0) {
          q = q.or(`name.ilike.%${query}%,subject.ilike.%${query}%`);
        }
        const { data, error } = await q;
        if (error) throw new Error(`Failed to list templates: ${error.message}`);
        return (data || []).map(t => ({
          id: t.id,
          name: t.name,
          subject: t.subject || '',
          preview: (t.content || '').slice(0, 120)
        }));
      }
    },
    send_template_email: {
      parameters: {
        userId: { type: 'string' },
        lead: { type: 'string' },
        template_name: { type: 'string', optional: true },
        template_id: { type: 'string', optional: true },
        provider: { type: 'string', optional: true }
      },
      handler: async ({ userId, lead, template_name, template_id, provider }) => {
        await assertPremium(userId);

        // 1) Resolve lead record scoped to user
        let leadRow: any = null;
        const raw = String(lead).trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
        if (raw.includes('@')) {
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('user_id', userId)
            .ilike('email', raw)
            .maybeSingle();
          if (error) throw error;
          leadRow = data;
        } else if (isUUID) {
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('id', raw)
            .eq('user_id', userId)
            .maybeSingle();
          if (error) throw error;
          leadRow = data;
        } else {
          // Name search: split into first and last parts
          const parts = raw.split(/\s+/).filter(Boolean);
          const first = parts[0];
          const last = parts.slice(1).join(' ');
          let q = supabase
            .from('leads')
            .select('*')
            .eq('user_id', userId)
            .ilike('first_name', `%${first}%`);
          if (last) q = q.ilike('last_name', `%${last}%`);
          const { data, error } = await q.limit(5);
          if (error) throw error;
          if (!data || data.length === 0) throw new Error(`Lead '${raw}' not found`);
          if (data.length > 1) throw new Error(`Multiple leads matched '${raw}'. Please specify email or lead id.`);
          leadRow = data[0];
        }

        if (!leadRow?.email) {
          throw new Error('Lead has no email on file. Please enrich the lead to get an email.');
        }

        // 2) Resolve template
        if (!template_id && !template_name) throw new Error('Please provide template_id or template_name');
        let template: any = null;
        if (template_id) {
          const { data, error } = await supabase
            .from('email_templates')
            .select('id, name, subject, content')
            .eq('id', template_id)
            .eq('user_id', userId)
            .single();
          if (error) throw error;
          template = data;
        } else if (template_name) {
          // Try exact (case-insensitive), then partial
          const { data: exact } = await supabase
            .from('email_templates')
            .select('id, name, subject, content')
            .eq('user_id', userId)
            .ilike('name', template_name)
            .maybeSingle();
          if (exact) {
            template = exact;
          } else {
            const { data, error } = await supabase
              .from('email_templates')
              .select('id, name, subject, content')
              .eq('user_id', userId)
              .ilike('name', `%${template_name}%`);
            if (error) throw error;
            if (!data || data.length === 0) throw new Error(`Template '${template_name}' not found`);
            if (data.length > 1) throw new Error(`Multiple templates matched '${template_name}'. Please specify the exact name or provide template_id.`);
            template = data[0];
          }
        }

        // 3) Personalize subject and body
        const subject = personalizeMessage(template.subject || 'Message', leadRow).trim();
        const body = personalizeMessage(template.content || '', leadRow);
        const htmlBody = body.replace(/\n/g, '<br/>');

        // 4) Choose provider and send
        const { listSenders } = require('../../tools/rexToolFunctions');
        const availableSenders = await listSenders({ userId });
        if (availableSenders.length === 0) {
          throw new Error('No email accounts configured. Please set up SendGrid, Google, or Outlook in Settings.');
        }
        let selectedSender = availableSenders[0];
        if (provider) {
          selectedSender = availableSenders.find((s: any) => s.provider === provider) || selectedSender;
        } else if (availableSenders.length > 1) {
          const senderList = availableSenders.map((s: any) => `${s.provider}: ${s.from}`).join(', ');
          throw new Error(`Multiple email accounts available (${senderList}). Please specify which provider to use: sendgrid, google, or outlook.`);
        }

        let result: any = null;
        if (selectedSender.provider === 'sendgrid') {
          const { data } = await supabase
            .from('user_sendgrid_keys')
            .select('api_key, default_sender')
            .eq('user_id', userId)
            .single();
          if (!data?.api_key || !data?.default_sender) throw new Error('SendGrid configuration incomplete');
          sgMail.setApiKey(data.api_key);
          const trackingMessageId = require('crypto').randomUUID();
          const [resp] = await sgMail.send({ 
            to: leadRow.email, 
            from: data.default_sender, 
            subject, 
            html: htmlBody,
            trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
            customArgs: { user_id: userId, message_id: trackingMessageId, lead_id: leadRow.id },
            replyTo: `msg_${trackingMessageId}.u_${userId}.c_none@${process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com'}`
          } as any);
          result = { messageId: resp.headers['x-message-id'], provider: 'sendgrid', from: data.default_sender };
        } else if (selectedSender.provider === 'google') {
          const { google } = require('googleapis');
          const { getGoogleAccessToken } = require('../../services/googleTokenHelper');
          const accessToken = await getGoogleAccessToken(userId);
          const oauth2client = new google.auth.OAuth2();
          oauth2client.setCredentials({ access_token: accessToken });
          const gmail = google.gmail({ version: 'v1', auth: oauth2client });
          const raw = Buffer.from(
            `To: ${leadRow.email}\r\n` +
            `Subject: ${subject}\r\n` +
            'Content-Type: text/html; charset=utf-8\r\n' +
            '\r\n' +
            htmlBody
          ).toString('base64url');
          const sendRes = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
          result = { messageId: sendRes.data.id, provider: 'google', from: selectedSender.from };
        } else if (selectedSender.provider === 'outlook') {
          const { getOutlookAccessToken } = require('../../services/outlookTokenHelper');
          const accessToken = await getOutlookAccessToken(userId);
          const client = require('@microsoft/microsoft-graph-client').Client.init({
            authProvider: (done: any) => done(null, accessToken)
          });
          const message = {
            message: {
              subject,
              body: { contentType: 'HTML', content: htmlBody },
              toRecipients: [{ emailAddress: { address: leadRow.email } }]
            }
          };
          await client.api('/me/sendMail').post(message);
          result = { messageId: 'outlook_sent', provider: 'outlook', from: selectedSender.from };
        } else {
          throw new Error(`Unsupported provider: ${selectedSender.provider}`);
        }

        return {
          sent: true,
          to: leadRow.email,
          lead_id: leadRow.id,
          template_id: template.id,
          provider: result.provider,
          from: result.from,
          message_id: result.messageId,
          subject
        };
      }
    },
    enrich_lead: {
      parameters: { userId:{type:'string'}, identifier:{type:'string'} },
      handler: async (rawArgs: any) => {
        const { userId } = rawArgs;
        // Accept multiple possible keys for identifier
        const identifier: string | undefined = rawArgs.identifier || rawArgs.linkedin_identifier || rawArgs.linkedin_url || rawArgs.lead_id || rawArgs.email || rawArgs.name;

        await assertPremium(userId);

        if (!identifier) throw new Error('Missing lead identifier (id, email, name or LinkedIn URL)');

        let queryText = String(identifier).trim();
        let leadData: any = null;

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(queryText);
        const isEmail = queryText.includes('@');
        const isLinkedIn = /linkedin\.com\//i.test(queryText);

        // Helper to normalize LinkedIn URLs for fuzzy matching
        const normalizeLinkedIn = (u: string) => u
          .toLowerCase()
          .replace(/\?.*$/, '')
          .replace(/\/$/, '')
          .replace(/^https?:\/\/(www\.)?/, '');

        if (isUUID) {
          const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('id', queryText)
            .maybeSingle();
          leadData = data;
        } else if (isEmail) {
          const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('user_id', userId)
            .ilike('email', queryText)
            .maybeSingle();
          leadData = data;
        } else if (isLinkedIn) {
          // Try exact and fuzzy LinkedIn URL matches
          const normalized = normalizeLinkedIn(queryText);
          let { data } = await supabase
            .from('leads')
            .select('*')
            .eq('user_id', userId)
            .eq('linkedin_url', queryText)
            .maybeSingle();
          if (!data) {
            const res2 = await supabase
              .from('leads')
              .select('*')
              .eq('user_id', userId)
              .eq('linkedin_url', `${queryText}/`)
              .maybeSingle();
            data = res2.data as any;
          }
          if (!data) {
            const res3 = await supabase
              .from('leads')
              .select('*')
              .eq('user_id', userId)
              .ilike('linkedin_url', `%${normalized}%`)
              .maybeSingle();
            data = res3.data as any;
          }
          leadData = data;
        } else {
          // Treat as a name search: split into first + last and search
          const parts = queryText.split(/\s+/).filter(Boolean);
          const first = parts[0];
          const last = parts.slice(1).join(' ');
          let q = supabase
            .from('leads')
            .select('*')
            .eq('user_id', userId)
            .ilike('first_name', `%${first}%`);
          if (last) q = q.ilike('last_name', `%${last}%`);
          const { data } = await q.limit(5);
          if (data && data.length === 1) leadData = data[0];
          if (data && data.length > 1) {
            // Prefer exact case-insensitive match
            const exact = data.find(l => l.first_name?.toLowerCase() === first.toLowerCase() && l.last_name?.toLowerCase() === last.toLowerCase());
            leadData = exact || data[0];
          }
        }

        if (!leadData) {
          throw new Error('Lead not found. Please provide a valid lead identifier or ensure the lead exists in your database.');
        }

        const finalLinkedIn = leadData.linkedin_url || (isLinkedIn ? queryText : null);
        if (!finalLinkedIn) {
          throw new Error('Lead does not have a LinkedIn URL');
        }

        const name = `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim();
        if (!name) throw new Error('Lead name is required for enrichment');

        return await enrichLeadProfile({
          userId,
          name,
          email: leadData.email,
          linkedinUrl: finalLinkedIn
        });
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
    filter_leads: {
      parameters: {
        userId: { type:'string' },
        campaignId: { type:'string', optional: true },
        filters: { 
          type:'object', 
          optional: true,
          properties: {
            title: { type:'string' },
            synonyms: { type:'boolean' },
            strict_level: { type:'boolean' },
            has_email: { type:'boolean' },
            verified_only: { type:'boolean' },
            personal_email_only: { type:'boolean' },
            limit: { type:'number' },
            count: { type:'number' }
          }
        }
      },
      handler: async ({ userId, campaignId, filters }) => {
        await assertPremium(userId);
        return await filterLeads({ userId, campaignId, filters });
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
    enrich_lead_profile: {
      parameters: { 
        userId: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string', optional: true },
        linkedinUrl: { type: 'string' }
      },
      handler: async ({ userId, name, email, linkedinUrl }) => {
        await assertPremium(userId);
        const creditInfo = await fetchCreditsTool({ userId });
        if (creditInfo.creditsRemaining <= 0) throw new Error('Insufficient credits to enrich lead.');
        return await enrichLeadProfile({ userId, name, email, linkedinUrl });
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
    move_candidate_to_stage: {
      parameters: { 
        userId:{type:'string'}, 
        candidate:{type:'string'}, 
        stage:{type:'string'}, 
        jobId:{type:'string', optional:true} 
      },
      handler: async ({ userId, candidate, stage, jobId }) => {
        await assertPremium(userId);
        return await moveCandidateToStageId({ userId, candidate, stage, jobId });
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
    // ------------- NEW ZAPIER/MAKE INTEGRATION TOOLS -------------
    test_zapier_integration: {
      parameters: { 
        userId: {type:'string'}, 
        eventType: {type:'string'}, 
        webhookUrl: {type:'string', optional: true} 
      },
      handler: async ({ userId, eventType, webhookUrl }) => {
        await assertPremium(userId);
        return await testZapierIntegration({ userId, eventType, webhookUrl });
      }
    },
    suggest_automation_workflows: {
      parameters: { 
        userId: {type:'string'}, 
        useCase: {type:'string'}, 
        tools: {type:'array', optional: true} 
      },
      handler: async ({ userId, useCase, tools }) => {
        await assertPremium(userId);
        return await suggestAutomationWorkflows({ userId, useCase, tools });
      }
    },
    setup_integration_guide: {
      parameters: { 
        userId: {type:'string'}, 
        platform: {type:'string'}, 
        eventType: {type:'string'} 
      },
      handler: async ({ userId, platform, eventType }) => {
        await assertPremium(userId);
        return await setupIntegrationGuide({ userId, platform, eventType });
      }
    },
    troubleshoot_integration: {
      parameters: { 
        userId: {type:'string'}, 
        platform: {type:'string'}, 
        issue: {type:'string'} 
      },
      handler: async ({ userId, platform, issue }) => {
        await assertPremium(userId);
        return await troubleshootIntegration({ userId, platform, issue });
      }
    },
    get_recent_automation_events: {
      parameters: { 
        userId: {type:'string'}, 
        eventType: {type:'string', optional: true}, 
        limit: {type:'number', optional: true} 
      },
      handler: async ({ userId, eventType, limit }) => {
        await assertPremium(userId);
        return await getRecentAutomationEvents({ userId, eventType, limit });
      }
    },
    get_campaign_lead_count: {
      parameters: { userId: {type:'string'}, campaignId: {type:'string'} },
      handler: async ({ userId, campaignId }) => {
        await assertPremium(userId);
        return await getCampaignLeadCount({ userId, campaignId });
      }
    },
    linkedin_connect: {
      parameters: { 
        userId: {type:'string'}, 
        linkedin_urls: {type:'array'}, 
        message: {type:'string', optional: true}, 
        scheduled_at: {type:'string', optional: true} 
      },
      handler: async ({ userId, linkedin_urls, message, scheduled_at }) => {
        await assertPremium(userId);
        return await linkedin_connect({ userId, linkedin_urls, message, scheduled_at });
      }
    }
    ,
    convert_lead_to_candidate: {
      parameters: { userId: {type:'string'}, leadId: {type:'string'} },
      handler: async ({ userId, leadId }) => {
        await assertPremium(userId);
        return await convertLeadToCandidate({ userId, leadId });
      }
    },
    // ==================== SOURCING AGENT TOOLS ====================
    sourcing_create_campaign: {
      parameters: { 
        userId: {type:'string'}, 
        title: {type:'string'}, 
        audience_tag: {type:'string', optional: true}, 
        sender_id: {type:'string', optional: true} 
      },
      handler: async ({ userId, title, audience_tag, sender_id }) => {
        await assertPremium(userId);
        return await api('/api/sourcing/campaigns', {
          method: 'POST',
          body: JSON.stringify({ title, audience_tag, sender_id, created_by: userId })
        });
      }
    },
    sourcing_save_sequence: {
      parameters: {
        userId: {type:'string'},
        campaign_id: {type:'string'}, 
        title_groups: {type:'array'}, 
        industry: {type:'string', optional: true},
        product_name: {type:'string', optional: true}, 
        spacing_business_days: {type:'number', optional: true}
      },
      handler: async ({ userId, campaign_id, title_groups, industry, product_name, spacing_business_days }) => {
        await assertPremium(userId);
        return await api(`/api/sourcing/campaigns/${campaign_id}/sequence`, {
          method: 'POST',
          body: JSON.stringify({ title_groups, industry, product_name, spacing_business_days })
        });
      }
    },
    sourcing_add_leads: {
      parameters: { 
        userId: {type:'string'}, 
        campaign_id: {type:'string'}, 
        leads: {type:'array'} 
      },
      handler: async ({ userId, campaign_id, leads }) => {
        await assertPremium(userId);
        return await api(`/api/sourcing/campaigns/${campaign_id}/leads`, {
          method: 'POST',
          body: JSON.stringify({ leads })
        });
      }
    },
    sourcing_schedule_sends: {
      parameters: { 
        userId: {type:'string'}, 
        campaign_id: {type:'string'} 
      },
      handler: async ({ userId, campaign_id }) => {
        await assertPremium(userId);
        return await api(`/api/sourcing/campaigns/${campaign_id}/schedule`, {
          method: 'POST'
        });
      }
    },
    sourcing_get_campaign: {
      parameters: { 
        userId: {type:'string'}, 
        campaign_id: {type:'string'} 
      },
      handler: async ({ userId, campaign_id }) => {
        await assertPremium(userId);
        return await api(`/api/sourcing/campaigns/${campaign_id}`, {
          method: 'GET'
        });
      }
    },
    sourcing_list_campaigns: {
      parameters: { 
        userId: {type:'string'}, 
        status: {type:'string', optional: true}, 
        search: {type:'string', optional: true},
        limit: {type:'number', optional: true}
      },
      handler: async ({ userId, status, search, limit }) => {
        await assertPremium(userId);
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (search) params.append('search', search);
        if (limit) params.append('limit', limit.toString());
        params.append('created_by', userId);
        
        const queryString = params.toString();
        const url = queryString ? `/api/sourcing/campaigns?${queryString}` : '/api/sourcing/campaigns';
        
        return await api(url, { method: 'GET' });
      }
    },
    sourcing_get_senders: {
      parameters: { userId: {type:'string'} },
      handler: async ({ userId }) => {
        await assertPremium(userId);
        return await api('/api/sourcing/senders', { method: 'GET' });
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
  if (!['RecruitPro','TeamAdmin','SuperAdmin','super_admin','admin'].includes(role)) {
    throw new Error('REX access restricted to premium plans.');
  }
}

export { server }; 