import { supabase } from './supabase';
import { sendEmail } from '../../services/emailService';

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

const STEP_LABELS: Record<StepKey, string> = {
  resume_generated: 'Generate Resume',
  target_role_set: 'Define Target Role',
  rex_chat_activated: 'Activate REX Chat',
  outreach_angles_created: 'Generate Outreach Angles',
  landing_page_published: 'Publish Landing Page',
  email_connected: 'Connect Email Account',
  chrome_extension_installed: 'Install Chrome Extension',
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
  const completion: OnboardingCompletion = {
    awarded: amount,
    alreadyCompleted: false,
    totalCompleted: totals.completed,
    totalSteps,
    totalCreditsAwarded: totals.credits,
    step,
  };

  try {
    await maybeSendOnboardingEmail(userId, completion, STEP_LABELS[step]);
  } catch (emailErr) {
    console.error('onboarding email send failed', emailErr);
  }

  return completion;
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

/**
 * Backfill credit ledger for already-completed onboarding steps.
 * Useful when progress rows exist but credits/ledger didn't get written.
 */
export async function reconcileOnboardingCredits(userId: string) {
  const { data: steps, error } = await supabase
    .from('job_seeker_onboarding_progress')
    .select('step_key, metadata')
    .eq('user_id', userId);
  if (error) throw error;

  let awarded = 0;
  for (const row of steps || []) {
    const step = row.step_key as StepKey;
    const amount = STEP_CREDITS[step] || 0;
    if (!amount) continue;
    // check if ledger already has this step
    const { data: ledgerRows, error: ledgerErr } = await supabase
      .from('credit_ledger')
      .select('id')
      .eq('user_id', userId)
      .eq('reason', 'onboarding_step')
      .eq('ref_key', step);
    if (ledgerErr) throw ledgerErr;
    if (ledgerRows && ledgerRows.length > 0) continue;

    // insert ledger + increment credits
    const { error: insertErr } = await supabase.from('credit_ledger').insert({
      user_id: userId,
      amount,
      reason: 'onboarding_step',
      ref_key: step,
      metadata: row.metadata || {},
    });
    if (insertErr && !String(insertErr.message || '').toLowerCase().includes('duplicate')) {
      throw insertErr;
    }
    try {
      await supabase.rpc('increment_user_credits', { target_user_id: userId, credit_delta: amount });
    } catch (e) {
      // non-blocking
    }
    awarded += amount;
  }
  const totals = await fetchTotals(userId);
  return { awarded, total_credits_awarded: totals.credits, total_completed: totals.completed, total_steps: Object.keys(STEP_CREDITS).length };
}

async function fetchUserEmail(userId: string): Promise<{ email: string | null }> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;
    return { email: data?.user?.email || null };
  } catch (e) {
    console.error('fetchUserEmail failed', e);
    return { email: null };
  }
}

async function maybeSendOnboardingEmail(userId: string, completion: OnboardingCompletion, stepLabel: string) {
  const user = await fetchUserEmail(userId);
  if (!user?.email) return;

  const onboardingLink = process.env.JOBS_APP_URL
    ? `${process.env.JOBS_APP_URL.replace(/\/$/, '')}/onboarding`
    : 'https://jobs.thehirepilot.com/onboarding';

  const baseStyle =
    'font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a;';
  const card = (title: string, body: string) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background: #0b1220; padding: 32px;">
      <tr>
        <td>
          <div style="background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.12)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; ${baseStyle}">
            <div style="color: #a5b4fc; letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; font-weight: 700;">Job Search Setup</div>
            <h1 style="margin: 8px 0 12px 0; font-size: 24px; color: #e2e8f0;">${title}</h1>
            <div style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">${body}</div>
            <div style="margin-top: 22px;">
              <a href="${onboardingLink}" style="display: inline-block; padding: 12px 16px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; box-shadow: 0 10px 30px rgba(79,70,229,0.35);">
                Continue setup
              </a>
            </div>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">Earn up to 100 credits by completing all 7 steps.</p>
        </td>
      </tr>
    </table>
  `;

  // Per-step email (only when newly completed)
  if (!completion.alreadyCompleted) {
    const stepHtml = card(
      `You completed: ${stepLabel}`,
      `Nice work! You just completed <strong>${stepLabel}</strong> and earned <strong>+${completion.awarded} credits</strong>.<br><br>
       Progress: <strong>${completion.totalCompleted} of ${completion.totalSteps}</strong> steps, <strong>${completion.totalCreditsAwarded}/100</strong> credits unlocked.`
    );

    await sendEmail(
      user.email,
      `Onboarding progress: ${stepLabel} complete (+${completion.awarded})`,
      `You completed ${stepLabel} and earned ${completion.awarded} credits. Continue at ${onboardingLink}`,
      stepHtml
    );
  }

  // Completion email when all steps done
  if (completion.totalCompleted === completion.totalSteps) {
    const doneHtml = card(
      'You finished the onboarding!',
      `Congrats! You completed all ${completion.totalSteps} steps and unlocked <strong>${completion.totalCreditsAwarded} credits</strong>.`
    );
    await sendEmail(
      user.email,
      'You finished your HirePilot onboarding! (+100 credits)',
      `You finished onboarding and unlocked ${completion.totalCreditsAwarded} credits. Continue at ${onboardingLink}`,
      doneHtml
    );
  }
}

