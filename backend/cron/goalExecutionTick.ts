/**
 * Goal execution cron tick.
 *
 * Drives `running` goals forward without user clicks. Designed to slot into
 * the existing cron scheduler (`backend/cron/scheduler.ts`) — runs once per
 * tick, advances each eligible goal by ONE step, returns. Slow steps don't
 * block the cron loop because each tick caps the work it does.
 *
 * Safety guardrails:
 *   - Skip goals with an in-flight log row (status='running' on
 *     goal_step_logs without completed_at) — prevents double-execution if
 *     two ticks overlap or a step crashes mid-flight.
 *   - Hard cap on goals processed per tick (`MAX_GOALS_PER_TICK`).
 *   - Per-goal stuck detection: if a step has been 'running' on the log for
 *     more than `STUCK_THRESHOLD_MS`, mark it failed and unlock the goal so
 *     the next tick can pick it up.
 */

import { supabaseDb } from '../lib/supabase';

const MAX_GOALS_PER_TICK = 10;       // cap to keep ticks fast under load
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5min — a step running this long is dead

interface RunningGoal {
  id: string;
  workspace_id: string;
  owner_id: string;
}

/**
 * Single cron tick. Idempotent and safe to call repeatedly.
 * Returns counters for visibility (logged by the scheduler).
 */
export async function runGoalExecutionTick(): Promise<{
  processed: number;
  advanced: number;
  skipped_locked: number;
  unstuck: number;
  errors: number;
}> {
  const counters = { processed: 0, advanced: 0, skipped_locked: 0, unstuck: 0, errors: 0 };

  // 1) Find running goals (oldest first — fairness across workspaces).
  const { data: goals, error } = await supabaseDb
    .from('goals')
    .select('id, workspace_id, owner_id')
    .eq('status', 'running')
    .order('updated_at', { ascending: true })
    .limit(MAX_GOALS_PER_TICK);

  if (error) {
    console.warn('[goalExecutionTick] failed to list running goals:', error.message);
    counters.errors++;
    return counters;
  }
  if (!goals || goals.length === 0) return counters;

  // 2) Recover stuck steps (running > STUCK_THRESHOLD_MS without completion).
  //    Mark them failed so the next tick can advance the goal.
  try {
    const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();
    const { data: stuck } = await supabaseDb
      .from('goal_step_logs')
      .select('id, goal_id, step_index')
      .eq('status', 'running')
      .lt('started_at', stuckCutoff);

    for (const row of (stuck || []) as any[]) {
      await supabaseDb
        .from('goal_step_logs')
        .update({
          status: 'failed',
          error: `Step exceeded ${STUCK_THRESHOLD_MS}ms without completing — auto-unstuck.`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      counters.unstuck++;
    }
  } catch (e: any) {
    console.warn('[goalExecutionTick] unstuck pass failed:', e?.message);
  }

  // 3) For each running goal, check the lock and advance one step.
  const { executeNextStep } = await import('../src/rex/goalExecutor');

  for (const goal of goals as RunningGoal[]) {
    counters.processed++;

    // Lock check: skip if a log row is currently running for this goal.
    const { data: inFlight } = await supabaseDb
      .from('goal_step_logs')
      .select('id')
      .eq('goal_id', goal.id)
      .eq('status', 'running')
      .is('completed_at', null)
      .limit(1)
      .maybeSingle();

    if (inFlight) {
      counters.skipped_locked++;
      continue;
    }

    try {
      const result = await executeNextStep({
        workspaceId: goal.workspace_id,
        userId: goal.owner_id,
        goalId: goal.id,
      });
      counters.advanced++;
      if (process.env.GOAL_WORKER_VERBOSE === 'true') {
        console.info('[goalExecutionTick]', goal.id, '→', {
          done: result.done, status: result.goalStatus, remaining: result.remaining,
        });
      }
    } catch (e: any) {
      console.warn('[goalExecutionTick] executeNextStep error for', goal.id, ':', e?.message);
      counters.errors++;
    }
  }

  return counters;
}
