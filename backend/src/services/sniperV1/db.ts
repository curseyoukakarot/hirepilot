import { sniperSupabaseDb } from './supabase';

export type SniperTargetRow = {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  type: 'linkedin_post_engagement';
  post_url: string;
  status: 'active' | 'paused';
  settings_json: any;
  created_at: string;
  updated_at: string;
};

export type SniperJobType = 'prospect_post_engagers' | 'send_connect_requests' | 'send_messages';
export type SniperProvider = 'airtop' | 'local_playwright';
export type SniperJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'partially_succeeded' | 'canceled';

export type SniperJobRow = {
  id: string;
  workspace_id: string;
  created_by: string;
  target_id: string | null;
  job_type: SniperJobType;
  provider: SniperProvider;
  input_json: any;
  status: SniperJobStatus;
  attempts: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SniperJobItemStatus = 'queued' | 'running' | 'success' | 'failed' | 'skipped';
export type SniperJobItemAction = 'connect' | 'message' | 'extract';

export type SniperJobItemRow = {
  id: string;
  job_id: string;
  workspace_id: string;
  profile_url: string;
  action_type: SniperJobItemAction;
  scheduled_for: string | null;
  status: SniperJobItemStatus;
  result_json: any | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function createTarget(input: {
  workspace_id: string;
  created_by: string;
  name: string;
  post_url: string;
  settings_json?: any;
}): Promise<SniperTargetRow> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_targets')
    .insert({
      workspace_id: input.workspace_id,
      created_by: input.created_by,
      name: input.name,
      type: 'linkedin_post_engagement',
      post_url: input.post_url,
      status: 'active',
      settings_json: input.settings_json || {}
    } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export async function listTargets(workspaceId: string): Promise<SniperTargetRow[]> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_targets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function setTargetStatus(targetId: string, status: 'active' | 'paused') {
  const { error } = await sniperSupabaseDb.from('sniper_targets').update({ status }).eq('id', targetId);
  if (error) throw error;
}

export async function getTarget(targetId: string): Promise<SniperTargetRow | null> {
  const { data, error } = await sniperSupabaseDb.from('sniper_targets').select('*').eq('id', targetId).maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function createJob(input: {
  workspace_id: string;
  created_by: string;
  target_id?: string | null;
  job_type: SniperJobType;
  provider: SniperProvider;
  input_json: any;
}): Promise<SniperJobRow> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_jobs')
    .insert({
      workspace_id: input.workspace_id,
      created_by: input.created_by,
      target_id: input.target_id ?? null,
      job_type: input.job_type,
      provider: input.provider,
      input_json: input.input_json || {},
      status: 'queued',
      attempts: 0
    } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export async function listJobs(workspaceId: string, limit = 50): Promise<SniperJobRow[]> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_jobs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) throw error;
  return (data || []) as any;
}

export async function getJob(jobId: string): Promise<SniperJobRow | null> {
  const { data, error } = await sniperSupabaseDb.from('sniper_jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function updateJob(jobId: string, patch: Partial<SniperJobRow>) {
  const { error } = await sniperSupabaseDb.from('sniper_jobs').update(patch as any).eq('id', jobId);
  if (error) throw error;
}

export async function insertJobItems(items: Array<{
  job_id: string;
  workspace_id: string;
  profile_url: string;
  action_type: SniperJobItemAction;
  scheduled_for?: string | null;
  status?: SniperJobItemStatus;
  result_json?: any;
}>) {
  if (!items.length) return;
  const rows = items.map((it) => ({
    job_id: it.job_id,
    workspace_id: it.workspace_id,
    profile_url: it.profile_url,
    action_type: it.action_type,
    scheduled_for: it.scheduled_for ?? null,
    status: it.status ?? 'queued',
    result_json: it.result_json ?? null
  }));
  const { error } = await sniperSupabaseDb.from('sniper_job_items').insert(rows as any);
  if (error) throw error;
}

export async function listJobItems(jobId: string, limit = 500): Promise<SniperJobItemRow[]> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_job_items')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 2000)));
  if (error) throw error;
  return (data || []) as any;
}

export async function updateJobItem(itemId: string, patch: Partial<SniperJobItemRow>) {
  const { error } = await sniperSupabaseDb.from('sniper_job_items').update(patch as any).eq('id', itemId);
  if (error) throw error;
}

export async function summarizeJobItems(jobId: string): Promise<{ success: number; failed: number; skipped: number; total: number }> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_job_items')
    .select('status')
    .eq('job_id', jobId);
  if (error) throw error;
  const rows = (data || []) as any[];
  const total = rows.length;
  const success = rows.filter((r) => r.status === 'success').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const skipped = rows.filter((r) => r.status === 'skipped').length;
  return { success, failed, skipped, total };
}


