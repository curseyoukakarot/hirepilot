import { supabaseDb } from './supabase';

export async function createPipelineWithDefaultStages(jobId: string, jobTitle: string, userId?: string) {
  try {
    // Get user_id from job if not provided
    if (!userId) {
      const { data: job, error: jobError } = await supabaseDb
        .from('job_requisitions')
        .select('user_id')
        .eq('id', jobId)
        .single();
      
      if (jobError || !job) {
        throw new Error(`Job not found: ${jobError?.message || 'Unknown error'}`);
      }
      userId = job.user_id;
    }

    // 1. Create pipeline
    const { data: pipeline, error: pipeError } = await supabaseDb
      .from('pipelines')
      .insert([{ 
        job_id: jobId,
        user_id: userId,
        name: `${jobTitle} Pipeline`,
        department: ''
      }])
      .select('id')
      .single();

    if (pipeError) {
      console.error('Pipeline creation error:', pipeError);
      throw new Error(`Pipeline creation failed: ${pipeError.message}`);
    }

    // 2. Seed default stages
    const defaultStages = [
      { name: 'Sourced', color: '#3B82F6' },
      { name: 'Contacted', color: '#10B981' },
      { name: 'Interviewed', color: '#F59E0B' },
      { name: 'Offered', color: '#8B5CF6' },
      { name: 'Hired', color: '#059669' }
    ].map((stage, idx) => ({
      pipeline_id: pipeline.id,
      title: stage.name,
      color: stage.color,
      position: idx + 1
    }));

    const { error: stageError } = await supabaseDb
      .from('pipeline_stages')
      .insert(defaultStages);

    if (stageError) {
      console.error('Stage creation error:', stageError);
      throw new Error(`Stage creation failed: ${stageError.message}`);
    }

    console.log(`✅ Created pipeline with ${defaultStages.length} default stages for job ${jobId}`);
    return pipeline;
  } catch (error) {
    console.error('createPipelineWithDefaultStages error:', error);
    throw error;
  }
}

export async function ensurePipelineExists(jobId: string, jobTitle: string) {
  try {
    // Check if pipeline already exists for this job
    const { data: existingPipeline, error: checkError } = await supabaseDb
      .from('pipelines')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle();

    if (checkError) {
      console.error('Pipeline check error:', checkError);
      throw new Error(`Pipeline check failed: ${checkError.message}`);
    }

    if (existingPipeline) {
      console.log(`Pipeline already exists for job ${jobId}`);
      return existingPipeline;
    }

    // Create pipeline if it doesn't exist
    return await createPipelineWithDefaultStages(jobId, jobTitle);
  } catch (error) {
    console.error('ensurePipelineExists error:', error);
    throw error;
  }
}
