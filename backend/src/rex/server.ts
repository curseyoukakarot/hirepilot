import 'dotenv/config';
import path from 'path';
import fetch from 'node-fetch';
import { supabase } from '../lib/supabase';
import { launchQueue } from '../../api/campaigns/launch';
import sgMail from '@sendgrid/mail';
import { personalizeMessage } from '../../utils/messageUtils';
import { resolveReplyDomain } from '../../utils/generateReplyAddress';
import { canonicalFlows, searchSupport, whitelistPages } from './knowledge.widget';
import { widgetTools } from './widgetTools';
import { buildLinkedinTools } from './agents-mcp/linkedin.tools';
import { resumeTools } from './agents-mcp/resume.tools';
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

function cloudEngineEnableHelp(): string {
  return [
    'Cloud Engine is currently OFF for your workspace, so I can\'t run LinkedIn actions yet.',
    '',
    'Enable it here:',
    '1) Go to **Settings** (`/settings/integrations`)',
    '2) Find the **Collaboration** tab and select **Agent Mode** from the dropdown',
    '3) Navigate to **Cloud Engine** (`/cloud-engine/settings`)',
    '4) Toggle **Cloud Engine: ON**',
    '5) Click **Connect** to log into LinkedIn, then come back and click **Check**',
    '',
    'Once that\'s done, tell me "retry" and I\'ll queue it again.'
  ].join('\n');
}

async function ensureSniperCloudEngineEnabledOrExplain(userId: string): Promise<null | { ok: false; error_code: string; help: string }> {
  try {
    const s: any = await apiAsUser(userId, '/api/sniper/settings', { method: 'GET' });
    if (!s?.cloud_engine_enabled) {
      return { ok: false, error_code: 'CLOUD_ENGINE_DISABLED', help: cloudEngineEnableHelp() };
    }
    return null;
  } catch {
    // If we can't load settings, fail open and let downstream endpoints decide
    return null;
  }
}

async function ensureLinkedInConnectedOrExplain(userId: string): Promise<null | { ok: false; error_code: string; help: string }> {
  try {
    const s: any = await apiAsUser(userId, '/api/v1/sniper/linkedin/auth/status', { method: 'GET' });
    if (!s?.connected) {
      return {
        ok: false,
        error_code: 'LINKEDIN_NOT_CONNECTED',
        help: [
          'LinkedIn is not connected to Cloud Engine yet, so I can\'t run browser-based missions.',
          '',
          'Connect your LinkedIn account:',
          '1) Go to **Cloud Engine** (`/cloud-engine/settings`)',
          '2) Make sure **Cloud Engine** is toggled ON',
          '3) Click **Connect** and log into LinkedIn in the popup window',
          '4) Once logged in, come back and click **Check** to verify the connection',
          '',
          'Once connected, tell me "retry" and I\'ll queue it again.'
        ].join('\n')
      };
    }
    return null;
  } catch {
    return null; // fail open
  }
}

async function ensureSniperReady(userId: string): Promise<null | { ok: false; error_code: string; help: string }> {
  const cloudGate = await ensureSniperCloudEngineEnabledOrExplain(userId);
  if (cloudGate) return cloudGate;
  const linkedInGate = await ensureLinkedInConnectedOrExplain(userId);
  if (linkedInGate) return linkedInGate;
  return null;
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
    ...resumeTools,
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

          const looksLikeHtml = (s: string) => /<!doctype\s+html/i.test(s) || /<\/?[a-z][\s\S]*>/i.test(s);
          for (const L of list) {
            const subj = personalizeMessage(tpl.subject || 'Message', L);
            const raw = personalizeMessage(tpl.content || '', L);
            const htmlBody = looksLikeHtml(raw) ? raw : raw.replace(/\n/g, '<br/>');
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
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;
        if (!/^https?:\/\//i.test(String(post_url))) throw new Error('post_url must be a valid URL');

        // Sniper v1: create+run a target (likers/commenters) via Cloud Engine
        const created = await apiAsUser(userId, `/api/sniper/targets`, {
          method: 'POST',
          body: JSON.stringify({ post_url })
        });
        const targetId = (created as any)?.target?.id || (created as any)?.id || null;
        const jobId = (created as any)?.queued_job_id || (created as any)?.queued_job?.id || null;
        const estSeconds = 60; // lightweight default; real ETA determined by worker
        const out: any = { status: 'queued', target_id: targetId, job_id: jobId, eta_seconds: estSeconds };

        // Optionally return already-extracted profiles if caller asked for a preview and job_id exists
        if (jobId && Number(limit || 0) > 0) {
          try {
            const max = Math.max(1, Math.min(Number(limit || 0), 50));
            const items = await apiAsUser(userId, `/api/sniper/jobs/${encodeURIComponent(jobId)}/items?limit=${max}`, { method: 'GET' });
            const arr = Array.isArray(items) ? items : ((items as any)?.items || []);
            const extracted = (arr || []).filter((it: any) => it.action_type === 'extract');
            out.profiles = extracted.map((it: any) => ({
              profile_url: it.profile_url,
              name: it.result_json?.name || null,
              headline: it.result_json?.headline || null,
              status: it.status
            }));
            out.count = out.profiles.length;
          } catch {}
        }
        return out;
      }
    },
    // Poll latest extracted profiles for a sniper target/job (v1)
    sniper_poll_leads: {
      parameters: {
        userId: { type: 'string' },
        target_id: { type: 'string', optional: true },
        job_id: { type: 'string', optional: true },
        limit: { type: 'number', optional: true },
        cursor: { type: 'string', optional: true } // ISO created_at; return rows created_before cursor
      },
      handler: async ({ userId, target_id, job_id, limit, cursor }) => {
        await assertPremium(userId);
        let jobId = (job_id ? String(job_id) : '') || null;
        if (!jobId && target_id) {
          try {
            const jobs = await apiAsUser(userId, `/api/sniper/jobs?limit=200`, { method: 'GET' });
            const arr = Array.isArray(jobs) ? jobs : ((jobs as any)?.jobs || []);
            const forTarget = (arr || []).filter((j: any) => String(j.target_id || '') === String(target_id));
            forTarget.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            jobId = forTarget[0]?.id ? String(forTarget[0].id) : null;
          } catch {}
        }
        if (!jobId) return { target_id: target_id || null, job_id: null, profiles: [], next_cursor: null, status: 'pending' };

        const max = Math.max(1, Math.min(Number(limit || 50), 200));
        const items = await apiAsUser(userId, `/api/sniper/jobs/${encodeURIComponent(jobId)}/items?limit=2000`, { method: 'GET' });
        const arr = Array.isArray(items) ? items : ((items as any)?.items || []);
        let extracted = (arr || []).filter((it: any) => it.action_type === 'extract');
        extracted.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (cursor) extracted = extracted.filter((it: any) => String(it.created_at || '') < String(cursor));
        const sliced = extracted.slice(0, max);
        const nextCursor = sliced.length ? String(sliced[sliced.length - 1].created_at) : null;

        let jobStatus: string | null = null;
        try {
          const jobResp = await apiAsUser(userId, `/api/sniper/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' });
          const job = (jobResp as any)?.job || jobResp;
          jobStatus = job?.status || null;
        } catch {}

        return {
          target_id: target_id || null,
          job_id: jobId,
          status: jobStatus || (sliced.length ? 'ready' : 'pending'),
          profiles: sliced.map((it: any) => ({
            profile_url: it.profile_url,
            name: it.result_json?.name || null,
            headline: it.result_json?.headline || null,
            item_status: it.status,
            created_at: it.created_at
          })),
          next_cursor: nextCursor,
          counts: { extracted_total: extracted.length, returned: sliced.length }
        };
      }
    },
    // Queue LinkedIn connect outreach for a campaign using a named LinkedIn request template (v1 Cloud Engine)
    sniper_campaign_outreach_connect: {
      parameters: {
        userId: { type: 'string' },
        campaign_id: { type: 'string', optional: true },
        template_name: { type: 'string' },
        max_count: { type: 'number', optional: true }
      },
      handler: async ({ userId, campaign_id, template_name, max_count }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { personalizeMessage } = require('../../utils/messageUtils');

        // Resolve campaign (classic campaigns table)
        let campaignId = String(campaign_id || '').trim();
        const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId);
        if (!campaignId || campaignId === 'latest' || !looksUuid) {
          const { data: latest } = await supabase
            .from('campaigns')
            .select('id,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          campaignId = (latest as any)?.id ? String((latest as any).id) : '';
        }
        if (!campaignId) throw new Error('No campaign found. Create a campaign first.');

        // Find LinkedIn request template by name (from Message Center)
        const tplName = String(template_name || '').trim();
        if (!tplName) throw new Error('template_name is required');
        const { data: tpl } = await supabase
          .from('email_templates')
          .select('id,name,subject,content,created_at')
          .eq('user_id', userId)
          .ilike('name', tplName)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!tpl?.content) throw new Error(`Template not found: ${tplName}`);

        // Load leads in campaign (classic leads table)
        const { data: leads } = await supabase
          .from('leads')
          .select('id,first_name,last_name,name,title,company,email,linkedin_url,campaign_id,user_id,created_at')
          .eq('campaign_id', campaignId)
          .eq('user_id', userId)
          .not('linkedin_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500);

        const withLinkedIn = (leads || []).filter((l: any) => String(l.linkedin_url || '').trim().length > 0);
        if (!withLinkedIn.length) throw new Error('No leads with LinkedIn URLs found in this campaign.');

        const desired = Math.max(1, Math.min(Number(max_count || withLinkedIn.length), withLinkedIn.length, 500));
        const picked = withLinkedIn.slice(0, desired);
        const requests = picked.map((l: any) => ({
          profile_url: String(l.linkedin_url).trim(),
          note: String(personalizeMessage(String(tpl.content), l)).slice(0, 300) || null
        }));

        const resp = await apiAsUser(userId, `/api/sniper/actions/connect`, {
          method: 'POST',
          body: JSON.stringify({ requests })
        });
        return {
          ok: true,
          queued: true,
          job_id: (resp as any)?.job_id || null,
          campaign_id: campaignId,
          template_name: tplName,
          requested: requests.length,
          remaining_after: (resp as any)?.remaining_after ?? null
        };
      }
    },
    // Queue a LinkedIn message to a single connected profile (v1 Cloud Engine)
    sniper_send_message_to_profile: {
      parameters: {
        userId: { type: 'string' },
        profile_url: { type: 'string', optional: true },
        lead_id: { type: 'string', optional: true },
        template_name: { type: 'string', optional: true },
        message: { type: 'string', optional: true }
      },
      handler: async ({ userId, profile_url, lead_id, template_name, message }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { personalizeMessage } = require('../../utils/messageUtils');

        let profileUrl = String(profile_url || '').trim();
        let lead: any = null;
        if (!profileUrl && lead_id) {
          const { data } = await supabase
            .from('leads')
            .select('id,first_name,last_name,name,title,company,email,linkedin_url,user_id')
            .eq('id', String(lead_id))
            .eq('user_id', userId)
            .maybeSingle();
          lead = data || null;
          profileUrl = String((lead as any)?.linkedin_url || '').trim();
        }
        if (!profileUrl) throw new Error('profile_url or lead_id is required');

        let msg = String(message || '').trim();
        if (!msg && template_name) {
          const tplName = String(template_name || '').trim();
          const { data: tpl } = await supabase
            .from('email_templates')
            .select('id,name,subject,content,created_at')
            .eq('user_id', userId)
            .ilike('name', tplName)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!tpl?.content) throw new Error(`Template not found: ${tplName}`);
          msg = lead ? String(personalizeMessage(String(tpl.content), lead)) : String(tpl.content);
        }
        msg = msg.trim();
        if (!msg) throw new Error('message or template_name is required');

        const resp = await apiAsUser(userId, `/api/sniper/actions/message`, {
          method: 'POST',
          body: JSON.stringify({ profile_urls: [profileUrl], message: msg })
        });
        return { ok: true, queued: true, job_id: (resp as any)?.job_id || null, profile_url: profileUrl };
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

        // Convert line breaks to HTML breaks for proper email formatting.
        // Avoid injecting <br/> into real HTML templates.
        const looksLikeHtml = (s: string) => /<!doctype\s+html/i.test(s) || /<\/?[a-z][\s\S]*>/i.test(s);
        const htmlBody = looksLikeHtml(finalBody) ? finalBody : finalBody.replace(/\n/g, '<br/>');
        
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
            replyTo: `msg_${trackingMessageId}.u_${userId}.c_none@${await resolveReplyDomain(userId)}`
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
        const looksLikeHtml = (s: string) => /<!doctype\s+html/i.test(s) || /<\/?[a-z][\s\S]*>/i.test(s);
        const htmlBody = looksLikeHtml(body) ? body : body.replace(/\n/g, '<br/>');

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
            replyTo: `msg_${trackingMessageId}.u_${userId}.c_none@${await resolveReplyDomain(userId)}`
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
        const looksLikeHtml = (s: string) => /<!doctype\s+html/i.test(s) || /<\/?[a-z][\s\S]*>/i.test(s);
        for (const L of list) {
          const subject = personalizeMessage(tpl.subject || 'Message', L);
          const raw = personalizeMessage(tpl.content || '', L);
          const html = looksLikeHtml(raw) ? raw : raw.replace(/\n/g, '<br/>');
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
        source:{ type:'string', description:'Lead source: "apollo" (default, fast) or "linkedin"' },
        filters:{ type:'object', description:'Search criteria', properties:{ title:{type:'string',description:'Job title (e.g. "CISO", "VP Engineering")'}, location:{type:'string',description:'Location (e.g. "San Francisco", "New York, NY")'}, keywords:{type:'string',description:'Additional keywords'}, count:{type:'number',description:'Number of leads (default 25, max 200)'}, booleanSearch:{type:'boolean',description:'Use Boolean syntax in title'}}, required:['title','location'] }
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

    // ==================== JOB REQUISITION TOOLS ====================
    search_jobs: {
      parameters: { userId: {type:'string'}, query: {type:'string', optional: true} },
      handler: async ({ userId, query }: any) => {
        let q = supabase.from('job_requisitions').select('id,title,department,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
        if (query) q = q.ilike('title', `%${query}%`);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return { jobs: data || [], count: (data || []).length };
      }
    },
    create_job_requisition: {
      parameters: {
        userId: {type:'string'}, title: {type:'string'},
        description: {type:'string', optional: true}, department: {type:'string', optional: true},
        location: {type:'string', optional: true}, salary_range: {type:'string', optional: true}
      },
      handler: async ({ userId, title, description, department, location, salary_range }: any) => {
        await assertPremium(userId);
        const resp = await apiAsUser(userId, '/api/jobs/create', {
          method: 'POST',
          body: JSON.stringify({ title, description, department, location, salary_range })
        });
        return { ok: true, job_id: (resp as any)?.jobId, pipeline_id: (resp as any)?.job?.pipeline_id, title };
      }
    },
    add_candidate_to_job: {
      parameters: {
        userId: {type:'string'}, candidateId: {type:'string'}, jobId: {type:'string'},
        stage: {type:'string', optional: true}
      },
      handler: async ({ userId, candidateId, jobId, stage }: any) => {
        // Get the job's pipeline
        const { data: job } = await supabase.from('job_requisitions').select('pipeline_id').eq('id', jobId).eq('user_id', userId).maybeSingle();
        if (!job?.pipeline_id) throw new Error('Job not found or no pipeline attached');
        // Find target stage
        let stageId: string | undefined;
        if (stage) {
          const { data: s } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', job.pipeline_id).ilike('title', `%${stage}%`).limit(1).maybeSingle();
          stageId = s?.id;
        }
        if (!stageId) {
          const { data: first } = await supabase.from('pipeline_stages').select('id,title').eq('pipeline_id', job.pipeline_id).order('position').limit(1).maybeSingle();
          stageId = first?.id;
        }
        if (!stageId) throw new Error('No pipeline stages found for this job');
        // Upsert candidate_jobs
        const { error } = await supabase.from('candidate_jobs').upsert(
          { candidate_id: candidateId, job_id: jobId, stage_id: stageId, user_id: userId },
          { onConflict: 'candidate_id,job_id' }
        );
        if (error) throw new Error(error.message);
        return { ok: true, candidate_id: candidateId, job_id: jobId, stage_id: stageId };
      }
    },
    get_job_pipeline: {
      parameters: { userId: {type:'string'}, jobId: {type:'string'} },
      handler: async ({ userId, jobId }: any) => {
        const resp = await apiAsUser(userId, `/api/pipelines?jobId=${jobId}`);
        return resp;
      }
    },

    // ==================== KANBAN TOOLS ====================
    create_kanban_board: {
      parameters: {
        userId: {type:'string'}, name: {type:'string'},
        columns: {type:'array', optional: true}
      },
      handler: async ({ userId, name, columns }: any) => {
        const { data: board, error } = await supabase.from('kanban_boards').insert({ name, user_id: userId }).select().single();
        if (error) throw new Error(error.message);
        const cols = Array.isArray(columns) && columns.length ? columns : ['To Do', 'In Progress', 'Done'];
        for (let i = 0; i < cols.length; i++) {
          await supabase.from('kanban_lists').insert({ board_id: board.id, title: String(cols[i]), position: i });
        }
        return { ok: true, board_id: board.id, name, columns: cols };
      }
    },
    create_kanban_card: {
      parameters: {
        userId: {type:'string'}, boardId: {type:'string'}, listId: {type:'string'},
        title: {type:'string'}, description: {type:'string', optional: true}
      },
      handler: async ({ userId, boardId, listId, title, description }: any) => {
        const { data: card, error } = await supabase.from('kanban_cards').insert({
          board_id: boardId, list_id: listId, title, description: description || '', created_by: userId
        }).select().single();
        if (error) throw new Error(error.message);
        return { ok: true, card_id: card.id, title };
      }
    },
    move_kanban_card: {
      parameters: { userId: {type:'string'}, cardId: {type:'string'}, targetListId: {type:'string'} },
      handler: async ({ userId, cardId, targetListId }: any) => {
        const { error } = await supabase.from('kanban_cards').update({ list_id: targetListId }).eq('id', cardId);
        if (error) throw new Error(error.message);
        return { ok: true, card_id: cardId, new_list_id: targetListId };
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
    // ==================== SNIPER V2: AGENTIC BROWSER TOOLS ====================
    sniper_update_settings: {
      parameters: {
        userId: { type:'string' },
        max_connects_per_day: { type:'number', optional: true },
        max_messages_per_day: { type:'number', optional: true },
        min_delay_seconds: { type:'number', optional: true },
        max_delay_seconds: { type:'number', optional: true },
        active_hours_start: { type:'string', optional: true },
        active_hours_end: { type:'string', optional: true },
        active_hours_days: { type:'string', optional: true },
        timezone: { type:'string', optional: true },
        safety_mode: { type:'boolean', optional: true },
        provider: { type:'string', optional: true },
        cloud_engine_enabled: { type:'boolean', optional: true },
        max_actions_per_day: { type:'number', optional: true },
        max_actions_per_hour: { type:'number', optional: true },
        cooldown_minutes: { type:'number', optional: true }
      },
      handler: async ({ userId, active_hours_start, active_hours_end, active_hours_days, ...rest }) => {
        await assertPremium(userId);
        const patch: any = {};
        for (const [k, v] of Object.entries(rest)) {
          if (k === 'userId' || v === undefined || v === null) continue;
          patch[k] = v;
        }
        // Build active_hours_json if any active_hours fields provided
        if (active_hours_start || active_hours_end || active_hours_days) {
          const current = await apiAsUser(userId, '/api/sniper/v1/settings', { method: 'GET' });
          const existing = (current as any)?.active_hours_json || { days: [1,2,3,4,5], start: '09:00', end: '17:00' };
          patch.active_hours_json = {
            ...existing,
            ...(active_hours_start ? { start: active_hours_start } : {}),
            ...(active_hours_end ? { end: active_hours_end } : {}),
            ...(active_hours_days ? { days: active_hours_days.split(',').map(Number).filter(Boolean) } : {})
          };
        }
        if (Object.keys(patch).length === 0) {
          return { ok: false, error: 'No settings to update. Provide at least one setting field.' };
        }
        const result = await apiAsUser(userId, '/api/sniper/v1/settings', {
          method: 'PUT',
          body: JSON.stringify(patch)
        });
        return { ok: true, updated_settings: result };
      }
    },
    sniper_get_status: {
      parameters: {
        userId: { type:'string' },
        job_id: { type:'string', optional: true }
      },
      handler: async ({ userId, job_id }) => {
        await assertPremium(userId);
        // Fetch settings
        const settings = await apiAsUser(userId, '/api/sniper/v1/settings', { method: 'GET' });
        // Fetch auth status
        const authStatus = await apiAsUser(userId, '/api/sniper/v1/linkedin/auth/status', { method: 'GET' });
        // Fetch quota
        const quota = await apiAsUser(userId, '/api/sniper/v1/bulk_quota', { method: 'GET' });
        // Fetch specific job if requested
        let job = null;
        if (job_id) {
          try {
            job = await apiAsUser(userId, `/api/sniper/v1/jobs/${job_id}`, { method: 'GET' });
          } catch {}
        }
        // Fetch recent jobs
        let recentJobs: any = [];
        try {
          recentJobs = await apiAsUser(userId, '/api/sniper/v1/jobs?limit=5', { method: 'GET' });
        } catch {}
        return {
          settings: {
            provider: (settings as any)?.provider,
            cloud_engine_enabled: (settings as any)?.cloud_engine_enabled,
            max_connects_per_day: (settings as any)?.max_connects_per_day,
            max_messages_per_day: (settings as any)?.max_messages_per_day,
            min_delay_seconds: (settings as any)?.min_delay_seconds,
            max_delay_seconds: (settings as any)?.max_delay_seconds,
            active_hours: (settings as any)?.active_hours_json,
            timezone: (settings as any)?.timezone,
            safety_mode: (settings as any)?.safety_mode,
          },
          auth: authStatus,
          quota,
          current_job: job,
          recent_jobs: recentJobs
        };
      }
    },
    // ── Sniper v1 Cloud Engine mission tools ──────────────────────────
    sniper_decision_makers: {
      parameters: {
        userId: { type: 'string' },
        company_url: { type: 'string' },
        company_name: { type: 'string', optional: true },
        criteria: { type: 'string', optional: true },
        limit: { type: 'number', optional: true }
      },
      handler: async ({ userId, company_url, company_name, criteria, limit }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;

        const resp = await apiAsUser(userId, '/api/v1/sniper/jobs', {
          method: 'POST',
          body: JSON.stringify({
            job_type: 'decision_maker_lookup',
            input_json: {
              companies: [{ company_url, company_name: company_name || null }],
              limit_per_company: Math.min(Number(limit || 10), 25),
              criteria: criteria || null
            }
          })
        });
        return {
          queued: true,
          job_id: (resp as any)?.job?.id || null,
          message: `Decision maker lookup queued for ${company_name || company_url}. Use sniper_poll_leads with the job_id to check results.`
        };
      }
    },
    sniper_people_search: {
      parameters: {
        userId: { type: 'string' },
        search_url: { type: 'string' },
        limit: { type: 'number', optional: true }
      },
      handler: async ({ userId, search_url, limit }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;

        const resp = await apiAsUser(userId, '/api/v1/sniper/jobs', {
          method: 'POST',
          body: JSON.stringify({
            job_type: 'people_search',
            input_json: { search_url, limit: Math.min(Number(limit || 25), 100) }
          })
        });
        return {
          queued: true,
          job_id: (resp as any)?.job?.id || null,
          message: 'LinkedIn people search queued. Use sniper_poll_leads with the job_id to check results.'
        };
      }
    },
    sniper_sn_lead_search: {
      parameters: {
        userId: { type: 'string' },
        search_url: { type: 'string' },
        limit: { type: 'number', optional: true }
      },
      handler: async ({ userId, search_url, limit }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;

        const resp = await apiAsUser(userId, '/api/v1/sniper/jobs', {
          method: 'POST',
          body: JSON.stringify({
            job_type: 'sn_lead_search',
            input_json: { search_url, limit: Math.min(Number(limit || 25), 100) }
          })
        });
        return {
          queued: true,
          job_id: (resp as any)?.job?.id || null,
          message: 'Sales Navigator lead search queued. Use sniper_poll_leads with the job_id to check results.'
        };
      }
    },
    sniper_jobs_intent: {
      parameters: {
        userId: { type: 'string' },
        search_url: { type: 'string' },
        limit: { type: 'number', optional: true }
      },
      handler: async ({ userId, search_url, limit }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;

        const resp = await apiAsUser(userId, '/api/v1/sniper/jobs', {
          method: 'POST',
          body: JSON.stringify({
            job_type: 'jobs_intent',
            input_json: { search_url, limit: Math.min(Number(limit || 25), 50) }
          })
        });
        return {
          queued: true,
          job_id: (resp as any)?.job?.id || null,
          message: 'Jobs intent search queued. Use sniper_poll_leads with the job_id to check results.'
        };
      }
    },
    sniper_sn_connect: {
      parameters: {
        userId: { type: 'string' },
        profile_urls: { type: 'array' },
        note: { type: 'string', optional: true }
      },
      handler: async ({ userId, profile_urls, note }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;

        const urls = (Array.isArray(profile_urls) ? profile_urls : []).slice(0, 500);
        if (!urls.length) throw new Error('profile_urls is required (1-500 URLs)');

        const resp = await apiAsUser(userId, '/api/v1/sniper/actions/sn-connect', {
          method: 'POST',
          body: JSON.stringify({ profile_urls: urls, note: note || null })
        });
        return {
          queued: true,
          job_id: (resp as any)?.job_id || null,
          requested: urls.length,
          message: `Queued ${urls.length} Sales Navigator connect request(s).`
        };
      }
    },
    sniper_sn_inmail: {
      parameters: {
        userId: { type: 'string' },
        profile_urls: { type: 'array' },
        subject: { type: 'string' },
        message: { type: 'string' }
      },
      handler: async ({ userId, profile_urls, subject, message }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;

        const urls = (Array.isArray(profile_urls) ? profile_urls : []).slice(0, 500);
        if (!urls.length) throw new Error('profile_urls is required');
        if (!subject?.trim()) throw new Error('subject is required');
        if (!message?.trim()) throw new Error('message is required');

        const resp = await apiAsUser(userId, '/api/v1/sniper/actions/sn-inmail', {
          method: 'POST',
          body: JSON.stringify({ profile_urls: urls, subject, message })
        });
        return {
          queued: true,
          job_id: (resp as any)?.job_id || null,
          requested: urls.length,
          message: `Queued ${urls.length} InMail(s).`
        };
      }
    },
    sniper_sn_message: {
      parameters: {
        userId: { type: 'string' },
        profile_urls: { type: 'array' },
        message: { type: 'string' }
      },
      handler: async ({ userId, profile_urls, message }) => {
        await assertPremium(userId);
        const gate = await ensureSniperReady(userId);
        if (gate) return gate;

        const urls = (Array.isArray(profile_urls) ? profile_urls : []).slice(0, 500);
        if (!urls.length) throw new Error('profile_urls is required');
        if (!message?.trim()) throw new Error('message is required');

        const resp = await apiAsUser(userId, '/api/v1/sniper/actions/sn-message', {
          method: 'POST',
          body: JSON.stringify({ profile_urls: urls, message })
        });
        return {
          queued: true,
          job_id: (resp as any)?.job_id || null,
          requested: urls.length,
          message: `Queued ${urls.length} Sales Navigator message(s).`
        };
      }
    },
    sniper_import_to_leads: {
      parameters: {
        userId: { type: 'string' },
        profile_urls: { type: 'array' },
        campaign_id: { type: 'string', optional: true }
      },
      handler: async ({ userId, profile_urls, campaign_id }) => {
        await assertPremium(userId);
        // No ensureSniperReady — import is DB-only, doesn't need Cloud Engine or LinkedIn

        const urls = (Array.isArray(profile_urls) ? profile_urls : []).slice(0, 2000);
        if (!urls.length) throw new Error('profile_urls is required');

        const resp = await apiAsUser(userId, '/api/v1/sniper/actions/import_to_leads', {
          method: 'POST',
          body: JSON.stringify({ profile_urls: urls, campaign_id: campaign_id || null })
        });
        return {
          ok: true,
          inserted: (resp as any)?.inserted || 0,
          updated: (resp as any)?.updated || 0,
          message: `Imported ${(resp as any)?.inserted || 0} profiles to leads.`
        };
      }
    },
    sniper_add_to_table: {
      parameters: {
        userId: { type: 'string' },
        profile_urls: { type: 'array' },
        table_id: { type: 'string' }
      },
      handler: async ({ userId, profile_urls, table_id }) => {
        await assertPremium(userId);
        // No ensureSniperReady — table add is DB-only

        const urls = (Array.isArray(profile_urls) ? profile_urls : []).slice(0, 2000);
        if (!urls.length) throw new Error('profile_urls is required');
        if (!table_id?.trim()) throw new Error('table_id is required');

        const resp = await apiAsUser(userId, '/api/v1/sniper/actions/add-to-table', {
          method: 'POST',
          body: JSON.stringify({ profile_urls: urls, table_id })
        });
        return {
          ok: true,
          added: (resp as any)?.added || 0,
          skipped: (resp as any)?.skipped || 0,
          message: `Added ${(resp as any)?.added || 0} profiles to table.`
        };
      }
    },
    sniper_list_jobs: {
      parameters: {
        userId: { type: 'string' },
        limit: { type: 'number', optional: true }
      },
      handler: async ({ userId, limit }) => {
        await assertPremium(userId);

        const max = Math.min(Number(limit || 20), 200);
        const resp = await apiAsUser(userId, `/api/v1/sniper/jobs?limit=${max}`, { method: 'GET' });
        const arr = Array.isArray(resp) ? resp : ((resp as any)?.jobs || []);
        return {
          jobs: arr.map((j: any) => ({
            id: j.id,
            job_type: j.job_type,
            status: j.status,
            created_at: j.created_at,
            input_json: j.input_json,
            items_count: j.items_count || null
          })),
          total: arr.length
        };
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
        if (assets.demo_video_url) lines.push(`Here's a quick demo: ${assets.demo_video_url}`);
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
          text = text.replace('Grab a time here', "Here's my calendar");
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
    // ----- REX Persona / Template / Form / Sequence tools -----
    create_persona: {
      parameters: {
        userId: { type: 'string' },
        name: { type: 'string' },
        titles: { type: 'array' },
        locations: { type: 'array', optional: true },
        include_keywords: { type: 'array', optional: true },
        exclude_keywords: { type: 'array', optional: true },
        goal_total_leads: { type: 'number', optional: true }
      },
      handler: async ({ userId, name, titles, locations, include_keywords, exclude_keywords, goal_total_leads }: any) => {
        await assertPremium(userId);
        const { data, error } = await supabase.from('personas').insert({
          user_id: userId,
          name: String(name || 'Untitled Persona'),
          titles: Array.isArray(titles) ? titles : [],
          locations: Array.isArray(locations) ? locations : [],
          include_keywords: Array.isArray(include_keywords) ? include_keywords : [],
          exclude_keywords: Array.isArray(exclude_keywords) ? exclude_keywords : [],
          channels: ['apollo'],
          goal_total_leads: Number(goal_total_leads || 50)
        }).select().single();
        if (error) throw new Error(`Failed to create persona: ${error.message}`);
        return { ok: true, persona_id: data.id, name: data.name, titles: data.titles, locations: data.locations };
      }
    },
    generate_outreach_template: {
      parameters: {
        userId: { type: 'string' },
        template_name: { type: 'string' },
        job_title: { type: 'string' },
        company_or_context: { type: 'string', optional: true },
        tone: { type: 'string', optional: true }
      },
      handler: async ({ userId, template_name, job_title, company_or_context, tone }: any) => {
        await assertPremium(userId);
        const safeTone = String(tone || 'professional').toLowerCase();
        const companyCtx = company_or_context ? `\nCompany/context: ${company_or_context}` : '';
        const prompt = `Write a short recruiting outreach email for a "${job_title}" role.${companyCtx}
Tone: ${safeTone}. Use personalization tokens: {{first_name}}, {{company}}.
Keep it under 100 words. Include a clear CTA. Return ONLY valid JSON (no code fences):
{"subject": "...", "body": "..."}`;

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { openai: openaiClient } = require('../ai/openaiClient');
        const completion = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        });
        const raw = String(completion.choices[0]?.message?.content || '{}');
        const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
        let parsed: any = {};
        try { parsed = JSON.parse(cleaned); } catch { parsed = { subject: job_title, body: cleaned }; }

        const subject = String(parsed.subject || `Opportunity: ${job_title}`);
        const body = String(parsed.body || '');

        const { data, error } = await supabase.from('email_templates').insert({
          user_id: userId,
          name: String(template_name || `${job_title} Outreach`),
          subject,
          content: body
        }).select('id,name,subject').single();
        if (error) throw new Error(`Failed to save template: ${error.message}`);
        return { ok: true, template_id: data.id, name: data.name, subject: data.subject, preview: body.slice(0, 200) };
      }
    },
    create_screening_form: {
      parameters: {
        userId: { type: 'string' },
        title: { type: 'string' },
        job_title: { type: 'string', optional: true },
        questions: { type: 'array', optional: true },
        job_id: { type: 'string', optional: true }
      },
      handler: async ({ userId, title, job_title, questions, job_id }: any) => {
        await assertPremium(userId);

        // Generate questions if not provided
        let fields: Array<{ label: string; field_type: string; options?: string[] }> = [];
        if (Array.isArray(questions) && questions.length > 0) {
          fields = questions.map((q: any) => ({
            label: String(q.label || q.question || q.text || ''),
            field_type: String(q.field_type || q.type || 'short_text'),
            options: Array.isArray(q.options) ? q.options : undefined
          }));
        } else {
          // Auto-generate 5 screening questions with GPT
          const roleLabel = job_title || title || 'the role';
          const prompt = `Generate 5 screening questions for a "${roleLabel}" position. Return ONLY valid JSON (no code fences):
[
  {"label": "...", "field_type": "dropdown", "options": ["0-2 years","2-5 years","5-10 years","10+ years"]},
  {"label": "...", "field_type": "multi_select", "options": ["skill1","skill2","skill3","skill4","skill5"]},
  {"label": "...", "field_type": "short_text"},
  {"label": "...", "field_type": "short_text"},
  {"label": "...", "field_type": "long_text"}
]
Question topics: experience level, key skills relevant to ${roleLabel}, location/availability, salary expectations, motivation/interest.`;

          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { openai: openaiClient } = require('../ai/openaiClient');
          const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 800
          });
          const raw = String(completion.choices[0]?.message?.content || '[]');
          const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
          try { fields = JSON.parse(cleaned); } catch {
            // Fallback default questions
            fields = [
              { label: 'Years of relevant experience?', field_type: 'dropdown', options: ['0-2 years','2-5 years','5-10 years','10+ years'] },
              { label: 'Key skills and technologies?', field_type: 'short_text' },
              { label: 'Current location and work authorization?', field_type: 'short_text' },
              { label: 'Expected salary range?', field_type: 'short_text' },
              { label: 'Why are you interested in this role?', field_type: 'long_text' }
            ];
          }
        }

        // Generate slug from title
        const slug = String(title || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '-' + Date.now().toString(36);

        // Create form
        const { data: form, error: formErr } = await supabase.from('forms').insert({
          user_id: userId,
          title: String(title),
          slug,
          job_id: job_id || null,
          status: 'active'
        }).select('id,slug').single();
        if (formErr) throw new Error(`Failed to create form: ${formErr.message}`);

        // Create fields
        const fieldInserts = fields.map((f: any, i: number) => ({
          form_id: form.id,
          label: String(f.label || `Question ${i + 1}`),
          field_type: String(f.field_type || 'short_text'),
          options: Array.isArray(f.options) ? f.options : null,
          position: i,
          required: true
        }));
        if (fieldInserts.length) {
          const { error: fieldsErr } = await supabase.from('form_fields').insert(fieldInserts);
          if (fieldsErr) console.error('[create_screening_form] fields insert error:', fieldsErr.message);
        }

        const baseUrl = process.env.FRONTEND_URL || 'https://app.thehirepilot.com';
        return { ok: true, form_id: form.id, slug: form.slug, url: `${baseUrl}/forms/${form.slug}`, field_count: fieldInserts.length };
      }
    },
    create_email_sequence: {
      parameters: {
        userId: { type: 'string' },
        name: { type: 'string' },
        steps: { type: 'array', optional: true },
        stop_on_reply: { type: 'boolean', optional: true }
      },
      handler: async ({ userId, name, steps, stop_on_reply }: any) => {
        await assertPremium(userId);

        let sequenceSteps: Array<{ subject: string; body: string; delay_days: number }> = [];

        if (Array.isArray(steps) && steps.length > 0) {
          sequenceSteps = steps.map((s: any, i: number) => ({
            subject: String(s.subject || `Follow-up ${i + 1}`),
            body: String(s.body || ''),
            delay_days: Number(s.delay_days || (i === 0 ? 0 : i * 2))
          }));
        } else {
          // Auto-generate a 3-step sequence using GPT
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { buildThreeStepSequence } = require('../services/sequenceBuilder');
          const result = await buildThreeStepSequence({
            titleGroups: ['Candidate'],
            productName: 'recruiting opportunity',
            spacingBusinessDays: 2
          });
          if (result.step1) {
            sequenceSteps = [
              { subject: result.step1.subject || 'Initial outreach', body: result.step1.body || '', delay_days: 0 },
              { subject: result.step2?.subject || 'Follow-up', body: result.step2?.body || '', delay_days: 2 },
              { subject: result.step3?.subject || 'Final follow-up', body: result.step3?.body || '', delay_days: 4 }
            ];
          } else {
            // Fallback
            sequenceSteps = [
              { subject: 'Quick intro', body: 'Hi {{first_name}}, I came across your profile and wanted to reach out about an exciting opportunity.', delay_days: 0 },
              { subject: 'Following up', body: 'Hi {{first_name}}, just wanted to follow up on my previous message. Would you be open to a quick chat?', delay_days: 2 },
              { subject: 'Last check-in', body: 'Hi {{first_name}}, I understand you may be busy. Just wanted to check if you had a chance to review my previous messages.', delay_days: 4 }
            ];
          }
        }

        // Insert into message_sequences
        const { data: seq, error: seqErr } = await supabase.from('message_sequences').insert({
          user_id: userId,
          name: String(name || 'Untitled Sequence'),
          stop_on_reply: stop_on_reply !== false,
          status: 'active'
        }).select('id,name').single();
        if (seqErr) throw new Error(`Failed to create sequence: ${seqErr.message}`);

        // Insert steps
        const stepInserts = sequenceSteps.map((s, i) => ({
          sequence_id: seq.id,
          step_number: i + 1,
          subject: s.subject,
          body: s.body,
          delay_days: s.delay_days
        }));
        if (stepInserts.length) {
          const { error: stepsErr } = await supabase.from('message_sequence_steps').insert(stepInserts);
          if (stepsErr) console.error('[create_email_sequence] steps insert error:', stepsErr.message);
        }

        return { ok: true, sequence_id: seq.id, name: seq.name, step_count: stepInserts.length };
      }
    },
    score_candidates: {
      parameters: {
        userId: { type: 'string' },
        campaign_id: { type: 'string', optional: true },
        lead_ids: { type: 'array', optional: true },
        job_title: { type: 'string', optional: true },
        job_description: { type: 'string', optional: true },
        min_score: { type: 'number', optional: true }
      },
      handler: async ({ userId, campaign_id, lead_ids, job_title, job_description, min_score }: {
        userId: string; campaign_id?: string; lead_ids?: string[];
        job_title?: string; job_description?: string; min_score?: number;
      }) => {
        await assertPremium(userId);

        // 1. Resolve leads to score
        let leads: Array<{ id: string; name?: string; email?: string; title?: string; company?: string }> = [];

        if (lead_ids?.length) {
          const { data } = await supabase.from('sourcing_leads')
            .select('id, name, email, title, company')
            .in('id', lead_ids)
            .limit(50);
          leads = data || [];
        } else if (campaign_id) {
          const { data } = await supabase.from('sourcing_leads')
            .select('id, name, email, title, company')
            .eq('campaign_id', campaign_id)
            .limit(50);
          leads = data || [];
        } else {
          throw new Error('Provide either campaign_id or lead_ids to score.');
        }

        if (!leads.length) return { ok: true, scored: [], message: 'No leads found to score.' };

        // 2. Build scoring prompt (same logic as runScoreStep in stepHandlers)
        const candidateList = leads.map((l, i) => (
          `${i + 1}. ID: ${l.id} | Name: ${l.name || 'Unknown'} | Title: ${l.title || 'N/A'} | Company: ${l.company || 'N/A'} | Email: ${l.email ? 'Yes' : 'No'}`
        )).join('\n');

        const scoringPrompt = `Score these candidates against the job requirements. Return ONLY valid JSON.

Job: ${job_title || 'Open Role'}
Description: ${String(job_description || '').slice(0, 1000) || 'Not specified'}

Candidates:
${candidateList}

Return a JSON array (no markdown, no code fences):
[{"id": "uuid", "score": 0-100, "reason": "one-line explanation"}]

Score based on: title relevance (40%), company quality (20%), having verified email (20%), overall fit (20%).
Rank from highest to lowest score.`;

        // 3. Call GPT-4o-mini
        const { openai: openaiClient } = require('../ai/openaiClient');
        const completion = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: scoringPrompt }],
          temperature: 0.3,
          max_tokens: 4000
        });

        const raw = completion.choices[0]?.message?.content || '[]';
        const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();

        let scored: Array<{ id: string; score: number; reason: string }> = [];
        try {
          scored = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\[[\s\S]*\]/);
          if (match) scored = JSON.parse(match[0]);
        }

        // Validate IDs
        const validIds = new Set(leads.map(l => l.id));
        scored = scored.filter(s => validIds.has(s.id));
        scored.sort((a, b) => (b.score || 0) - (a.score || 0));

        // 4. Persist scores to sourcing_leads
        const now = new Date().toISOString();
        let persisted = 0;
        for (const s of scored) {
          try {
            await supabase.from('sourcing_leads')
              .update({ score: s.score, score_reason: s.reason, scored_at: now })
              .eq('id', s.id);
            persisted++;
          } catch {
            // Columns may not exist yet — non-blocking
          }
        }

        // 5. Return results with pass/fail
        const threshold = min_score ?? 40;
        const passed = scored.filter(s => s.score >= threshold);
        const filtered = scored.filter(s => s.score < threshold);
        const avgScore = scored.length ? Math.round(scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length) : 0;

        return {
          ok: true,
          scored_count: scored.length,
          avg_score: avgScore,
          threshold,
          passed_count: passed.length,
          filtered_count: filtered.length,
          persisted_count: persisted,
          top_candidates: passed.slice(0, 10).map(s => ({
            id: s.id,
            score: s.score,
            reason: s.reason,
            name: leads.find(l => l.id === s.id)?.name || 'Unknown'
          })),
          filtered_candidates: filtered.slice(0, 5).map(s => ({
            id: s.id,
            score: s.score,
            reason: s.reason,
            name: leads.find(l => l.id === s.id)?.name || 'Unknown'
          }))
        };
      }
    },
    check_lead_overlap: {
      parameters: {
        userId: { type: 'string' },
        campaign_id: { type: 'string', optional: true },
        emails: { type: 'array', optional: true }
      },
      handler: async ({ userId, campaign_id, emails }: { userId: string; campaign_id?: string; emails?: string[] }) => {
        await assertPremium(userId);

        const { dedupeLeadsAcrossCampaigns } = await import('../lib/dedupe');

        let leadsToCheck: Array<{ email?: string; linkedin_url?: string }> = [];

        if (emails && Array.isArray(emails) && emails.length > 0) {
          // Check specific emails
          leadsToCheck = emails.map(e => ({ email: e }));
        } else if (campaign_id) {
          // Check all leads in a campaign against other active campaigns
          const { data: campaignLeads } = await supabase
            .from('sourcing_leads')
            .select('email, linkedin_url')
            .eq('campaign_id', campaign_id)
            .not('email', 'is', null)
            .limit(1000);
          leadsToCheck = (campaignLeads || []) as any[];
        } else {
          throw new Error('Provide either campaign_id or emails array');
        }

        if (!leadsToCheck.length) {
          return { total_checked: 0, duplicates_found: 0, details: [], duplicate_campaigns: [] };
        }

        const result = await dedupeLeadsAcrossCampaigns(userId, leadsToCheck, campaign_id || undefined);

        // Aggregate by campaign
        const campMap = new Map<string, { campaign_id: string; campaign_title: string; count: number }>();
        for (const d of result.details) {
          const existing = campMap.get(d.existing_campaign_id);
          if (existing) {
            existing.count++;
          } else {
            campMap.set(d.existing_campaign_id, {
              campaign_id: d.existing_campaign_id,
              campaign_title: d.existing_campaign_title,
              count: 1
            });
          }
        }

        return {
          total_checked: leadsToCheck.length,
          duplicates_found: result.details.length,
          details: result.details.slice(0, 50),
          duplicate_campaigns: Array.from(campMap.values())
        };
      }
    },
    create_ab_test: {
      parameters: {
        userId: { type: 'string' },
        sequence_id: { type: 'string' },
        step_order: { type: 'number' },
        variant_b_subject: { type: 'string' },
        variant_b_body: { type: 'string' },
        primary_metric: { type: 'string', optional: true },
        min_sends: { type: 'number', optional: true }
      },
      handler: async (args: any) => {
        const { userId, sequence_id, step_order, variant_b_subject, variant_b_body, primary_metric, min_sends } = args;
        await assertPremium(userId);
        if (!sequence_id || !step_order || !variant_b_subject || !variant_b_body) {
          throw new Error('sequence_id, step_order, variant_b_subject, and variant_b_body are required');
        }

        // Verify ownership
        const { data: seq } = await supabase
          .from('message_sequences')
          .select('id, owner_user_id, user_id')
          .eq('id', sequence_id)
          .single();
        if (!seq) throw new Error('Sequence not found');
        const seqOwner = (seq as any).owner_user_id || (seq as any).user_id;
        if (String(seqOwner) !== String(userId)) throw new Error('Not authorized');

        // Find step by order
        const { data: step } = await supabase
          .from('message_sequence_steps')
          .select('id')
          .eq('sequence_id', sequence_id)
          .eq('step_order', step_order)
          .single();
        if (!step) throw new Error(`Step ${step_order} not found in sequence`);

        // Check if A/B test already exists for this step
        const { data: existing } = await supabase
          .from('ab_tests')
          .select('id')
          .eq('step_id', (step as any).id)
          .eq('status', 'active')
          .maybeSingle();
        if (existing) throw new Error('An active A/B test already exists for this step. Complete or pause it first.');

        const { createAbTest } = await import('../services/abTesting');
        const result = await createAbTest({
          userId,
          sequenceId: sequence_id,
          stepId: (step as any).id,
          variantBSubject: variant_b_subject,
          variantBBody: variant_b_body,
          primaryMetric: primary_metric,
          minSends: min_sends
        });

        return {
          ok: true,
          test_id: result.test_id,
          variant_a_id: result.variant_a_id,
          variant_b_id: result.variant_b_id,
          message: `A/B test created for step ${step_order}. Variant A = original, Variant B = new version. Auto-promotes winner after ${min_sends || 50} sends per variant.`
        };
      }
    },
    get_ab_results: {
      parameters: {
        userId: { type: 'string' },
        sequence_id: { type: 'string' },
        step_order: { type: 'number', optional: true }
      },
      handler: async (args: any) => {
        const { userId, sequence_id, step_order } = args;
        await assertPremium(userId);

        // Verify ownership
        const { data: seq } = await supabase
          .from('message_sequences')
          .select('id, owner_user_id, user_id')
          .eq('id', sequence_id)
          .single();
        if (!seq) throw new Error('Sequence not found');
        const seqOwner = (seq as any).owner_user_id || (seq as any).user_id;
        if (String(seqOwner) !== String(userId)) throw new Error('Not authorized');

        // Get A/B tests for this sequence
        let testQuery = supabase
          .from('ab_tests')
          .select('*')
          .eq('sequence_id', sequence_id);

        if (step_order) {
          const { data: step } = await supabase
            .from('message_sequence_steps')
            .select('id')
            .eq('sequence_id', sequence_id)
            .eq('step_order', step_order)
            .single();
          if (step) testQuery = testQuery.eq('step_id', (step as any).id);
        }

        const { data: tests } = await testQuery;
        if (!tests?.length) return { tests: [], message: 'No A/B tests found for this sequence.' };

        const { getVariantMetrics, detectWinner } = await import('../services/abTesting');

        const results = [];
        for (const test of tests as any[]) {
          const metrics = await getVariantMetrics(test.id);
          const winner = test.status === 'active'
            ? detectWinner(metrics, test.min_sends_per_variant || 50, test.primary_metric || 'reply_rate')
            : null;

          results.push({
            test_id: test.id,
            step_id: test.step_id,
            status: test.status,
            primary_metric: test.primary_metric,
            min_sends_per_variant: test.min_sends_per_variant,
            variants: metrics.map(m => ({
              variant_id: m.variant_id,
              label: m.label,
              sent: m.sent,
              opened: m.opened,
              replied: m.replied,
              open_rate: m.open_rate,
              reply_rate: m.reply_rate,
              is_winner: m.is_winner
            })),
            recommendation: winner
              ? `Variant ${winner.label} is winning (${(winner.rate * 100).toFixed(1)}% ${winner.metric}) with 90% confidence. Ready to promote.`
              : metrics.some(m => m.sent < (test.min_sends_per_variant || 50))
                ? `Need more data. Min ${test.min_sends_per_variant || 50} sends per variant required.`
                : 'No statistically significant winner yet. Continue testing.'
          });
        }

        return { tests: results };
      }
    },
    promote_ab_variant: {
      parameters: {
        userId: { type: 'string' },
        test_id: { type: 'string' },
        variant_id: { type: 'string' }
      },
      handler: async (args: any) => {
        const { userId, test_id, variant_id } = args;
        await assertPremium(userId);

        // Verify ownership via test → sequence → owner
        const { data: test } = await supabase
          .from('ab_tests')
          .select('id, sequence_id, status')
          .eq('id', test_id)
          .single();
        if (!test) throw new Error('A/B test not found');
        if ((test as any).status === 'completed') throw new Error('Test already completed');

        const { data: seq } = await supabase
          .from('message_sequences')
          .select('owner_user_id, user_id')
          .eq('id', (test as any).sequence_id)
          .single();
        if (!seq) throw new Error('Sequence not found');
        const seqOwner = (seq as any).owner_user_id || (seq as any).user_id;
        if (String(seqOwner) !== String(userId)) throw new Error('Not authorized');

        const { promoteVariant } = await import('../services/abTesting');
        await promoteVariant(test_id, variant_id);

        return {
          ok: true,
          message: `Variant promoted as winner. All future sends for this step will use the winning variant.`
        };
      }
    },
    classify_reply: {
      parameters: {
        userId: { type: 'string' },
        replyId: { type: 'string' },
        forceLabel: { type: 'string', optional: true }
      },
      handler: async ({ userId, replyId, forceLabel }: { userId: string; replyId: string; forceLabel?: string }) => {
        await assertPremium(userId);

        // 1. Fetch the reply
        const { data: reply, error: replyErr } = await supabase
          .from('sourcing_replies')
          .select('id, body, campaign_id, lead_id, classified_as, next_action')
          .eq('id', replyId)
          .single();
        if (replyErr || !reply) throw new Error('Reply not found');

        // 2. Verify ownership via campaign
        const { data: campaign } = await supabase
          .from('sourcing_campaigns')
          .select('created_by')
          .eq('id', reply.campaign_id)
          .single();
        if (!campaign || campaign.created_by !== userId) throw new Error('Access denied');

        // 3. Classify (or use forced label)
        const validLabels = ['positive', 'meeting_request', 'neutral', 'negative', 'oos', 'auto'];
        let newLabel: string;
        let newAction: string;

        if (forceLabel) {
          if (!validLabels.includes(forceLabel)) throw new Error(`Invalid label: ${forceLabel}. Must be one of: ${validLabels.join(', ')}`);
          newLabel = forceLabel;
          const actionMap: Record<string, string> = {
            positive: 'book', meeting_request: 'book', neutral: 'reply',
            negative: 'disqualify', oos: 'disqualify', auto: 'hold'
          };
          newAction = actionMap[forceLabel] || 'reply';
        } else {
          // Re-run AI classification
          const { classifyReply } = require('../routes/sendgridInbound');
          const result = await classifyReply(reply.body || '');
          newLabel = result.label;
          newAction = result.next_action;
        }

        // 4. Update reply + lead
        await supabase
          .from('sourcing_replies')
          .update({ classified_as: newLabel, next_action: newAction })
          .eq('id', replyId);

        if (reply.lead_id) {
          await supabase
            .from('sourcing_leads')
            .update({ reply_status: newLabel })
            .eq('id', reply.lead_id);
        }

        // 5. Re-execute auto-actions if label changed
        let autoActionsTriggered = false;
        if (newLabel !== reply.classified_as && reply.lead_id && reply.campaign_id) {
          try {
            const { executeReplyAutoActions } = require('../services/replyAutoActions');
            await executeReplyAutoActions({
              leadId: reply.lead_id,
              campaignId: reply.campaign_id,
              classificationLabel: newLabel,
              nextAction: newAction,
              replyId
            });
            autoActionsTriggered = true;
          } catch (err: any) {
            console.warn('[classify_reply] auto-actions error:', err?.message);
          }
        }

        return {
          ok: true,
          replyId,
          previousLabel: reply.classified_as,
          newLabel,
          newAction,
          autoActionsTriggered
        };
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
    },

    // ── Notification Handoff Tools ──

    get_pending_handoffs: {
      parameters: {
        userId: { type: 'string' },
        type: { type: 'string', optional: true }
      },
      handler: async ({ userId, type }: { userId: string; type?: string }) => {
        await assertPremium(userId);

        let query = supabase
          .from('notifications')
          .select('id, thread_key, title, body_md, type, actions, metadata, created_at')
          .eq('user_id', userId)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(20);

        if (type) {
          query = query.eq('type', type);
        }

        const { data: notifications } = await query;
        if (!notifications?.length) {
          return { count: 0, handoffs: [], summary: 'No pending handoffs — everything is handled!' };
        }

        const handoffs = (notifications as any[]).map(n => {
          const ageMs = Date.now() - new Date(n.created_at).getTime();
          const ageHours = Math.round(ageMs / (60 * 60 * 1000));
          return {
            thread_key: n.thread_key || null,
            title: n.title,
            body_preview: (n.body_md || '').slice(0, 200),
            type: n.type,
            actions: (n.actions || []).map((a: any) => a.id),
            created_at: n.created_at,
            age_hours: ageHours
          };
        });

        // Summarize by type
        const typeCounts: Record<string, number> = {};
        for (const h of handoffs) {
          typeCounts[h.type] = (typeCounts[h.type] || 0) + 1;
        }
        const summaryParts = Object.entries(typeCounts).map(([t, c]) => `${c} ${t}`);
        const summary = `${handoffs.length} pending: ${summaryParts.join(', ')}`;

        return { count: handoffs.length, handoffs, summary };
      }
    },

    resolve_handoff: {
      parameters: {
        userId: { type: 'string' },
        thread_key: { type: 'string' },
        action_id: { type: 'string' },
        data: { type: 'object', optional: true }
      },
      handler: async ({ userId, thread_key, action_id, data }: { userId: string; thread_key: string; action_id: string; data?: Record<string, any> }) => {
        await assertPremium(userId);

        const { recordInteraction } = await import('../lib/notifications');
        const { dispatchAction } = await import('../lib/interactionDispatcher');

        // Find the notification to get metadata
        const { data: notification } = await supabase
          .from('notifications')
          .select('id, metadata')
          .eq('user_id', userId)
          .eq('thread_key', thread_key)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Record the interaction
        const interaction = await recordInteraction({
          user_id: userId,
          source: 'inapp' as const,
          thread_key,
          action_type: 'button' as const,
          action_id,
          data: data || {},
          metadata: (notification as any)?.metadata || {}
        });

        // Dispatch the action
        const result = await dispatchAction({
          userId,
          interactionId: interaction.id,
          actionId: action_id,
          threadKey: thread_key,
          data: { ...((notification as any)?.metadata || {}), ...(data || {}) },
          metadata: (notification as any)?.metadata || {}
        });

        // Mark notification as read
        if (notification) {
          await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', (notification as any).id);
        }

        return { resolved: result.ok, message: result.message, action: action_id, thread_key };
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