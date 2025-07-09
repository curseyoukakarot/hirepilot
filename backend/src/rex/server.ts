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
  getSchedulerStatus
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
    send_email: {
      parameters: { userId:{type:'string'}, to:{type:'string'}, subject:{type:'string'}, body:{type:'string'} },
      handler: async ({ userId, to, subject, body }) => {
        await assertPremium(userId);
        const { data } = await supabase.from('user_sendgrid_keys').select('api_key, default_sender').eq('user_id', userId).single();
        if (!data?.api_key || !data?.default_sender) throw new Error('No SendGrid config');
        sgMail.setApiKey(data.api_key);
        const [resp] = await sgMail.send({ to, from:data.default_sender, subject, html:body });
        return { messageId: resp.headers['x-message-id'] };
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

        // Prefer materialized table if exists; fall back to debug view
        let { data, error } = await supabase
          .from('campaign_metrics')
          .select('*')
          .eq('campaign_id', targetId)
          .maybeSingle();

        if (error && error.code === '42P01') {
          ({ data, error } = await supabase
            .from('vw_campaign_metrics_debug')
            .select('*')
            .eq('campaign_id', targetId)
            .maybeSingle());
        }

        if (error) throw error;
        return data;
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