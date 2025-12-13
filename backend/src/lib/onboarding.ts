import { supabase } from './supabase';

export type StepKey =
  | 'resume_generated'
  | 'target_role_set'
  | 'rex_chat_activated'
  | 'outreach_angles_created'
  | 'landing_page_published'
  | 'email_connected'
  | 'chrome_extension_installed';

export const STEP_CREDITS: Record<StepKey, number> = {
  resume_generated: 20,
  target_role_set: 10,
  rex_chat_activated: 10,
  outreach_angles_created: 15,
  landing_page_published: 15,
  email_connected: 15,
  chrome_extension_installed: 15,
};

export type OnboardingCompletion = {
  awarded: number;
  alreadyCompleted: boolean;
  totalCompleted: number;
  totalSteps: number;
  totalCreditsAwarded: number;
  step: StepKey;
};

/**
 * Idempotently completes an onboarding step, awards credits once, and returns progress.
 */
export async function completeOnboardingStep(
  userId: string,
  step: StepKey,
  metadata: Record<string, any> = {}
): Promise<OnboardingCompletion> {
  const amount = STEP_CREDITS[step] || 0;
  const totalSteps = Object.keys(STEP_CREDITS).length;

  // Check existing completion
  const { data: existing, error: existingErr } = await supabase
    .from('job_seeker_onboarding_progress')
    .select('step_key')
    .eq('user_id', userId)
    .eq('step_key', step)
    .maybeSingle();
  if (existingErr) throw existingErr;

  if (existing) {
    const totals = await fetchTotals(userId);
    return {
      awarded: 0,
      alreadyCompleted: true,
      totalCompleted: totals.completed,
      totalSteps,
      totalCreditsAwarded: totals.credits,
      step,
    };
  }

  // Insert progress row
  const { error: insertErr } = await supabase
    .from('job_seeker_onboarding_progress')
    .insert({ user_id: userId, step_key: step, metadata });
  if (insertErr) throw insertErr;

  // Award credits via credit_ledger (guarded unique index)
  if (amount > 0) {
    const { error: ledgerErr } = await supabase.from('credit_ledger').insert({
      user_id: userId,
      amount,
      reason: 'onboarding_step',
      ref_key: step,
    });
    // ignore unique violation (already awarded)
    if (ledgerErr && !String(ledgerErr.message || '').toLowerCase().includes('duplicate')) {
      throw ledgerErr;
    }

    // Update user credits (assumes users table has credits numeric)
    await supabase.rpc('increment_user_credits', { target_user_id: userId, credit_delta: amount }).catch(() => {});
  }

  const totals = await fetchTotals(userId);
  return {
    awarded: amount,
    alreadyCompleted: false,
    totalCompleted: totals.completed,
    totalSteps,
    totalCreditsAwarded: totals.credits,
    step,
  };
}

async function fetchTotals(userId: string): Promise<{ completed: number; credits: number }> {
  const [{ data: completedRows }, { data: creditsRows }] = await Promise.all([
    supabase.from('job_seeker_onboarding_progress').select('step_key', { count: 'exact' }).eq('user_id', userId),
    supabase
      .from('credit_ledger')
      .select('amount')
      .eq('user_id', userId)
      .eq('reason', 'onboarding_step'),
  ]);

  const completed = (completedRows as any)?.length || 0;
  const credits = (creditsRows as any)?.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0) || 0;

  return { completed, credits };
}

export async function fetchOnboardingProgress(userId: string) {
  const { data: rows, error } = await supabase
    .from('job_seeker_onboarding_progress')
    .select('step_key, completed_at, metadata')
    .eq('user_id', userId);
  if (error) throw error;

  const steps = (rows || []).map((row) => ({
    step_key: row.step_key as StepKey,
    completed_at: row.completed_at,
    metadata: row.metadata || {},
    credits: STEP_CREDITS[row.step_key as StepKey] || 0,
  }));

  const totals = await fetchTotals(userId);

  return {
    steps,
    total_completed: totals.completed,
    total_credits_awarded: totals.credits,
    total_steps: Object.keys(STEP_CREDITS).length,
  };
}

