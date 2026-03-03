import { sniperSupabaseDb } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';
export type CampaignStepAction = 'wait' | 'connect' | 'message' | 'profile_visit' | 'like_post';
export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'replied' | 'bounced' | 'error';

export type CampaignRow = {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  stop_on_reply: boolean;
  lead_source_json: any;
  settings_json: any;
  stats_json: any;
  created_at: string;
  updated_at: string;
};

export type CampaignStepRow = {
  id: string;
  campaign_id: string;
  step_order: number;
  action_type: CampaignStepAction;
  delay_days: number;
  delay_hours: number;
  config_json: any;
  created_at: string;
  updated_at: string;
};

export type CampaignEnrollmentRow = {
  id: string;
  campaign_id: string;
  workspace_id: string;
  profile_url: string;
  profile_name: string | null;
  profile_json: any;
  status: EnrollmentStatus;
  current_step_order: number;
  next_step_at: string | null;
  last_action_at: string | null;
  enrolled_by: string;
  lead_id: string | null;
  last_job_item_id: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

export async function createCampaign(input: {
  workspace_id: string;
  created_by: string;
  name: string;
  description?: string | null;
  stop_on_reply?: boolean;
  lead_source_json?: any;
  settings_json?: any;
}): Promise<CampaignRow> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaigns')
    .insert({
      workspace_id: input.workspace_id,
      created_by: input.created_by,
      name: input.name,
      description: input.description ?? null,
      status: 'draft',
      stop_on_reply: input.stop_on_reply ?? true,
      lead_source_json: input.lead_source_json ?? {},
      settings_json: input.settings_json ?? {},
      stats_json: {}
    } as any)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export async function getCampaign(campaignId: string): Promise<CampaignRow | null> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function listCampaigns(
  workspaceId: string,
  opts?: { status?: CampaignStatus; limit?: number }
): Promise<CampaignRow[]> {
  let q = sniperSupabaseDb
    .from('sniper_campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (opts?.status) q = q.eq('status', opts.status);
  q = q.limit(Math.max(1, Math.min(opts?.limit ?? 100, 500)));
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any;
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<Pick<CampaignRow, 'name' | 'description' | 'status' | 'stop_on_reply' | 'lead_source_json' | 'settings_json' | 'stats_json'>>
): Promise<CampaignRow> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaigns')
    .update(patch as any)
    .eq('id', campaignId)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const { error } = await sniperSupabaseDb
    .from('sniper_campaigns')
    .delete()
    .eq('id', campaignId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Campaign Steps CRUD
// ---------------------------------------------------------------------------

export async function listCampaignSteps(campaignId: string): Promise<CampaignStepRow[]> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_order', { ascending: true });
  if (error) throw error;
  return (data || []) as any;
}

export async function upsertCampaignSteps(
  campaignId: string,
  steps: Array<{
    step_order: number;
    action_type: CampaignStepAction;
    delay_days?: number;
    delay_hours?: number;
    config_json?: any;
  }>
): Promise<CampaignStepRow[]> {
  // Delete existing steps then bulk insert (simplest approach for reorder)
  const { error: delErr } = await sniperSupabaseDb
    .from('sniper_campaign_steps')
    .delete()
    .eq('campaign_id', campaignId);
  if (delErr) throw delErr;

  if (!steps.length) return [];

  const rows = steps.map((s) => ({
    campaign_id: campaignId,
    step_order: s.step_order,
    action_type: s.action_type,
    delay_days: s.delay_days ?? 0,
    delay_hours: s.delay_hours ?? 0,
    config_json: s.config_json ?? {}
  }));

  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaign_steps')
    .insert(rows as any)
    .select('*')
    .order('step_order', { ascending: true } as any);
  if (error) throw error;
  return (data || []) as any;
}

export async function getCampaignStep(
  campaignId: string,
  stepOrder: number
): Promise<CampaignStepRow | null> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', stepOrder)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

// ---------------------------------------------------------------------------
// Enrollments CRUD
// ---------------------------------------------------------------------------

export async function enrollProfiles(
  campaignId: string,
  workspaceId: string,
  enrolledBy: string,
  profiles: Array<{
    profile_url: string;
    profile_name?: string | null;
    profile_json?: any;
    lead_id?: string | null;
  }>
): Promise<CampaignEnrollmentRow[]> {
  if (!profiles.length) return [];

  const rows = profiles.map((p) => ({
    campaign_id: campaignId,
    workspace_id: workspaceId,
    profile_url: p.profile_url,
    profile_name: p.profile_name ?? null,
    profile_json: p.profile_json ?? null,
    status: 'active' as const,
    current_step_order: 0,
    next_step_at: new Date().toISOString(), // immediately eligible for ticker
    enrolled_by: enrolledBy,
    lead_id: p.lead_id ?? null
  }));

  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaign_enrollments')
    .upsert(rows as any, { onConflict: 'campaign_id,profile_url', ignoreDuplicates: true })
    .select('*');
  if (error) throw error;
  return (data || []) as any;
}

export async function listEnrollments(
  campaignId: string,
  opts?: { status?: EnrollmentStatus; limit?: number; offset?: number }
): Promise<CampaignEnrollmentRow[]> {
  let q = sniperSupabaseDb
    .from('sniper_campaign_enrollments')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (opts?.status) q = q.eq('status', opts.status);
  const limit = Math.max(1, Math.min(opts?.limit ?? 100, 1000));
  const offset = Math.max(0, opts?.offset ?? 0);
  q = q.range(offset, offset + limit - 1);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any;
}

export async function getEnrollment(enrollmentId: string): Promise<CampaignEnrollmentRow | null> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaign_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function updateEnrollment(
  enrollmentId: string,
  patch: Partial<Pick<CampaignEnrollmentRow, 'status' | 'current_step_order' | 'next_step_at' | 'last_action_at' | 'last_job_item_id'>>
): Promise<CampaignEnrollmentRow> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaign_enrollments')
    .update(patch as any)
    .eq('id', enrollmentId)
    .select('*')
    .single();
  if (error) throw error;
  return data as any;
}

export async function countEnrollments(
  campaignId: string,
  status?: EnrollmentStatus
): Promise<number> {
  let q = sniperSupabaseDb
    .from('sniper_campaign_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);
  if (status) q = q.eq('status', status);
  const { count, error } = await q;
  if (error) throw error;
  return Number(count || 0);
}

// ---------------------------------------------------------------------------
// Ticker helpers — fetch enrollments ready to advance
// ---------------------------------------------------------------------------

export async function fetchDueEnrollments(
  limit = 50
): Promise<CampaignEnrollmentRow[]> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_campaign_enrollments')
    .select('*')
    .eq('status', 'active')
    .not('next_step_at', 'is', null)
    .lte('next_step_at', new Date().toISOString())
    .order('next_step_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as any;
}

export async function updateCampaignStats(campaignId: string): Promise<void> {
  // Aggregate enrollment counts by status
  const statuses: EnrollmentStatus[] = ['active', 'completed', 'paused', 'replied', 'bounced', 'error'];
  const counts: Record<string, number> = {};
  for (const s of statuses) {
    counts[s] = await countEnrollments(campaignId, s);
  }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  await sniperSupabaseDb
    .from('sniper_campaigns')
    .update({ stats_json: counts } as any)
    .eq('id', campaignId);
}
