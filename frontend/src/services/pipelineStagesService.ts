import { supabase } from '../lib/supabaseClient';

export interface PipelineStage {
  id: string;
  job_id: string;
  title: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export const getPipelineStages = async (jobId: string): Promise<PipelineStage[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('job_id', jobId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data;
};

export const createPipelineStage = async (
  jobId: string,
  title: string,
  color: string,
  position: number
): Promise<PipelineStage> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      job_id: jobId,
      title,
      color,
      position
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updatePipelineStage = async (
  stageId: string,
  updates: Partial<PipelineStage>
): Promise<PipelineStage> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pipeline_stages')
    .update(updates)
    .eq('id', stageId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deletePipelineStage = async (stageId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId);

  if (error) throw error;
};

export const reorderPipelineStages = async (
  stages: { id: string; position: number }[]
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('pipeline_stages')
    .upsert(stages);

  if (error) throw error;
};

export interface PipelineCandidate {
  job_candidate_id: string;
  stage: string;
  lead_id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export const fetchCandidatesForJob = async (jobId: string): Promise<Record<string, PipelineCandidate[]>> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('candidate_jobs')
    .select(`
      id,
      stage,
      lead_id,
      leads (
        id,
        name,
        email,
        avatar_url
      )
    `)
    .eq('job_id', jobId);

  if (error) throw error;
  // Group by stage
  const grouped: Record<string, PipelineCandidate[]> = {};
  (data || []).forEach((row: any) => {
    const stage = row.stage || 'unknown';
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push({
      job_candidate_id: row.id,
      stage: row.stage,
      lead_id: row.lead_id,
      name: row.leads?.name || '',
      email: row.leads?.email || '',
      avatar_url: row.leads?.avatar_url || undefined,
    });
  });
  return grouped;
}; 