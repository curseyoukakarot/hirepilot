import { supabaseAdmin } from '../lib/supabaseAdmin';
import { logger } from '../lib/logger';
import { ScenarioContext, ScenarioResult } from './types';

type ScenarioHandler = (ctx: ScenarioContext) => Promise<ScenarioResult>;

function placeholderScenario(name: string, notes: string): ScenarioHandler {
  return async (ctx) => {
    void ctx; // Reserved for future Supabase interactions inside the scenario.
    logger.info({ name }, '[repoAgent][scenarioRunner] Executing placeholder scenario');
    // TODO: Replace with real synthetic flow invoking APIs via ctx.supabase when flows are defined.
    return {
      status: 'pass',
      logs: `${name} simulated run completed. ${notes}`,
    };
  };
}

const scenarioRegistry: Record<string, ScenarioHandler> = {
  PlanGatingScenario: placeholderScenario(
    'PlanGatingScenario',
    'Validate plan permissions between Free vs Pro accounts.'
  ),
  LeadToCandidateFlowScenario: placeholderScenario(
    'LeadToCandidateFlowScenario',
    'Walk through creating a lead, converting to candidate, and logging activity.'
  ),
  TeamVisibilityScenario: placeholderScenario(
    'TeamVisibilityScenario',
    'Ensure team-level access controls enforce visibility rules.'
  ),
  TeamSharingToggleScenario: placeholderScenario(
    'TeamSharingToggleScenario',
    'Verify toggling sharing states reflects across team members.'
  ),
  ApolloIntegrationScenario: placeholderScenario(
    'ApolloIntegrationScenario',
    'Exercise Apollo integration syncs and data ingestion.'
  ),
};

export async function runScenarioById(
  scenarioId: string
): Promise<{ runId: string; result: ScenarioResult }> {
  const { data: scenario, error: scenarioError } = await supabaseAdmin
    .from('repo_scenarios')
    .select('*')
    .eq('id', scenarioId)
    .maybeSingle();

  if (scenarioError || !scenario) {
    throw scenarioError || new Error('Scenario not found');
  }

  const handler = scenarioRegistry[scenario.name];
  if (!handler) {
    logger.warn({ scenario }, '[repoAgent][scenarioRunner] Scenario not implemented');
  }

  const { data: run, error: runInsertError } = await supabaseAdmin
    .from('repo_scenario_runs')
    .insert([
      {
        scenario_id: scenarioId,
        status: 'running',
        started_at: new Date().toISOString(),
      },
    ])
    .select('*')
    .single();

  if (runInsertError || !run) {
    throw runInsertError || new Error('Failed to create scenario run');
  }

  const runId = run.id;
  let result: ScenarioResult = { status: 'never_run', logs: 'No handler registered.' };

  try {
    if (!scenario.active) {
      result = { status: 'never_run', logs: 'Scenario inactive; skipping execution.' };
    } else if (!handler) {
      result = {
        status: 'fail',
        logs: `Scenario ${scenario.name} has no handler registered.`,
      };
    } else {
      result = await handler({ supabase: supabaseAdmin });
    }
  } catch (error: any) {
    logger.error({ error, scenarioId }, '[repoAgent][scenarioRunner] Scenario execution failed');
    result = {
      status: 'fail',
      failingStep: result.failingStep || 'runtime',
      logs: `Scenario threw: ${error?.message || error}`,
    };
  }

  await supabaseAdmin
    .from('repo_scenario_runs')
    .update({
      status: result.status,
      finished_at: new Date().toISOString(),
      failing_step: result.failingStep || null,
      logs: result.logs || null,
    })
    .eq('id', runId);

  return { runId, result };
}

