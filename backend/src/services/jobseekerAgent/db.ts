import { supabaseDb } from '../../lib/supabase';

export type JobSeekerAgentRunRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  status: string;
  search_url: string;
  job_limit: number;
  priority: string;
  context: string | null;
  schedule_enabled: boolean;
  schedule_cron: string | null;
  next_run_at: string | null;
  progress_json: any;
  stats_json: any;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobSeekerAgentRunItemRow = {
  id: string;
  run_id: string;
  item_type: 'job' | 'target';
  job_url: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  job_data_json: any | null;
  target_profile_url: string | null;
  target_name: string | null;
  target_title: string | null;
  match_score: number | null;
  target_data_json: any | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type JobSeekerCloudEngineSettingsRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  airtop_profile_id: string | null;
  status: 'ok' | 'needs_reauth' | 'disconnected';
  connected_at: string | null;
  daily_job_page_limit: number;
  daily_profile_limit: number;
  max_concurrency: number;
  cooldown_minutes: number;
  notify_email: boolean;
  notify_inapp: boolean;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_JOBSEEKER_CLOUD_ENGINE_SETTINGS: Omit<JobSeekerCloudEngineSettingsRow, 'id' | 'user_id' | 'workspace_id' | 'created_at' | 'updated_at' | 'airtop_profile_id' | 'connected_at'> = {
  status: 'needs_reauth',
  daily_job_page_limit: 50,
  daily_profile_limit: 100,
  max_concurrency: 1,
  cooldown_minutes: 30,
  notify_email: true,
  notify_inapp: true
};

export async function createRun(row: Partial<JobSeekerAgentRunRow>) {
  const { data, error } = await supabaseDb
    .from('jobseeker_agent_runs')
    .insert(row as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as JobSeekerAgentRunRow;
}

export async function updateRun(id: string, patch: Partial<JobSeekerAgentRunRow>) {
  const { data, error } = await supabaseDb
    .from('jobseeker_agent_runs')
    .update(patch as any)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as JobSeekerAgentRunRow;
}

export async function getRun(id: string) {
  const { data, error } = await supabaseDb
    .from('jobseeker_agent_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as JobSeekerAgentRunRow) || null;
}

export async function listRuns(userId: string, opts?: { status?: string; limit?: number }) {
  const limit = Math.min(Number(opts?.limit || 50), 200);
  let q = supabaseDb
    .from('jobseeker_agent_runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts?.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data as JobSeekerAgentRunRow[]) || [];
}

export async function listRunItems(runId: string, opts?: { type?: string; limit?: number }) {
  const limit = Math.min(Number(opts?.limit || 500), 5000);
  let q = supabaseDb
    .from('jobseeker_agent_run_items')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (opts?.type) q = q.eq('item_type', opts.type);
  const { data, error } = await q;
  if (error) throw error;
  return (data as JobSeekerAgentRunItemRow[]) || [];
}

export async function insertRunItems(items: Array<Partial<JobSeekerAgentRunItemRow>>) {
  if (!items.length) return [];
  const { data, error } = await supabaseDb
    .from('jobseeker_agent_run_items')
    .insert(items as any)
    .select('*');
  if (error) throw error;
  return (data as JobSeekerAgentRunItemRow[]) || [];
}

export async function updateRunItem(id: string, patch: Partial<JobSeekerAgentRunItemRow>) {
  const { data, error } = await supabaseDb
    .from('jobseeker_agent_run_items')
    .update(patch as any)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as JobSeekerAgentRunItemRow;
}

export async function fetchCloudEngineSettings(userId: string, workspaceId: string | null) {
  const { data, error } = await supabaseDb
    .from('jobseeker_cloud_engine_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      ...DEFAULT_JOBSEEKER_CLOUD_ENGINE_SETTINGS,
      user_id: userId,
      workspace_id: workspaceId,
      airtop_profile_id: null,
      connected_at: null
    } as JobSeekerCloudEngineSettingsRow;
  }
  return data as JobSeekerCloudEngineSettingsRow;
}

export async function upsertCloudEngineSettings(userId: string, workspaceId: string | null, patch: Partial<JobSeekerCloudEngineSettingsRow>) {
  const row: any = {
    user_id: userId,
    workspace_id: workspaceId,
    ...patch
  };
  Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
  const { data, error } = await supabaseDb
    .from('jobseeker_cloud_engine_settings')
    .upsert(row, { onConflict: 'user_id,workspace_id' } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as JobSeekerCloudEngineSettingsRow;
}
