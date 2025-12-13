import { supabase } from './supabase';
import { sendEmail } from '../../services/emailService';

export type AppStepKey =
  | 'app_campaign_created'
  | 'app_persona_created'
  | 'app_leads_added'
  | 'app_message_generated'
  | 'app_email_connected'
  | 'app_onboarding_complete';

const STEP_CREDITS: Record<AppStepKey, number> = {
  app_campaign_created: 20,
  app_persona_created: 20,
  app_leads_added: 20,
  app_message_generated: 20,
  app_email_connected: 20,
  app_onboarding_complete: 100,
};

const STEP_LABELS: Record<AppStepKey, string> = {
  app_campaign_created: 'Create your first campaign',
  app_persona_created: 'Define your target persona',
  app_leads_added: 'Add leads to your campaign',
  app_message_generated: 'Generate a message with REX',
  app_email_connected: 'Connect your email',
  app_onboarding_complete: 'Complete setup',
};

type Role = 'member' | 'admin' | 'team_admin' | 'RecruitPro' | 'super_admin' | 'free' | string;

export async function completeAppOnboardingStep(userId: string, step: AppStepKey, metadata: Record<string, any> = {}) {
  const { isPaid, role } = await fetchRole(userId);

  // Skip persona step for free users (mark completed, 0 credits)
  if (step === 'app_persona_created' && role === 'free') {
    await upsertProgress(userId, step, metadata);
    return buildProgress(userId, step, 0, true, isPaid);
  }

  // completion key only after all required done
  if (step === 'app_onboarding_complete') {
    return buildProgress(userId, step, isPaid ? STEP_CREDITS[step] : 0, isPaid, isPaid);
  }

  // Credits only for paid roles
  const amount = isPaid ? STEP_CREDITS[step] : 0;
  await upsertProgress(userId, step, metadata);
  if (amount > 0) {
    await awardCredits(userId, step, amount);
  }

  // If all required steps done, auto-complete onboarding_complete for paid
  const progress = await buildProgress(userId, step, amount, isPaid, isPaid);
  if (isPaid && progress.totalCompletedRequired === progress.requiredSteps.length) {
    const alreadyComplete = progress.steps.some((s) => s.step_key === 'app_onboarding_complete');
    if (!alreadyComplete) {
      await upsertProgress(userId, 'app_onboarding_complete', {});
      await awardCredits(userId, 'app_onboarding_complete', STEP_CREDITS['app_onboarding_complete']);
      await sendCompletionEmail(userId, STEP_CREDITS['app_onboarding_complete'], progress.totalCreditsAwarded + STEP_CREDITS['app_onboarding_complete']);
    }
  }

  // Send step email for paid users
  if (isPaid && step !== 'app_onboarding_complete') {
    await sendStepEmail(userId, step, amount);
  }

  return progress;
}

export async function fetchAppOnboardingProgress(userId: string) {
  const { isPaid } = await fetchRole(userId);
  return buildProgress(userId, 'app_campaign_created', 0, isPaid, isPaid);
}

async function upsertProgress(userId: string, step: AppStepKey, metadata: Record<string, any>) {
  const { error } = await supabase
    .from('app_onboarding_progress')
    .upsert({ user_id: userId, step_key: step, metadata }, { onConflict: 'user_id,step_key' });
  if (error) throw error;
}

async function awardCredits(userId: string, step: AppStepKey, amount: number) {
  const { error } = await supabase.from('credit_ledger').insert({
    user_id: userId,
    amount,
    reason: 'app_onboarding_step',
    ref_key: step,
  });
  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
  await supabase.rpc('increment_user_credits', { target_user_id: userId, credit_delta: amount }).catch(() => {});
}

async function fetchRole(userId: string): Promise<{ isPaid: boolean; role: Role }> {
  let role: Role = 'free';
  try {
    const { data, error } = await supabase
      .from('users')
      .select('plan, role, account_type')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) {
      role = (data.role || data.account_type || data.plan || '').toString() as Role;
    }
  } catch {}
  const normalized = String(role || '').toLowerCase();
  const paidRoles = ['member', 'admin', 'team_admin', 'recruitpro', 'super_admin'];
  const isPaid = paidRoles.includes(normalized);
  return { isPaid, role };
}

async function buildProgress(userId: string, lastStep: AppStepKey, lastAward: number, isPaid: boolean, includeCompletion: boolean) {
  const requiredSteps: AppStepKey[] = ['app_campaign_created', 'app_leads_added', 'app_message_generated', 'app_email_connected'];
  if (isPaid) requiredSteps.splice(1, 0, 'app_persona_created'); // insert persona for paid roles

  const { data } = await supabase
    .from('app_onboarding_progress')
    .select('step_key, completed_at, metadata')
    .eq('user_id', userId);

  const steps = (data || []).map((row) => ({
    step_key: row.step_key as AppStepKey,
    completed_at: row.completed_at,
    metadata: row.metadata || {},
    credits: STEP_CREDITS[row.step_key as AppStepKey] || 0,
  }));

  const completedRequired = steps.filter((s) => requiredSteps.includes(s.step_key)).length;
  const totalCreditsAwarded = steps
    .filter((s) => s.step_key !== 'app_persona_created' || isPaid) // persona credit only if paid
    .reduce((sum, s) => sum + (STEP_CREDITS[s.step_key] || 0), 0);

  return {
    steps,
    requiredSteps,
    totalCompletedRequired: completedRequired,
    totalSteps: requiredSteps.length,
    totalCreditsAwarded,
    lastStep,
    lastAward,
  };
}

async function fetchUserEmail(userId: string): Promise<{ email: string | null; name: string | null }> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;
    const meta = data?.user?.user_metadata || {};
    const name = meta.full_name || meta.name || meta.first_name || meta.firstName || null;
    return { email: data?.user?.email || null, name };
  } catch (e) {
    console.error('fetchUserEmail failed', e);
    return { email: null, name: null };
  }
}

async function sendStepEmail(userId: string, step: AppStepKey, amount: number) {
  const user = await fetchUserEmail(userId);
  if (!user.email) return;
  const onboardingLink = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/onboarding` : 'https://app.thehirepilot.com/onboarding';
  const baseStyle = 'font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a;';
  const html = `
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background: #0b1220; padding: 32px;">
    <tr><td>
      <div style="background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.12)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; ${baseStyle}">
        <div style="color: #a5b4fc; letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; font-weight: 700;">HirePilot Setup</div>
        <h1 style="margin: 8px 0 12px 0; font-size: 24px; color: #e2e8f0;">You earned +${amount} credits</h1>
        <div style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
          Nice work! You completed <strong>${STEP_LABELS[step]}</strong>.<br/>
          Continue your setup to unlock the full +100 credit bonus.
        </div>
        <div style="margin-top: 22px;">
          <a href="${onboardingLink}" style="display: inline-block; padding: 12px 16px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; box-shadow: 0 10px 30px rgba(79,70,229,0.35);">
            Continue setup
          </a>
        </div>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">Earn up to 100 credits by completing all 5 steps.</p>
    </td></tr>
  </table>`;

  await sendEmail(
    user.email,
    `You earned +${amount} HirePilot credits`,
    `You completed ${STEP_LABELS[step]} and earned +${amount} credits. Continue at ${onboardingLink}`,
    html
  );
}

async function sendCompletionEmail(userId: string, amount: number, totalCredits: number) {
  const user = await fetchUserEmail(userId);
  if (!user.email) return;
  const campaignsLink = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/campaigns` : 'https://app.thehirepilot.com/campaigns';
  const baseStyle = 'font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a;';
  const html = `
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background: #0b1220; padding: 32px;">
    <tr><td>
      <div style="background: linear-gradient(135deg, rgba(52,211,153,0.18), rgba(34,197,94,0.14)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; ${baseStyle}">
        <div style="color: #bbf7d0; letter-spacing: 0.12em; text-transform: uppercase; font-size: 12px; font-weight: 700;">Activation</div>
        <h1 style="margin: 8px 0 12px 0; font-size: 24px; color: #ecfdf3;">You’re activated 🚀</h1>
        <div style="font-size: 15px; line-height: 1.6; color: #d1fae5;">
          Setup complete. You earned <strong>+${amount} credits</strong> (total <strong>${totalCredits}</strong>).<br/>
          Go run your first campaign!
        </div>
        <div style="margin-top: 22px;">
          <a href="${campaignsLink}" style="display: inline-block; padding: 12px 16px; background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; box-shadow: 0 10px 30px rgba(34,197,94,0.35);">
            Go to Campaigns
          </a>
        </div>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #86efac; text-align: center;">Welcome to the full HirePilot workflow.</p>
    </td></tr>
  </table>`;

  await sendEmail(
    user.email,
    'Your HirePilot setup is complete 🚀',
    `You finished setup and earned ${totalCredits} credits. Go to Campaigns: ${campaignsLink}`,
    html
  );
}
