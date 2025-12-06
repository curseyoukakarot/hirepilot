import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { SweepResult } from './types';

type SweepHandler = () => Promise<SweepResult>;

async function headCount(table: string, filters: (query: any) => any): Promise<number> {
  const base = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
  const query = filters(base);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

const sweepRegistry: Record<string, SweepHandler> = {
  OrphanedEntitySweep: async () => {
    const candidatesWithoutLead = await headCount('candidates', (q: any) => q.is('lead_id', null));
    const leadsWithoutOwner = await headCount('leads', (q: any) => q.is('user_id', null));
    const violationCount = candidatesWithoutLead + leadsWithoutOwner;
    if (violationCount === 0) {
      return { status: 'clean', violationCount };
    }

    return {
      status: 'violations',
      violationCount,
      violationSummary: `Found ${candidatesWithoutLead} candidates without linked leads and ${leadsWithoutOwner} leads with no owner.`,
      rawReport: JSON.stringify({ candidatesWithoutLead, leadsWithoutOwner }),
    };
  },
  PlanMismatchSweep: async () => {
    const { data: subs, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan_tier')
      .not('plan_tier', 'is', null);
    if (subsError) throw subsError;

    const userIds = (subs || []).map((row) => row.user_id).filter(Boolean);
    let usersMap: Record<string, string> = {};

    if (userIds.length) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, plan')
        .in('id', userIds);
      if (usersError) throw usersError;
      usersMap = (users || []).reduce<Record<string, string>>((acc, row: any) => {
        acc[row.id] = String(row.plan || '').toLowerCase();
        return acc;
      }, {});
    }

    const mismatches = (subs || []).filter((row: any) => {
      const subscriptionPlan = String(row.plan_tier || '').toLowerCase();
      const userPlan = usersMap[row.user_id] || '';
      return subscriptionPlan && userPlan && subscriptionPlan !== userPlan;
    });

    if (!mismatches.length) {
      return { status: 'clean', violationCount: 0 };
    }

    return {
      status: 'violations',
      violationCount: mismatches.length,
      violationSummary: `${mismatches.length} users have subscription plan_tier not matching users.plan.`,
      rawReport: JSON.stringify(mismatches.slice(0, 20)),
    };
  },
  VisibilityConfigSweep: async () => {
    const teamAdminsWithoutTeam = await headCount('users', (q: any) =>
      q.eq('role', 'team_admin').is('team_id', null)
    );

    if (teamAdminsWithoutTeam === 0) {
      return { status: 'clean', violationCount: 0 };
    }

    return {
      status: 'violations',
      violationCount: teamAdminsWithoutTeam,
      violationSummary: `${teamAdminsWithoutTeam} team_admin users are missing team assignments.`,
    };
  },
};

export async function runSweepById(
  sweepId: string
): Promise<{ runId: string; result: SweepResult }> {
  const { data: sweep, error: sweepError } = await supabaseAdmin
    .from('repo_integrity_sweeps')
    .select('*')
    .eq('id', sweepId)
    .maybeSingle();

  if (sweepError || !sweep) {
    throw sweepError || new Error('Sweep not found');
  }

  const handler = sweepRegistry[sweep.name];

  const { data: run, error: insertError } = await supabaseAdmin
    .from('repo_integrity_sweep_runs')
    .insert([
      {
        sweep_id: sweepId,
        status: 'running',
        started_at: new Date().toISOString(),
      },
    ])
    .select('*')
    .single();

  if (insertError || !run) {
    throw insertError || new Error('Failed to create sweep run');
  }

  const runId = run.id;
  let result: SweepResult = { status: 'never_run' };

  try {
    if (!sweep.active) {
      result = { status: 'never_run', violationSummary: 'Sweep inactive' };
    } else if (!handler) {
      result = { status: 'violations', violationSummary: 'Handler not implemented' };
    } else {
      result = await handler();
    }
  } catch (error: any) {
    logger.error({ error, sweepId }, '[repoAgent][sweepRunner] Sweep execution failed');
    result = {
      status: 'violations',
      violationSummary: `Sweep failed: ${error?.message || error}`,
    };
  }

  await supabaseAdmin
    .from('repo_integrity_sweep_runs')
    .update({
      status: result.status,
      finished_at: new Date().toISOString(),
      violation_summary: result.violationSummary || null,
      violation_count:
        typeof result.violationCount === 'number' ? result.violationCount : null,
      raw_report: result.rawReport || null,
    })
    .eq('id', runId);

  return { runId, result };
}

