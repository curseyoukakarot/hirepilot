import 'dotenv/config';
import path from 'path';
import fetch from 'node-fetch';
import { supabase } from '../lib/supabase';
import { launchQueue } from '../../api/campaigns/launch';
import sgMail from '@sendgrid/mail';
import { personalizeMessage } from '../../utils/messageUtils';
import { canonicalFlows, searchSupport, whitelistPages } from './knowledge.widget';
import { widgetTools } from './widgetTools';
import { buildLinkedinTools } from './agents-mcp/linkedin.tools';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  sourceLeads,
  filterLeads,
  enrichLead: enrichLeadTool,
  enrichLeadProfile,
  sendMessage,
  getPipelineStats,
  viewPipeline,
  moveCandidate,
  moveCandidateToStageId,
  updateCandidateNotes,
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

// API helper that impersonates a specific user via x-user-id header
async function apiAsUser(userId: string, endpoint: string, options: { method: string; body?: string } = { method: 'GET' }) {
  const baseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8080';
  const url = `${baseUrl}${endpoint}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-user-id': userId };
  if (process.env.AGENTS_API_TOKEN) headers['Authorization'] = `Bearer ${process.env.AGENTS_API_TOKEN}`;
  const response = await fetch(url, { method: options.method, headers, body: options.body });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  const contentType = response.headers.get('content-type');
  return contentType && contentType.includes('application/json') ? response.json() : response.text();
}

function parseTimeUtc(time: string) {
  if (!time || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('time_utc must be HH:MM');
  }
  const [h, m] = time.split(':').map(v => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error('time_utc out of range');
  }
  return { hour: h, minute: m };
}

function normalizeDayOfWeek(input?: string | null) {
  if (!input) return null;
  const map: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6
  };
  const key = input.toLowerCase();
  return key in map ? map[key] : null;
}

function buildCronForCadence(cadence: string, timeUtc: string, dayOfWeek?: string | null) {
  const { hour, minute } = parseTimeUtc(timeUtc);
  const dailyCron = `${minute} ${hour} * * *`;
  if (!cadence || cadence.toLowerCase() === 'daily') {
    return dailyCron;
  }
  if (cadence.toLowerCase() === 'weekly') {
    const normalized = normalizeDayOfWeek(dayOfWeek);
    if (normalized === null) throw new Error('day_of_week required for weekly cadence');
    return `${minute} ${hour} * * ${normalized}`;
  }
  throw new Error(`Unsupported cadence: ${cadence}`);
}

const linkedinTools = buildLinkedinTools(async ({ userId, action, linkedinUrl, message }) => {
  return apiAsUser(userId, '/api/linkedin/remote-action', {
    method: 'POST',
    body: JSON.stringify({
      action,
      linkedinUrl,
      message
    })
  });
});

// ---------------------------------------------------------------------------------
// Minimal REX MCP server (stdio transport)
// ---------------------------------------------------------------------------------
const server = new Server({ name: 'REX Server', version: '0.1.0' });
// Capture registered tools so HTTP rexChat can invoke them directly
const toolCapsRef: any = { tools: {} };
export { api };

// ------------------ Tool capabilities ------------------
server.registerCapabilities({
  tools: Object.assign(toolCapsRef.tools, {
    // ===== rex_widget_support toolset (safe, read-only) =====
    ...Object.fromEntries(Object.entries(widgetTools).map(([k,v]) => [k, { parameters:{}, handler: v.handler } ])),
    ...linkedinTools,
    // === Scheduler (MCP) tools ===
    scheduler_create_job: {
      parameters: { userId:{type:'string'}, name:{type:'string'}, action_type:{type:'string'}, persona_id:{type:'string', optional:true}, campaign_id:{type:'string', optional:true}, payload:{type:'object', optional:true}, schedule_kind:{type:'string'}, cron_expr:{type:'string', optional:true}, run_at:{type:'string', optional:true} },
      handler: async (args:any) => {
        const { scheduleFromPayload } = await import('../lib/scheduler');
        const job = await scheduleFromPayload(args.userId, args);
        return job;
      }
    },
    scheduler_list_jobs: {
      parameters: { userId:{type:'string'} },
      handler: async ({ userId }) => {
        const { supabaseAdmin } = await import('../lib/supabaseAdmin');
        const { data } = await supabaseAdmin.from('schedules').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        return data || [];
      }
    },
    create_persona_auto_track: {
      parameters: {
        userId: { type: 'string' },
        persona_id: { type: 'string' },
        campaign_mode: { type: 'string', enum: ['use_existing','create_new'] },
        existing_campaign_id: { type: 'string', optional: true },
        new_campaign_name: { type: 'string', optional: true },
        cadence: { type: 'string' },
        day_of_week: { type: 'string', optional: true },
        time_utc: { type: 'string' },
        leads_per_run: { type: 'number' },
        send_delay_minutes: { type: 'number' },
        daily_send_cap: { type: 'number', optional: true }
      },
      handler: async (args: any) => {
        const {
          userId,
          persona_id,
          campaign_mode,
          existing_campaign_id,
          new_campaign_name,
          cadence,
          day_of_week,
          time_utc,
          leads_per_run,
          send_delay_minutes,
          daily_send_cap
        } = args;
        if (!userId) throw new Error('userId required');
        if (!persona_id) throw new Error('persona_id required');

        const persona = await apiAsUser(userId, `/api/personas/${persona_id}`);

        if (campaign_mode === 'use_existing' && !existing_campaign_id) {
          throw new Error('existing_campaign_id required for use_existing mode');
        }
        let campaignId = existing_campaign_id || null;
        if (campaign_mode === 'create_new') {
          const desiredName = new_campaign_name && String(new_campaign_name).trim().length
            ? String(new_campaign_name).trim()
            : `${persona.name || 'Persona'} – Evergreen`;
          const created = await apiAsUser(userId, '/api/schedules/campaign-from-persona', {
            method: 'POST',
            body: JSON.stringify({ persona_id, name: desiredName })
          });
          campaignId = created?.id || null;
        }
        if (!campaignId) throw new Error('campaign_id required');

        const cronExpr = buildCronForCadence(cadence, time_utc, day_of_week);
        const leadsPerRun = Math.max(1, Math.min(Number(leads_per_run || 50), 500));
        const sendDelay = Math.max(0, Number(send_delay_minutes || 0));
        const dailyCap = daily_send_cap ? Math.max(1, Number(daily_send_cap)) : null;

        const scheduleBody = {
          name: `Auto Track – ${persona.name || 'Persona'}`,
          action_type: 'persona_with_auto_outreach',
          persona_id,
          linked_persona_id: persona_id,
          campaign_id: campaignId,
          linked_campaign_id: campaignId,
          auto_outreach_enabled: true,
          leads_per_run: leadsPerRun,
          send_delay_minutes: sendDelay,
          daily_send_cap: dailyCap,
          schedule_kind: 'recurring',
          cron_expr: cronExpr,
          payload: {
            action_tool: 'sourcing.run_persona',
            tool_payload: {
              persona_id,
              campaign_id: campaignId,
              auto_outreach_enabled: true,
              leads_per_run: leadsPerRun,
              send_delay_minutes: sendDelay,
              daily_send_cap: dailyCap
            }
          }
        };

        const schedule = await apiAsUser(userId, '/api/schedules', {
          method: 'POST',
          body: JSON.stringify(scheduleBody)
        });
        return {
          schedule,
          campaign_id: campaignId,
          persona_id,
          cron_expr: cronExpr,
          campaign_mode
        };
      }
    },
    sourcing_run_persona: {
      parameters: { userId:{type:'string'}, persona_id:{type:'string'}, batch_size:{type:'number', optional:true}, campaign_id:{type:'string', optional:true}, auto_send:{type:'boolean', optional:true}, credit_mode:{type:'string', optional:true} },
      handler: async (args:any) => {
        const { sourcingRunPersonaTool } = await import('../mcp/sourcing.run_persona');
        return JSON.parse((await sourcingRunPersonaTool.handler(args)).content[0].text);
      }
    },
    add_numbers: {
      parameters: { a: { type: 'number' }, b: { type: 'number' } },
      handler: async ({ a, b }: { a: number; b: number }) => a + b
    },
    // Auto: send by template if found, otherwise use provided draft
    send_campaign_email_auto: {
      parameters: {
        userId: { type: 'string' },
        campaign_id: { type: 'string' },
        template_name: { type: 'string', optional: true },
        subject: { type: 'string', optional: true },
        html: { type: 'string', optional: true },
        scheduled_for: { type: 'string', optional: true },
        channel: { type: 'string', optional: true }
      },
      handler: async ({ userId, campaign_id, template_name, subject, html, scheduled_for, channel }) => {
        const hasDraft = Boolean(subject && html);
        let tpl: any = null;
        if (template_name) {
          const { data } = await supabase
            .from('email_templates')
            .select('id,name,subject,content')
            .eq('user_id', userId)
            .ilike('name', template_name)
            .maybeSingle();
          tpl = data || null;
        }

        if (!tpl && !hasDraft) {
          throw new Error("Please provide either a 'template_name' or both 'subject' and 'html' for a draft.");
        }

        if (tpl) {
          // Use the existing template bulk sender
          const when = scheduled_for ? new Date(scheduled_for) : new Date();
          const { data: leads, error } = await supabase
            .from('leads')
            .select('id,email,first_name,last_name,company')
            .eq('campaign_id', campaign_id)
            .not('email', 'is', null)
            .neq('email', '')
            .limit(1000);
          if (error) throw new Error(error.message);
          const list = leads || [];
          if (list.length === 0) throw new Error('No leads with emails in this campaign');

          const { deductCredits } = await import('../services/creditService');
          const totalCreditsNeeded = list.length;
          const current = await deductCredits(userId, 0, true);
          if (Number(current || 0) < totalCreditsNeeded) throw new Error(`Insufficient credits. Need ${totalCreditsNeeded}.`);

          for (const L of list) {
            const subj = personalizeMessage(tpl.subject || 'Message', L);
            const htmlBody = personalizeMessage(tpl.content || '', L).replace(/\n/g, '<br/>');
            await supabase.from('scheduled_messages').insert({
              user_id: userId,
              lead_id: L.id,
              content: htmlBody,
              template_id: null,
              channel: (channel as any) || 'sendgrid',
              scheduled_for: when.toISOString(),
              status: 'scheduled'
            });
          }
          await (await import('../services/creditService')).deductCredits(userId, list.length);
          return { queued: list.length, mode: 'template', template_name: template_name, scheduled_for: when.toISOString() };
        }

        // Fallback: send the provided draft to the entire campaign
        const { sendSingleMessageToCampaign } = await import('../services/messagingCampaign');
        const result = await sendSingleMessageToCampaign({ campaignId: campaign_id, userId, subject: subject || 'Message', html: html || '' });
        return { queued: result.scheduled, mode: 'draft' };
      }
    },
    set_preferred_email_provider: {
      parameters: { userId:{type:'string'}, provider:{ type:'string' } },
      handler: async ({ userId, provider }) => {
        const allowed = ['sendgrid','google','outlook'];
        if (!allowed.includes(String(provider))) throw new Error('Invalid provider');
        await supabase
          .from('user_settings')
          .upsert({ user_id: userId, preferred_email_provider: provider }, { onConflict: 'user_id' });
        return { ok: true, provider };
      }
    },
    send_email_to_lead: {
      parameters: {
        userId: { type:'string' },
        lead_id: { type:'string' },
        subject: { type:'string', optional: true },
        html: { type:'string', optional: true },
        provider: { type:'string', optional: true }
      },
      handler: async ({ userId, lead_id, subject, html, provider }) => {
        // Load lead
        const { data: leadRow, error } = await supabase
          .from('leads')
          .select('id,email,campaign_id')
          .eq('id', lead_id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!leadRow || !leadRow.email) throw new Error('Lead not found or missing email');

        // Resolve provider preference if not explicitly given
        let preferred: any = provider || null;
        if (!preferred) {
          try {
            const { data: pref } = await supabase
              .from('user_settings')
              .select('preferred_email_provider')
              .eq('user_id', userId)
              .maybeSingle();
            if (pref?.preferred_email_provider) preferred = pref.preferred_email_provider;
          } catch {}
        }
        if (!preferred) {
          // Auto-detect availability: SendGrid → Google → Outlook
          const { data: sg } = await supabase
            .from('user_sendgrid_keys')
            .select('api_key')
            .eq('user_id', userId)
            .maybeSingle();
          if (sg?.api_key) preferred = 'sendgrid';
        }
        if (!preferred) {
          const { data: g } = await supabase
            .from('integrations')
            .select('status')
            .eq('user_id', userId)
            .eq('provider', 'google')
            .maybeSingle();
          if (g && ['on','enabled','connected','true'].includes(String(g.status).toLowerCase())) preferred = 'google';
        }
        if (!preferred) {
          const { data: o } = await supabase
            .from('integrations')
            .select('status')
            .eq('user_id', userId)
            .eq('provider', 'outlook')
            .maybeSingle();
          if (o && ['on','enabled','connected','true'].includes(String(o.status).toLowerCase())) preferred = 'outlook';
        }
        if (!preferred) return { ok:false, error:'NO_EMAIL_PROVIDER' };

        const { sendViaProvider } = await import('../../services/providerEmail');
        const ok = await sendViaProvider(preferred, { id: leadRow.id, email: leadRow.email, campaign_id: leadRow.campaign_id }, html || '', userId, subject || 'Message');
        return ok ? { ok: true, used: preferred, lead_email: leadRow.email } : { ok:false, error:'send_failed' };
      }
    },
    // Convenience: queue collection from a LinkedIn post and return queued status immediately
    sniper_collect_post: {
      parameters: {
        userId: { type: 'string' },
        post_url: { type: 'string' },
        limit: { type: 'number', optional: true }
      },
      handler: async ({ userId, post_url, limit }) => {
        await assertPremium(userId);
        if (!/^https?:\/\//i.test(String(post_url))) throw new Error('post_url must be a valid URL');

        // 1) Create a Sniper target for this post
        const target = await apiAsUser(userId, `/api/sniper/targets`, {
          method: 'POST',
          body: JSON.stringify({ type: 'own', post_url })
        });
        try {
          // Best-effort queued notification
          const { notifySniperQueued } = await import('../services/sniper');
          await notifySniperQueued(userId, target.id, target.campaign_id, post_url);
        } catch {}

        // NOTE: Route /api/sniper/targets already enqueues a capture job via BullMQ.
        // Do NOT await scraping here to avoid Railway edge timeouts.
        const campaignId = (target as any).campaign_id || null;
        const estSeconds = 60; // lightweight default; real ETA determined by worker
        const out: any = { status: 'queued', target_id: target.id, campaign_id: campaignId, eta_seconds: estSeconds };

        // Optionally return any already-existing leads if caller provided limit and there are cached rows
        if (campaignId && Number(limit || 0) > 0) {
          const max = Math.max(1, Math.min(Number(limit || 0), 50));
          if (max > 0) {
            const { data } = await supabase
              .from('sourcing_leads')
              .select('id, name, title, company, email, linkedin_url, enriched, created_at')
              .eq('campaign_id', campaignId)
              .order('created_at', { ascending: false })
              .limit(max);
            out.leads = data || [];
            out.count = (data || []).length;
          }
        }
        return out;
      }
    },
    // Poll latest leads for a sniper target or campaign (paginated)
    sniper_poll_leads: {
      parameters: {
        userId: { type: 'string' },
        target_id: { type: 'string', optional: true },
        campaign_id: { type: 'string', optional: true },
        limit: { type: 'number', optional: true },
        cursor: { type: 'string', optional: true } // ISO created_at; return rows created_before cursor
      },
      handler: async ({ userId, target_id, campaign_id, limit, cursor }) => {
        await assertPremium(userId);
        let campaignId = campaign_id as string | null;
        if (!campaignId && target_id) {
          const { data: targetRow, error: tErr } = await supabase
            .from('sniper_targets')
            .select('id,campaign_id')
            .eq('id', target_id)
            .maybeSingle();
          if (tErr) throw new Error(`Failed to load target ${target_id}: ${tErr.message}`);
          campaignId = (targetRow as any)?.campaign_id || null;
        }
        if (!campaignId) return { campaign_id: null, leads: [], next_cursor: null, status: 'pending' };

        const max = Math.max(1, Math.min(Number(limit || 50), 200));
        let q = supabase
          .from('sourcing_leads')
          .select('id, name, title, company, email, linkedin_url, enriched, created_at')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(max);
        if (cursor) q = q.lt('created_at', cursor);
        const { data: leads, error } = await q;
        if (error) throw new Error(`Failed to fetch leads for campaign ${campaignId}: ${error.message}`);
        const nextCursor = (leads && leads.length > 0) ? leads[leads.length - 1].created_at : null;
        // Also report latest run status if available
        let runInfo: any = null;
        try {
          const { data: runRow } = await supabase
            .from('sniper_runs')
            .select('success_count,error_count,created_at')
            .eq('target_id', target_id || '')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          runInfo = runRow || null;
        } catch {}
        // Derive coarse status
        const status = (runInfo?.error_count || 0) > 0 ? 'error' : ((leads||[]).length > 0 ? 'done' : 'pending');
        return { campaign_id: campaignId, count: (leads || []).length, leads: leads || [], next_cursor: nextCursor, status, run: runInfo };
      }
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
        // Temporarily allow all plans
        return await getEmailStatus({ emailId });
      }
    },
    // === Sequence enrollment by sequence name (natural language) ===
    enroll_campaign_in_sequence_by_name: {
      parameters: {
        userId: { type: 'string' },
        campaign_id: { type: 'string' },
        sequence_name: { type: 'string' },
        start_time_local: { type: 'string', optional: true },
        timezone: { type: 'string', optional: true },
        provider: { type: 'string', optional: true }
      },
      handler: async ({ userId, campaign_id, sequence_name, start_time_local, timezone, provider }) => {
        // 1) Resolve sequence by name (case-insensitive)
        const { data: seq } = await supabase
          .from('message_sequences')
          .select('id, name')
          .eq('owner_user_id', userId)
          .ilike('name', sequence_name)
          .maybeSingle();
        if (!seq) throw new Error(`Sequence '${sequence_name}' not found`);

        // 2) Gather lead ids from campaign (only with emails)
        const { data: leads, error } = await supabase
          .from('leads')
          .select('id, email')
          .eq('campaign_id', campaign_id)
          .not('email', 'is', null)
          .neq('email', '')
          .limit(5000);
        if (error) throw new Error(error.message);
        const leadIds = (leads || []).map((l:any)=> l.id);
        if (leadIds.length === 0) throw new Error('No leads with email in this campaign');

        // 3) Enroll via HTTP API (leverages existing scheduling logic and business-day handling)
        const body = {
          leadIds,
          startTimeLocal: start_time_local || new Date().toISOString(),
          timezone: timezone || 'America/Chicago',
          ...(provider ? { provider } : {})
        };
        const resp = await api(`/api/sequences/${seq.id}/enroll`, { method: 'POST', body: JSON.stringify(body) });
        return { sequence_id: seq.id, enrolled: resp.enrolled, skipped: resp.skipped, first_send_at: resp.first_send_at };
      }
    },
    // === Campaign bulk email helpers ===
    preview_campaign_email: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'} },
      handler: async ({ userId, campaign_id, template_name }) => {
        const { data: tpl } = await supabase
          .from('email_templates')
          .select('id,name,subject,content')
          .eq('user_id', userId)
          .ilike('name', template_name)
          .maybeSingle();
        if (!tpl) throw new Error(`Template '${template_name}' not found`);
        // Use first lead in campaign to personalize preview
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('campaign_id', campaign_id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        const subject = personalizeMessage(tpl.subject || '', lead || {});
        const body = personalizeMessage(tpl.content || '', lead || {});
        return { subject, body_preview: body };
      }
    },
    send_campaign_email_by_template_name: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'}, scheduled_for:{type:'string', optional:true}, channel:{type:'string', optional:true} },
      handler: async ({ userId, campaign_id, template_name, scheduled_for, channel }) => {
        // Resolve template
        const { data: tpl } = await supabase
          .from('email_templates')
          .select('id,name,subject,content')
          .eq('user_id', userId)
          .ilike('name', template_name)
          .maybeSingle();
        if (!tpl) throw new Error(`Template '${template_name}' not found`);

        // Select leads for the campaign
        const { data: leads, error } = await supabase
          .from('leads')
          .select('id,email,first_name,last_name,company')
          .eq('campaign_id', campaign_id)
          .not('email', 'is', null)
          .neq('email', '')
          .limit(1000);
        if (error) throw new Error(error.message);
        const list = leads || [];
        if (list.length === 0) throw new Error('No leads with emails in this campaign');

        // Credit check: 1 credit per email
        const totalCreditsNeeded = list.length;
        const { deductCredits } = await import('../services/creditService');
        const current = await deductCredits(userId, 0, true);
        if (Number(current || 0) < totalCreditsNeeded) throw new Error(`Insufficient credits. Need ${totalCreditsNeeded}.`);

        // Queue messages via existing scheduler flow
        const { messageScheduler } = await import('../../workers/messageScheduler');
        const when = scheduled_for ? new Date(scheduled_for) : new Date();
        for (const L of list) {
          const subject = personalizeMessage(tpl.subject || 'Message', L);
          const html = personalizeMessage(tpl.content || '', L).replace(/\n/g, '<br/>');
          await supabase
            .from('scheduled_messages')
            .insert({
              user_id: userId,
              lead_id: L.id,
              content: html,
              template_id: null,
              channel: (channel as any) || 'sendgrid',
              scheduled_for: when.toISOString(),
              status: 'scheduled'
            });
        }

        await deductCredits(userId, totalCreditsNeeded);
        return { queued: list.length, scheduled_for: when.toISOString() };
      }
    },
    // Send a drafted message to all leads in a campaign (no template required)
    send_campaign_email_draft: {
      parameters: { userId:{ type:'string' }, campaign_id:{ type:'string' }, subject:{ type:'string' }, html:{ type:'string' }, scheduled_for:{ type:'string', optional:true }, channel:{ type:'string', optional:true } },
      handler: async ({ userId, campaign_id, subject, html, scheduled_for, channel }) => {
        // Get leads (emails only)
        const { data: leads, error } = await supabase
          .from('leads')
          .select('id,email,first_name,last_name,company')
          .eq('campaign_id', campaign_id)
          .not('email', 'is', null)
          .neq('email', '')
          .limit(1000);
        if (error) throw new Error(error.message);
        const list = leads || [];
        if (list.length === 0) throw new Error('No leads with emails in this campaign');

        // Credits: 1 per email
        const totalCreditsNeeded = list.length;
        const { deductCredits } = await import('../services/creditService');
        const current = await deductCredits(userId, 0, true);
        if (Number(current || 0) < totalCreditsNeeded) throw new Error(`Insufficient credits. Need ${totalCreditsNeeded}.`);

        const when = scheduled_for ? new Date(scheduled_for) : new Date();

        // Use existing single-message scheduling logic that handles personalization
        const { sendSingleMessageToCampaign } = await import('../services/messagingCampaign');
        const result = await sendSingleMessageToCampaign({ campaignId: campaign_id, userId, subject, html });

        // Deduct credits equal to scheduled count
        await deductCredits(userId, result.scheduled);
        return { queued: result.scheduled, scheduled_for: when.toISOString(), channel: channel || 'sendgrid' };
      }
    },
    create_sequence_from_template_and_enroll: {
      parameters: {
        userId: { type:'string' },
        campaign_id: { type:'string' },
        template_name: { type:'string' },
        delays_business_days: { type:'array' },
        timezone: { type:'string', optional:true },
        start_time_local: { type:'string', optional:true },
        provider: { type:'string', optional:true }
      },
      handler: async ({ userId, campaign_id, template_name, delays_business_days, timezone, start_time_local, provider }) => {
        if (!Array.isArray(delays_business_days) || delays_business_days.length === 0) {
          throw new Error('delays_business_days must be a non-empty array like [0,2,4]');
        }
        // 1) Resolve template
        const { data: tpl } = await supabase
          .from('email_templates')
          .select('id,name,subject,content')
          .eq('user_id', userId)
          .ilike('name', template_name)
          .maybeSingle();
        if (!tpl) throw new Error(`Template '${template_name}' not found`);

        // 2) Create sequence
        const seqName = `REX • ${tpl.name} • ${new Date().toISOString().slice(0,10)}`;
        const { data: seq, error: seqErr } = await supabase
          .from('message_sequences')
          .insert({ name: seqName, description: `Auto-created from template '${tpl.name}'`, owner_user_id: userId, stop_on_reply: true })
          .select('id')
          .single();
        if (seqErr) throw new Error(seqErr.message);

        // 3) Create steps based on delays
        const stepsRows = delays_business_days.map((d: number, idx: number) => ({
          sequence_id: seq.id,
          step_order: idx + 1,
          subject: idx === 0 ? (tpl.subject || 'Message') : (tpl.subject || 'Message'),
          body: tpl.content || '',
          delay_days: Number(d) || 0,
          delay_hours: 0,
          send_only_business_days: true
        }));
        const { error: stepsErr } = await supabase
          .from('message_sequence_steps')
          .insert(stepsRows);
        if (stepsErr) throw new Error(stepsErr.message);

        // 4) Fetch campaign leads (emails only)
        const { data: leads, error: leadsErr } = await supabase
          .from('leads')
          .select('id,email')
          .eq('campaign_id', campaign_id)
          .not('email', 'is', null)
          .neq('email', '')
          .limit(5000);
        if (leadsErr) throw new Error(leadsErr.message);
        const leadIds = (leads || []).map((l:any)=> l.id);
        if (leadIds.length === 0) throw new Error('No leads with email in this campaign');

        // 5) Enroll
        const body = {
          leadIds,
          startTimeLocal: start_time_local || new Date().toISOString(),
          timezone: timezone || 'America/Chicago',
          ...(provider ? { provider } : {})
        };
        const resp = await api(`/api/sequences/${seq.id}/enroll`, { method: 'POST', body: JSON.stringify(body) });
        return { sequence_id: seq.id, enrolled: resp.enrolled, skipped: resp.skipped, first_send_at: resp.first_send_at };
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
        // Temporarily allow all plans
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
        // Temporarily allow all plans
        // If user intends to search their own enriched database, apply organization filters
        // Supported extra filters:
        //  - min_revenue: number/string (compared to organization.estimated_annual_revenue)
        //  - funding_stage: string (equals organization.latest_funding_stage when present)
        //  - tech_stack: string[] or string (includes organization.technology_names.name)
        //  - industry: string (matches organization.industry or keywords)
        //  - requires_enhanced: boolean (skip leads where has_enhanced_enrichment === false)
        const result = await filterLeads({ userId, campaignId, filters });
        const out = { ...result } as any;
        if (out?.leads && Array.isArray(out.leads)) {
          // Light post-filtering where JSON selectors are not already supported in SQL path
          out.leads = out.leads.filter((l: any) => {
            // Fetch full row only if necessary is deferred to the tool itself; here we best-effort rely on shaped data
            // Skip gate if requires_enhanced
            if (filters?.requires_enhanced && (l.has_enhanced_enrichment === false)) return false;
            return true;
          });
          out.count = out.leads.length;
        }
        return out;
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
        return await getPipelineStats({ campaignId, stage });
      }
    },
    view_pipeline: {
      parameters: { 
        userId:{type:'string'}, 
        jobId:{type:'string'}, 
        stage:{type:'string', optional:true}, 
        staleDays:{type:'number', optional:true}, 
        candidateName:{type:'string', optional:true} 
      },
      handler: async ({ userId, jobId, stage, staleDays, candidateName }) => {
        return await viewPipeline({ jobId, stage, staleDays, candidateName });
      }
    },
    move_candidate: {
      parameters: { userId:{type:'string'}, candidateId:{type:'string'}, newStage:{type:'string'} },
      handler: async ({ userId, candidateId, newStage }) => {
        return await moveCandidate({ userId, candidateId, newStage });
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
        return await moveCandidateToStageId({ userId, candidate, stage, jobId });
      }
    },
    update_candidate_notes: {
      parameters: { 
        userId:{type:'string'}, 
        candidateId:{type:'string'}, 
        note:{type:'string'}, 
        author:{type:'string'} 
      },
      handler: async ({ userId, candidateId, note, author }) => {
        return await updateCandidateNotes({ candidateId, note, author });
      }
    },
    // ===== Zapier parity tools =====
    move_opportunity_stage: {
      parameters: {
        userId: { type:'string' },
        opportunityId: { type:'string' },
        stageId: { type:'string' }
      },
      handler: async ({ userId, opportunityId, stageId }) => {
        // Restrict to owner updates to avoid cross-tenant writes
        const { error } = await supabase
          .from('opportunities')
          .update({ stage: stageId, updated_at: new Date().toISOString() })
          .eq('id', opportunityId)
          .eq('owner_id', userId);
        if (error) throw new Error(error.message);
        return { ok: true };
      }
    },
    update_deal: {
      parameters: {
        userId: { type:'string' },
        dealId: { type:'string' },
        patch: { type:'object' }
      },
      handler: async ({ userId, dealId, patch }) => {
        // Allow only a safe subset of columns to be updated
        const allowed = ['title','value','billing_type','status','stage','client_id'];
        const safePatch: Record<string, any> = {};
        Object.keys(patch || {}).forEach(k => { if (allowed.includes(k)) safePatch[k] = patch[k]; });
        safePatch.updated_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('opportunities')
          .update(safePatch)
          .eq('id', dealId)
          .eq('owner_id', userId)
          .select('id')
          .maybeSingle();
        if (error) throw new Error(error.message);
        return { ok: true, id: data?.id };
      }
    },
    add_or_update_note: {
      parameters: {
        userId: { type:'string' },
        entityType: { type:'string' }, // 'lead' | 'candidate' | 'decision_maker' | 'opportunity'
        entityId: { type:'string' },
        noteId: { type:'string', optional: true },
        body: { type:'string' },
        title: { type:'string', optional: true }
      },
      handler: async ({ userId, entityType, entityId, noteId, body, title }) => {
        const tableMap: Record<string, { table: string; col: string }> = {
          lead: { table: 'lead_notes', col: 'lead_id' },
          candidate: { table: 'candidate_notes', col: 'candidate_id' },
          decision_maker: { table: 'contact_notes', col: 'contact_id' },
          opportunity: { table: 'opportunity_notes', col: 'opportunity_id' }
        };
        const map = tableMap[String(entityType)];
        if (!map) throw new Error('unsupported_entity');
        if (noteId) {
          const { data, error } = await supabase
            .from(map.table)
            .update({ note_text: body, title: title || null, updated_at: new Date().toISOString() })
            .eq('id', noteId)
            .select('id')
            .maybeSingle();
          if (error) throw new Error(error.message);
          return { ok: true, id: data?.id, updated: true };
        } else {
          const insertRow: any = { [map.col]: entityId, note_text: body };
          if (title) insertRow.title = title;
          const { data, error } = await supabase
            .from(map.table)
            .insert(insertRow)
            .select('id')
            .maybeSingle();
          if (error) throw new Error(error.message);
          return { ok: true, id: data?.id, created: true };
        }
      }
    },
    send_invoice: {
      parameters: {
        userId: { type:'string' },
        clientId: { type:'string' },
        amount: { type:'number' },
        currency: { type:'string', optional: true },
        memo: { type:'string', optional: true }
      },
      handler: async ({ userId, clientId, amount, currency, memo }) => {
        // Minimal insert; Stripe flow handled elsewhere
        const { data, error } = await supabase
          .from('invoices')
          .insert({ client_id: clientId, amount, status: 'unbilled', notes: memo || null, created_at: new Date().toISOString() })
          .select('id')
          .maybeSingle();
        if (error) throw new Error(error.message);
        return { ok: true, invoiceId: data?.id };
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
    // Control campaigns from REX
    sourcing_pause_campaign: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'} },
      handler: async ({ userId, campaign_id }) => {
        await api(`/api/sourcing/campaigns/${campaign_id}/pause`, { method:'POST' });
        return { ok:true };
      }
    },
    sourcing_resume_campaign: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'} },
      handler: async ({ userId, campaign_id }) => {
        await api(`/api/sourcing/campaigns/${campaign_id}/resume`, { method:'POST' });
        return { ok:true };
      }
    },
    sourcing_cancel_campaign: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'} },
      handler: async ({ userId, campaign_id }) => {
        await api(`/api/sourcing/campaigns/${campaign_id}/cancel`, { method:'POST' });
        return { ok:true };
      }
    },
    sourcing_get_senders: {
      parameters: { userId: {type:'string'} },
      handler: async ({ userId }) => {
        await assertPremium(userId);
        return await api('/api/sourcing/senders', { method: 'GET' });
      }
    },
    // ==================== SNIPER TOOLS ====================
    sniper_add_target: {
      parameters: {
        userId: { type:'string' },
        type: { type:'string' },
        post_url: { type:'string', optional: true },
        keyword_match: { type:'string', optional: true },
        daily_cap: { type:'number', optional: true }
      },
      handler: async ({ userId, type, post_url, keyword_match, daily_cap }) => {
        await assertPremium(userId);
        return await apiAsUser(userId, `/api/sniper/targets`, {
          method: 'POST',
          body: JSON.stringify({ type, post_url, keyword_match, daily_cap })
        });
      }
    },
    sniper_pause: {
      parameters: { userId: { type:'string' }, id: { type:'string' } },
      handler: async ({ userId, id }) => {
        await assertPremium(userId);
        return await apiAsUser(userId, `/api/sniper/targets/${id}/pause`, { method: 'POST' });
      }
    },
    sniper_resume: {
      parameters: { userId: { type:'string' }, id: { type:'string' } },
      handler: async ({ userId, id }) => {
        await assertPremium(userId);
        return await apiAsUser(userId, `/api/sniper/targets/${id}/resume`, { method: 'POST' });
      }
    },
    sniper_capture_now: {
      parameters: { userId: { type:'string' }, id: { type:'string' } },
      handler: async ({ userId, id }) => {
        await assertPremium(userId);
        return await apiAsUser(userId, `/api/sniper/targets/${id}/capture-now`, { method: 'POST' });
      }
    },
    sniper_set_opener: {
      parameters: {
        userId: { type:'string' },
        id: { type:'string' },
        send_opener: { type:'boolean' },
        opener_subject: { type:'string', optional: true },
        opener_body: { type:'string', optional: true }
      },
      handler: async ({ userId, id, send_opener, opener_subject, opener_body }) => {
        await assertPremium(userId);
        return await apiAsUser(userId, `/api/sniper/targets/${id}/opener`, {
          method: 'POST',
          body: JSON.stringify({ send_opener, opener_subject, opener_body })
        });
      }
    },
    sniper_set_opener_cap: {
      parameters: { userId: { type:'string' }, id: { type:'string' }, daily_cap: { type:'number' } },
      handler: async ({ userId, id, daily_cap }) => {
        await assertPremium(userId);
        return await apiAsUser(userId, `/api/sniper/targets/${id}/opener-cap`, {
          method: 'POST',
          body: JSON.stringify({ daily_cap })
        });
      }
    },
    rex_widget_support_get_pricing_overview: {
      parameters: {},
      handler: async () => {
        // Prefer system_settings; if missing, DO NOT invent pricing. Return link only.
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key','pricing_tiers')
          .maybeSingle();
        const tiers = (data?.value as any) || [];
        return { tiers, pricing_url: 'https://thehirepilot.com/pricing' };
      }
    },
    rex_widget_support_get_feature_overview: {
      parameters: {},
      handler: async () => {
        return { features: [
          { name:'Campaigns', description:'Outreach with follow-ups', link:'https://thehirepilot.com/' },
          { name:'Integrations', description:'SendGrid/Google/Outlook', link:'https://thehirepilot.com/' }
        ] };
      }
    },
    rex_widget_support_get_flow_steps: {
      parameters: { flow: { type:'string' } },
      handler: async ({ flow }: { flow: keyof typeof canonicalFlows }) => {
        const item = canonicalFlows[flow];
        if (!item) throw new Error('flow not found');
        return item;
      }
    },
    rex_widget_support_get_support_article: {
      parameters: { slug: { type:'string' } },
      handler: async ({ slug }: { slug: string }) => {
        const p = whitelistPages.find(p => p.slug === slug);
        if (!p) throw new Error('slug not found');
        return { title: p.title, excerpt: p.excerpt, url: p.url };
      }
    },
    rex_widget_support_search_support: {
      parameters: { q:{type:'string'}, top_k:{type:'number', optional:true} },
      handler: async ({ q, top_k }: { q:string; top_k?:number }) => ({ results: searchSupport(q, top_k || 5) })
    },
    rex_widget_support_get_account_readiness: {
      parameters: { user_id:{ type:'string', optional:true } },
      handler: async ({ user_id }: { user_id?:string }) => {
        // simple read-only flags; real impl can query aggregates
        if (!user_id) return { onboarding_complete:false, email_connected:false, has_campaigns:false };
        const { data: integ } = await supabase.from('integrations').select('provider,status').eq('user_id', user_id);
        const email_connected = Boolean((integ||[]).find(r => ['sendgrid','google','outlook'].includes(String(r.provider))));
        const { count } = await supabase.from('sourcing_campaigns').select('*', { count:'exact', head:true }).eq('created_by', user_id);
        return { onboarding_complete: email_connected && (count||0) > 0, email_connected, has_campaigns: (count||0) > 0 };
      }
    },
    rex_widget_support_create_lead: {
      parameters: { full_name:{type:'string'}, work_email:{type:'string'}, company:{type:'string', optional:true}, interest:{type:'string', optional:true}, notes:{type:'string', optional:true}, rb2b:{type:'object', optional:true} },
      handler: async (payload: any) => {
        const resp = await api('/api/rex_widget/leads', { method:'POST', body: JSON.stringify(payload) });
        return { id: resp.id, routed: { slack: true } };
      }
    },
    rex_widget_support_handoff_to_human: {
      parameters: { thread_id:{type:'string'}, reason:{type:'string', optional:true} },
      handler: async ({ thread_id, reason }: { thread_id:string; reason?:string }) => {
        await api('/api/rex_widget/handoff', { method:'POST', body: JSON.stringify({ threadId: thread_id, reason }) });
        return { ok:true };
      }
    },
    // --- Sales Agent: generate a preview reply from current policy (no thread required) ---
    sales_preview_reply: {
      parameters: { 
        userId: { type:'string', optional: true },
        policy: { type:'object', optional: true },
        instructions: { type:'string', optional: true },
        previous_text: { type:'string', optional: true }
      },
      // Heuristic generator; avoids model dependency for low-latency preview
      handler: async ({ policy, instructions, previous_text }: any) => {
        const safe = policy || {};
        const assets = safe.assets || {};
        const scheduling = safe.scheduling || {};
        const event = scheduling.event_type ? `https://calendly.com/${scheduling.event_type}` : null;
        const greetings = [
          'Hey {{firstName}} — appreciate the reply!',
          'Hi {{firstName}}, thanks for getting back to me.',
          'Hey {{firstName}}, great to hear from you.',
          'Hi {{firstName}} — really appreciate the quick response.'
        ];
        // Pick a different greeting than previous_text if possible
        let greeting = greetings[0];
        for (const g of greetings) {
          if (!previous_text || !String(previous_text).startsWith(g)) { greeting = g; break; }
        }
        const lines: string[] = [];
        lines.push(greeting);
        if (assets.demo_video_url) lines.push(`Here’s a quick demo: ${assets.demo_video_url}`);
        if (assets.pricing_url) lines.push(`Pricing details: ${assets.pricing_url}`);
        if (assets.one_pager_url) lines.push(`One-pager: ${assets.one_pager_url}`);
        if (assets.deck_url) lines.push(`Deck: ${assets.deck_url}`);
        if (event) {
          lines.push(`Grab a time here: ${event}`);
        } else {
          lines.push('If helpful, I can share a quick link to book a time.');
        }
        lines.push('— {{yourName}}');
        let text = lines.filter(Boolean).join('\n\n');
        // Lightweight instruction transforms
        const ix = String(instructions || '').toLowerCase();
        if (ix.includes('short')) {
          const shortLines = [greeting, event ? `Grab a time here: ${event}` : 'Happy to share a quick scheduling link.','— {{yourName}}'];
          text = shortLines.join('\n\n');
        } else if (ix.includes('bullet')) {
          const main: string[] = [];
          if (assets.demo_video_url) main.push(`• Demo: ${assets.demo_video_url}`);
          if (assets.pricing_url) main.push(`• Pricing: ${assets.pricing_url}`);
          if (assets.one_pager_url) main.push(`• One-pager: ${assets.one_pager_url}`);
          if (assets.deck_url) main.push(`• Deck: ${assets.deck_url}`);
          if (event) main.push(`• Book: ${event}`);
          text = [greeting, ...main, '— {{yourName}}'].join('\n');
        } else if (ix.includes('warmer') || ix.includes('friend') || ix.includes('casual')) {
          text = text.replace('appreciate the reply','really appreciate you responding').replace('Grab a time here','Would you like to grab a quick time here');
        }
        // Minor rewrite if previous_text provided (avoid exact duplicate)
        if (previous_text && text.trim() === String(previous_text).trim()) {
          text = text.replace('Grab a time here', 'Here’s my calendar');
          if (!ix) text += '\n\nP.S. I can tailor a quick walkthrough to your use case.';
        }
        return { text };
      }
    },
    rex_widget_support_get_ctas: {
      parameters: {},
      handler: async () => {
        const { data } = await supabase
          .from('system_settings')
          .select('key,value')
          .in('key',['rex_demo_url','rex_calendly_url']);
        const out:any = {};
        (data || []).forEach((r:any)=>{ out[r.key === 'rex_demo_url' ? 'demo_url' : 'calendly_url'] = r.value; });
        return out;
      }
    },
    slack_setup_guide: {
      parameters: { userId: { type:'string' } },
      handler: async ({ userId }) => {
        // Provide workspace-specific URLs derived from backend env
        const base = process.env.BACKEND_URL || process.env.BACKEND_PUBLIC_URL || 'https://api.thehirepilot.com';
        const urls = {
          commands: `${base}/api/slack/commands`,
          interactivity: `${base}/api/slack/interactivity`,
          events: `${base}/api/slack/events`
        };
        const steps = [
          'Go to https://api.slack.com/apps → Create New App → From scratch → Name: "HirePilot (REX)" → pick your workspace.',
          `Slash Commands → Create new command → Command: /rex → Request URL: ${urls.commands} → Usage hint: /rex link me → Save.`,
          `Interactivity & Shortcuts → Toggle ON → Request URL: ${urls.interactivity} → Save.`,
          `Event Subscriptions (optional) → Toggle ON → Request URL: ${urls.events} → Add bot event: app_mention → Save.`,
          'OAuth & Permissions → Bot Token Scopes → add: commands, chat:write, channels:read, users:read → Install to workspace.',
          'In Slack: /invite @YourBot to a channel → /rex link me → /rex hello.'
        ];
        return { urls, steps };
      }
    }
  })
});

// Expose capabilities for in-process HTTP callers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(server as any).getCapabilities = () => toolCapsRef;

// NOTE: Additional tool registration for Sales Agent is disabled in production
// because the current MCP Server instance doesn't expose a .tool() API.
// When ready, migrate sales tools into server.registerCapabilities({ tools: { ... } }) format.

// Attach stdio transport (must be after capabilities registration)
server.connect(new StdioServerTransport());

console.log('✅ REX MCP server running on stdio');

async function assertPremium(userId: string) {
  // Temporary override: allow all users and plans to use REX features.
  // If you want to re-enable gating later, restore the previous checks.
  return;
}

export { server }; 