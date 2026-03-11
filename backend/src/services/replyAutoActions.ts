/**
 * Reply Auto-Actions Service
 *
 * Orchestrates side effects after a sourcing reply is classified:
 *   1. Updates sourcing_leads.reply_status to the actual classification label
 *   2. Pauses active sequence enrollments when stop_on_reply is true
 *   3. Auto-moves candidates through pipeline stages based on classification
 *
 * All functions are designed to be fire-and-forget: errors are caught and
 * logged internally so they never block the webhook response.
 */

import { supabase } from '../lib/supabase';
import {
  emitZapEvent,
  ZAP_EVENT_TYPES,
  generatePipelineStageEvent,
} from '../../lib/zapEventEmitter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplyAutoActionParams {
  leadId: string;
  campaignId: string;
  classificationLabel: string; // positive|meeting_request|neutral|negative|oos|auto
  nextAction: string;
  replyId: string;
}

interface StageMapping {
  targetStageTitle: string | null;
  action: 'move' | 'notify' | 'none';
}

// ---------------------------------------------------------------------------
// Default classification → pipeline stage mapping
// ---------------------------------------------------------------------------

const DEFAULT_STAGE_MAP: Record<string, StageMapping> = {
  positive:        { targetStageTitle: 'Contacted',   action: 'move' },
  meeting_request: { targetStageTitle: 'Interviewed', action: 'move' },
  neutral:         { targetStageTitle: null,           action: 'notify' },
  negative:        { targetStageTitle: null,           action: 'notify' },
  oos:             { targetStageTitle: null,           action: 'none' },
  auto:            { targetStageTitle: null,           action: 'none' },
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function executeReplyAutoActions(params: ReplyAutoActionParams): Promise<void> {
  const { leadId, campaignId, classificationLabel, replyId } = params;

  console.log(`[replyAutoActions] Processing reply ${replyId}: label=${classificationLabel}`);

  try {
    // 1. Update lead reply_status to actual classification label
    await updateLeadReplyStatus(leadId, classificationLabel);

    // 2. Pause sequence enrollments when stop_on_reply is true
    await pauseSequenceEnrollments(leadId, campaignId);

    // 3. Auto-move candidate in pipeline based on classification
    await autoPipelineMove(leadId, campaignId, classificationLabel);

    console.log(`[replyAutoActions] Completed for reply ${replyId}`);
  } catch (err: any) {
    console.error(`[replyAutoActions] Error processing reply ${replyId}:`, err?.message || err);
  }
}

// ---------------------------------------------------------------------------
// 1. Update lead reply_status
// ---------------------------------------------------------------------------

async function updateLeadReplyStatus(leadId: string, label: string): Promise<void> {
  if (!leadId) return;

  try {
    const { error } = await supabase
      .from('sourcing_leads')
      .update({ reply_status: label })
      .eq('id', leadId);

    if (error) {
      console.warn(`[replyAutoActions] Failed to update reply_status for lead ${leadId}:`, error.message);
    }
  } catch (err: any) {
    console.warn(`[replyAutoActions] updateLeadReplyStatus error:`, err?.message);
  }
}

// ---------------------------------------------------------------------------
// 2. Pause sequence enrollments
// ---------------------------------------------------------------------------

async function pauseSequenceEnrollments(leadId: string, campaignId: string): Promise<void> {
  if (!leadId) return;

  try {
    // 2a. Resolve sourcing lead email to leads.id
    //     (sequence_enrollments.lead_id references the `leads` table, not `sourcing_leads`)
    const { data: sourcingLead } = await supabase
      .from('sourcing_leads')
      .select('email')
      .eq('id', leadId)
      .maybeSingle();

    if (!sourcingLead?.email) {
      console.log('[replyAutoActions] No email on sourcing lead, skipping sequence pause');
      return;
    }

    const email = String(sourcingLead.email).trim().toLowerCase();

    // Resolve to leads.id by email match
    // We also need userId scope — get it from the campaign owner
    const { data: campaign } = await supabase
      .from('sourcing_campaigns')
      .select('created_by')
      .eq('id', campaignId)
      .maybeSingle();

    const userId = campaign?.created_by;
    if (!userId) {
      console.log('[replyAutoActions] No campaign owner, skipping sequence pause');
      return;
    }

    const { data: baseLeadRow } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email)
      .eq('user_id', userId)
      .maybeSingle();

    const resolvedLeadId = baseLeadRow?.id;

    // Try both the sourcing lead ID and the resolved base lead ID
    const leadIdsToCheck = [leadId, resolvedLeadId].filter(Boolean) as string[];
    const uniqueIds = Array.from(new Set(leadIdsToCheck));

    // 2b. Find active sequence enrollments
    const { data: enrollments } = await supabase
      .from('sequence_enrollments')
      .select('id, sequence_id')
      .in('lead_id', uniqueIds)
      .eq('status', 'active');

    if (!enrollments || !enrollments.length) {
      console.log('[replyAutoActions] No active enrollments found');
      return;
    }

    // 2c. Load sequences to check stop_on_reply
    const seqIds = [...new Set(enrollments.map((e: any) => e.sequence_id))];
    const { data: sequences } = await supabase
      .from('message_sequences')
      .select('id, stop_on_reply')
      .in('id', seqIds);

    const stopSet = new Set(
      (sequences || []).filter((s: any) => s.stop_on_reply).map((s: any) => s.id)
    );

    const affected = enrollments.filter((e: any) => stopSet.has(e.sequence_id));
    if (!affected.length) {
      console.log('[replyAutoActions] No enrollments with stop_on_reply');
      return;
    }

    const affectedIds = affected.map((e: any) => e.id);

    // 2d. Update enrollment status to 'replied'
    await supabase
      .from('sequence_enrollments')
      .update({ status: 'replied', completed_at: new Date().toISOString() })
      .in('id', affectedIds);

    // 2e. Skip all pending step runs
    await supabase
      .from('sequence_step_runs')
      .update({ status: 'skipped' })
      .in('enrollment_id', affectedIds)
      .eq('status', 'pending');

    console.log(`[replyAutoActions] Paused ${affectedIds.length} sequence enrollment(s) on reply`);
  } catch (err: any) {
    console.warn(`[replyAutoActions] pauseSequenceEnrollments error:`, err?.message);
  }
}

// ---------------------------------------------------------------------------
// 3. Auto-move candidate in pipeline
// ---------------------------------------------------------------------------

async function autoPipelineMove(
  leadId: string,
  campaignId: string,
  label: string
): Promise<void> {
  const mapping = DEFAULT_STAGE_MAP[label] || { targetStageTitle: null, action: 'none' };
  if (mapping.action !== 'move' || !mapping.targetStageTitle) {
    return; // Nothing to auto-move for this classification
  }

  try {
    // 3a. Get sourcing lead email
    const { data: sourcingLead } = await supabase
      .from('sourcing_leads')
      .select('email, name')
      .eq('id', leadId)
      .maybeSingle();

    if (!sourcingLead?.email) {
      console.log('[replyAutoActions] No email on sourcing lead, skipping pipeline move');
      return;
    }

    const email = String(sourcingLead.email).trim().toLowerCase();

    // 3b. Get campaign owner (userId)
    const { data: campaign } = await supabase
      .from('sourcing_campaigns')
      .select('created_by')
      .eq('id', campaignId)
      .maybeSingle();

    const userId = campaign?.created_by;
    if (!userId) {
      console.log('[replyAutoActions] No campaign owner, skipping pipeline move');
      return;
    }

    // 3c. Resolve sourcing lead email → candidates table
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id')
      .eq('user_id', userId)
      .ilike('email', email)
      .limit(5);

    if (!candidates || !candidates.length) {
      console.log(`[replyAutoActions] No matching candidate found for email ${email}, skipping pipeline move`);
      return;
    }

    const candidateIds = candidates.map((c: any) => c.id);

    // 3d. Get all candidate_jobs for matched candidates
    const { data: candidateJobs } = await supabase
      .from('candidate_jobs')
      .select('id, candidate_id, job_id, stage_id')
      .in('candidate_id', candidateIds);

    if (!candidateJobs || !candidateJobs.length) {
      console.log('[replyAutoActions] No candidate_jobs found, skipping pipeline move');
      return;
    }

    // 3e. For each candidate_job, resolve target stage and move
    let moved = 0;
    for (const cj of candidateJobs) {
      try {
        const targetStageId = await resolveStageForJob(cj.job_id, mapping.targetStageTitle);
        if (!targetStageId) {
          console.log(`[replyAutoActions] Stage "${mapping.targetStageTitle}" not found for job ${cj.job_id}, skipping`);
          continue;
        }

        // Skip if already at this stage
        if (cj.stage_id === targetStageId) continue;

        // Update candidate_jobs.stage_id
        const now = new Date().toISOString();
        const { error: updError } = await supabase
          .from('candidate_jobs')
          .update({ stage_id: targetStageId, updated_at: now })
          .eq('id', cj.id);

        // Fallback to status column if stage_id column doesn't exist
        if (updError && (updError as any).code === '42703') {
          const canonical = mapStageTitleToStatus(mapping.targetStageTitle);
          await supabase
            .from('candidate_jobs')
            .update({ status: canonical, updated_at: now })
            .eq('id', cj.id);
        } else if (updError) {
          console.warn(`[replyAutoActions] Failed to update candidate_job ${cj.id}:`, updError.message);
          continue;
        }

        moved++;

        // Emit Zap events for the move
        await emitZapEvent({
          userId,
          eventType: ZAP_EVENT_TYPES.CANDIDATE_MOVED_TO_STAGE,
          eventData: {
            job_id: cj.job_id,
            candidate_id: cj.candidate_id,
            stage_id: targetStageId,
            trigger: 'reply_auto_classification',
            classification: label,
          },
        });

        // Emit dynamic stage event
        const dynEvent = generatePipelineStageEvent(mapping.targetStageTitle, 'moved_to');
        await emitZapEvent({
          userId,
          eventType: dynEvent as any,
          eventData: {
            job_id: cj.job_id,
            candidate_id: cj.candidate_id,
            stage_id: targetStageId,
          },
        });
      } catch (innerErr: any) {
        console.warn(`[replyAutoActions] Error moving candidate_job ${cj.id}:`, innerErr?.message);
      }
    }

    if (moved > 0) {
      console.log(`[replyAutoActions] Auto-moved ${moved} candidate(s) to "${mapping.targetStageTitle}"`);
    }
  } catch (err: any) {
    console.warn(`[replyAutoActions] autoPipelineMove error:`, err?.message);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a stage title to a pipeline_stages.id for a given job.
 * Follows the job → job_requisitions.pipeline_id → pipeline_stages chain.
 */
async function resolveStageForJob(jobId: string, stageTitle: string): Promise<string | null> {
  try {
    // Get the pipeline_id from job_requisitions
    const { data: job } = await supabase
      .from('job_requisitions')
      .select('pipeline_id')
      .eq('id', jobId)
      .maybeSingle();

    if (!job?.pipeline_id) {
      // Fallback: try pipeline_stages directly by job_id (older schema)
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('job_id', jobId)
        .ilike('title', stageTitle)
        .maybeSingle();
      return stage?.id || null;
    }

    // Look up stage by pipeline_id + title
    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', job.pipeline_id)
      .ilike('title', stageTitle)
      .maybeSingle();

    return stage?.id || null;
  } catch {
    return null;
  }
}

/**
 * Map a stage title to a canonical candidate_jobs.status enum value.
 * Used as fallback when stage_id column doesn't exist.
 */
function mapStageTitleToStatus(title: string): string {
  const t = String(title || '').toLowerCase();
  if (t.includes('source')) return 'sourced';
  if (t.includes('contact')) return 'contacted';
  if (t.includes('interview')) return 'interviewed';
  if (t.includes('offer')) return 'offered';
  if (t.includes('hire')) return 'hired';
  if (t.includes('reject')) return 'rejected';
  return 'contacted'; // safe default
}
