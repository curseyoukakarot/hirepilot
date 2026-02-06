import { z } from 'zod';
import dayjs from 'dayjs';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { sniperSupabaseDb } from '../services/sniperV1/supabase';
import { createJob, insertJobItems } from '../services/sniperV1/db';
import { fetchSniperV1Settings } from '../services/sniperV1/settings';
import { sniperV1Queue } from '../queues/redis';

function dayStringInTimezone(now: Date, tz: string): string {
  // Use en-CA for YYYY-MM-DD format.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now); // YYYY-MM-DD
}

async function resolveWorkspaceIdForUser(userId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from('users').select('team_id').eq('id', userId).maybeSingle();
    const teamId = (data as any)?.team_id ? String((data as any).team_id) : '';
    return teamId || userId;
  } catch {
    return userId;
  }
}

const ToolPayloadSchema = z.object({
  // If provided, overrides auto workspace resolution (team_id fallback).
  workspace_id: z.string().uuid().optional(),

  job_type: z.enum(['prospect_post_engagers', 'people_search', 'jobs_intent', 'send_connect_requests', 'send_messages']),

  // discovery jobs
  post_url: z.string().url().optional(),
  search_url: z.string().url().optional(),
  limit: z.number().int().min(1).max(2000).optional(),

  // connect/message jobs
  profile_urls: z.array(z.string().url()).min(1).max(2000).optional(),
  note: z.string().max(300).optional().nullable(),
  message: z.string().min(1).max(3000).optional(),

  // Optional scheduling hints (for audit/debug; scheduler already controls timing)
  timezone: z.string().optional(),
});

export const sniperRunJobTool = {
  name: 'sniper.run_job',
  description: 'Queue a Sniper v1 job (Cloud Engine)',
  parameters: z.object({
    userId: z.string(),
    tool_payload: ToolPayloadSchema,
  }),
  handler: async (args: any) => {
    const parsed = ToolPayloadSchema.safeParse(args?.tool_payload || {});
    if (!parsed.success) {
      throw new Error(`invalid_tool_payload:${JSON.stringify(parsed.error.flatten())}`);
    }
    const payload = parsed.data;
    const userId = String(args?.userId || '');
    if (!userId) throw new Error('missing_userId');

    const workspaceId = payload.workspace_id || await resolveWorkspaceIdForUser(userId);

    // Guard: Cloud Engine must be enabled; otherwise the worker will fail jobs anyway.
    const settings = await fetchSniperV1Settings(workspaceId);
    if (!settings.cloud_engine_enabled) {
      return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'cloud_engine_disabled' }) }] } as any;
    }

    const provider = 'airtop' as any;
    const jobType = payload.job_type;

    // Daily quota reservation for connect requests (matches /api/sniper/actions/connect behavior)
    if (jobType === 'send_connect_requests') {
      const urls = payload.profile_urls || [];
      const tz = settings.timezone || 'UTC';
      const day = dayStringInTimezone(new Date(), tz);
      const { data, error } = await sniperSupabaseDb.rpc('sniper_reserve_action_usage', {
        p_user_id: userId,
        p_workspace_id: workspaceId,
        p_day: day,
        p_connect_delta: 0,
        p_connect_limit: settings.max_connects_per_day,
        p_workspace_connect_limit: settings.max_workspace_connects_per_day,
        p_message_limit: settings.max_messages_per_day,
        p_workspace_message_limit: settings.max_workspace_messages_per_day,
        p_profile_limit: settings.max_page_interactions_per_day,
        p_workspace_profile_limit: settings.max_workspace_page_interactions_per_day,
        p_job_page_limit: settings.max_page_interactions_per_day,
        p_workspace_job_page_limit: settings.max_workspace_page_interactions_per_day
      } as any);
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      const usedUser = Number(row?.user_connects || 0);
      const usedWorkspace = Number(row?.workspace_connects || 0);
      if (usedUser + urls.length > settings.max_connects_per_day || usedWorkspace + urls.length > settings.max_workspace_connects_per_day) {
        return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'daily_connect_limit_exceeded' }) }] } as any;
      }
    }

    if (jobType === 'send_messages') {
      const urls = payload.profile_urls || [];
      const tz = settings.timezone || 'UTC';
      const day = dayStringInTimezone(new Date(), tz);
      const { data, error } = await sniperSupabaseDb.rpc('sniper_reserve_action_usage', {
        p_user_id: userId,
        p_workspace_id: workspaceId,
        p_day: day,
        p_message_delta: 0,
        p_connect_limit: settings.max_connects_per_day,
        p_workspace_connect_limit: settings.max_workspace_connects_per_day,
        p_message_limit: settings.max_messages_per_day,
        p_workspace_message_limit: settings.max_workspace_messages_per_day,
        p_profile_limit: settings.max_page_interactions_per_day,
        p_workspace_profile_limit: settings.max_workspace_page_interactions_per_day,
        p_job_page_limit: settings.max_page_interactions_per_day,
        p_workspace_job_page_limit: settings.max_workspace_page_interactions_per_day
      } as any);
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      const usedUser = Number(row?.user_messages || 0);
      const usedWorkspace = Number(row?.workspace_messages || 0);
      if (usedUser + urls.length > settings.max_messages_per_day || usedWorkspace + urls.length > settings.max_workspace_messages_per_day) {
        return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'daily_message_limit_exceeded' }) }] } as any;
      }
    }

    // Create the job row
    const input_json: any = {};
    if (jobType === 'prospect_post_engagers') {
      input_json.post_url = payload.post_url;
      input_json.limit = payload.limit ?? 200;
    }
    if (jobType === 'people_search' || jobType === 'jobs_intent') {
      input_json.search_url = payload.search_url;
      input_json.limit = payload.limit ?? (jobType === 'jobs_intent' ? 100 : 200);
    }
    if (jobType === 'send_connect_requests') {
      input_json.note = payload.note ?? null;
    }
    if (jobType === 'send_messages') {
      input_json.message = payload.message;
    }

    // Minimal validation per job type
    if (jobType === 'prospect_post_engagers' && !input_json.post_url) throw new Error('missing_post_url');
    if ((jobType === 'people_search' || jobType === 'jobs_intent') && !input_json.search_url) throw new Error('missing_search_url');
    if (jobType === 'send_connect_requests' && !(payload.profile_urls || []).length) throw new Error('missing_profile_urls');
    if (jobType === 'send_messages' && (!(payload.profile_urls || []).length || !input_json.message)) throw new Error('missing_message_or_profile_urls');

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: jobType as any,
      provider,
      input_json
    });

    // Create job items for connect/message
    if (jobType === 'send_connect_requests') {
      const urls = payload.profile_urls || [];
      await insertJobItems(
        urls.map((u) => ({
          job_id: job.id,
          workspace_id: workspaceId,
          profile_url: u,
          action_type: 'connect',
          scheduled_for: null,
          status: 'queued',
          result_json: null
        }))
      );
    }
    if (jobType === 'send_messages') {
      const urls = payload.profile_urls || [];
      await insertJobItems(
        urls.map((u) => ({
          job_id: job.id,
          workspace_id: workspaceId,
          profile_url: u,
          action_type: 'message',
          scheduled_for: null,
          status: 'queued',
        }))
      );
    }

    // Enqueue the job now. Scheduler controls timing, so no delay here.
    await sniperV1Queue.add('sniper_v1', { jobId: job.id });

    const info = {
      ok: true,
      job_id: job.id,
      job_type: jobType,
      workspace_id: workspaceId,
      queued_at: dayjs().toISOString()
    };
    return { content: [{ type: 'text', text: JSON.stringify(info) }] } as any;
  }
};

