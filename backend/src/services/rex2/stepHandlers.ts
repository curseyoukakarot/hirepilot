/**
 * Real step handlers for REX v2 plan execution.
 * Each handler calls existing REX tool handlers and publishes progress events.
 * Replaces the mock handler (runMockStep) in rex2.run.worker.ts.
 */

import { buildRex2Event, publishRex2Event } from '../../rex2/pubsub';
import { openai } from '../../ai/openaiClient';
import { supabase as supabaseClient, supabaseAdmin, supabaseDb as supabaseDbClient } from '../../lib/supabase';

function getDb() {
  const db = (supabaseDbClient as any) || (supabaseAdmin as any) || (supabaseClient as any);
  if (!db || typeof db.from !== 'function') {
    throw new Error('supabase_db_client_unavailable');
  }
  return db;
}

// ---------------------------------------------------------------------------
// Types (must match rex2.run.worker.ts)
// ---------------------------------------------------------------------------

export type RunContext = {
  job_id?: string | null;
  job_title?: string | null;
  pipeline_id?: string | null;
  campaign_id?: string | null;
  lead_ids: string[];
  enriched_leads: Array<{
    id: string;
    name?: string;
    email?: string;
    title?: string;
    company?: string;
    linkedin_url?: string;
  }>;
  scored_leads: Array<{
    id: string;
    score: number;
    reason: string;
  }>;
  candidate_ids: string[];
  outreach_template?: string;
  sequence_id?: string;
};

type StepStatus = 'queued' | 'running' | 'success' | 'failure' | 'skipped';

type RunStep = {
  step_id: string;
  title?: string;
  category?: string;
  status?: StepStatus;
  depends_on?: string[];
  policy?: Record<string, any>;
  progress?: Record<string, any>;
  results?: Record<string, any>;
  errors?: Array<Record<string, any>>;
  external_refs?: Array<Record<string, any>>;
  started_at?: string | null;
  ended_at?: string | null;
  duration_ms?: number;
};

export type StepOutcome = {
  status: 'success' | 'failure' | 'skipped';
  progress: Record<string, any>;
  results: Record<string, any>;
  errors: Array<Record<string, any>>;
  external_refs: Array<Record<string, any>>;
  duration_ms: number;
  credits_used: number;
  stats_delta?: Record<string, number>;
  toolcalls?: any[];
  artifacts?: any[];
  context_updates?: Partial<RunContext>;
};

type HandlerArgs = {
  run: any;
  runId: string;
  step: RunStep;
  stepIndex: number;
  steps: RunStep[];
  context: RunContext;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getToolHandler(rexServer: any, name: string): ((args: any) => Promise<any>) | null {
  const caps = rexServer?.getCapabilities?.();
  return caps?.tools?.[name]?.handler || null;
}

function buildToolCall(runId: string, stepId: string, toolId: string, displayName: string, status: string = 'running') {
  return {
    schema_version: 'rex.toolcall.v1',
    toolcall_id: `${runId}:${stepId}:${toolId}:${Date.now()}`,
    timestamp: new Date().toISOString(),
    step_id: stepId,
    tool: { tool_id: toolId, transport: 'worker', display_name: displayName, source: { worker: 'rex2:run' } },
    status,
    input: {},
    output: {},
    metrics: { duration_ms: 0, credits_used: 0 },
    ui: { icon: null, badge: status === 'success' ? 'Complete' : status === 'failure' ? 'Failed' : 'Running', collapsible: true },
    errors: []
  };
}

function publishProgress(runId: string, stepId: string, percent: number, label: string, summary: string, metrics: Record<string, any> = {}) {
  publishRex2Event(buildRex2Event(runId, 'step.updated', {
    step_id: stepId,
    status: 'running',
    progress: { percent, label, current: Math.round(percent), total: 100 },
    results: { summary, metrics },
    external_refs: []
  }));
}

// ---------------------------------------------------------------------------
// Auto-import Sniper results into leads DB (bridge for LinkedIn sourcing)
// ---------------------------------------------------------------------------

export async function autoImportSniperResults(
  outcome: StepOutcome,
  args: HandlerArgs,
  rexServer: any
): Promise<StepOutcome> {
  const { run, runId, step, context } = args;
  const userId = String(run.user_id);

  // Only proceed if sourcing succeeded
  if (outcome.status !== 'success') return outcome;

  publishProgress(runId, step.step_id, 95, 'Importing Sniper results', 'Importing LinkedIn profiles to leads DB...');

  try {
    // 1. Extract job IDs from external_refs
    const jobIds: string[] = [];
    for (const ref of (outcome.external_refs || [])) {
      const id = ref?.id || ref?.job_id || ref?.sniper_run_id;
      if (id) jobIds.push(String(id));
    }
    if (!jobIds.length) {
      console.warn('[autoImportSniperResults] No job IDs found in external_refs');
      return outcome;
    }

    // 2. Query sniper_job_items for extracted profile URLs
    const { data: items, error: itemsErr } = await getDb()
      .from('sniper_job_items')
      .select('extracted_url,profile_url')
      .in('job_id', jobIds)
      .eq('action_type', 'extract')
      .limit(500);

    if (itemsErr) {
      console.error('[autoImportSniperResults] query sniper_job_items failed:', itemsErr);
      return outcome;
    }

    const profileUrls: string[] = [];
    for (const item of (items || [])) {
      const url = item?.extracted_url || item?.profile_url;
      if (url && typeof url === 'string' && url.includes('linkedin.com')) {
        profileUrls.push(url);
      }
    }

    if (!profileUrls.length) {
      console.warn('[autoImportSniperResults] No profile URLs found in sniper_job_items');
      return outcome;
    }

    // 3. Ensure a campaign exists for the import
    let campaignId = context.campaign_id;
    if (!campaignId) {
      const goal = run.plan_json?.goal || {};
      const { data: newCamp } = await getDb()
        .from('sourcing_campaigns')
        .insert({
          user_id: userId,
          name: `REX Plan: ${goal.title || 'LinkedIn Sourcing'}`.slice(0, 100),
          source: 'linkedin',
          status: 'active'
        })
        .select('id')
        .single();
      campaignId = newCamp?.id;
    }

    // 4. Call sniper_import_to_leads handler
    const importHandler = getToolHandler(rexServer, 'sniper_import_to_leads');
    if (importHandler) {
      const tc = buildToolCall(runId, step.step_id, 'sniper_import_to_leads', 'Import to Leads DB');
      tc.input = { profile_urls: profileUrls.length, campaign_id: campaignId };
      publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

      try {
        await importHandler({ userId, profile_urls: profileUrls, campaign_id: campaignId || undefined });
        tc.status = 'success';
        tc.output = { imported: profileUrls.length };
        tc.ui = { ...tc.ui, badge: 'Complete' };
      } catch (e: any) {
        tc.status = 'failure';
        tc.errors = [{ code: 'import_failed', message: String(e?.message || e) }];
        tc.ui = { ...tc.ui, badge: 'Failed' };
        console.error('[autoImportSniperResults] import handler failed:', e?.message);
      }
      publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
    }

    // 5. Query leads table for newly imported lead IDs
    const { data: leads } = await getDb()
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .in('linkedin_url', profileUrls)
      .limit(500);

    const leadIds = (leads || []).map((l: any) => l.id).filter(Boolean);

    publishProgress(runId, step.step_id, 100, 'Import complete', `Imported ${leadIds.length} leads from Sniper results.`);

    // 6. Return updated outcome with lead_ids
    return {
      ...outcome,
      results: {
        ...outcome.results,
        summary: `${outcome.results?.summary || ''} Auto-imported ${leadIds.length} leads from LinkedIn profiles.`
      },
      context_updates: {
        ...(outcome.context_updates || {}),
        lead_ids: leadIds,
        campaign_id: campaignId || undefined
      }
    };
  } catch (e: any) {
    console.error('[autoImportSniperResults] unexpected error:', e?.message || e);
    // Non-fatal: return original outcome
    return outcome;
  }
}

// ---------------------------------------------------------------------------
// Handler 1: Source Candidates (Apollo or Sniper)
// ---------------------------------------------------------------------------

export async function runSourceStep(args: HandlerArgs, rexServer: any): Promise<StepOutcome> {
  const { run, runId, step, context } = args;
  const stepStart = Date.now();
  const toolcalls: any[] = [];
  const userId = String(run.user_id);

  // Determine source type from plan metadata or step description
  const planText = JSON.stringify(run.plan_json || {}).toLowerCase();
  const stepText = `${step.title || ''} ${step.category || ''}`.toLowerCase();
  const isSniper = /linkedin|sniper|sales.?nav/.test(planText) || /linkedin|sniper/.test(stepText);

  // Extract filters from plan constraints
  const goal = run.plan_json?.goal || {};
  const constraints = goal.constraints || {};
  const description = String(goal.description || '').toLowerCase();

  // Try to figure out lead count from plan text
  const countMatch = description.match(/\b(\d{1,4})\s+(?:lead|candidate|profile|engineer|developer|designer|manager|recruiter)/);
  const targetCount = Math.max(10, Math.min(200, Number(countMatch?.[1] || 25)));

  publishProgress(runId, step.step_id, 10, 'Starting sourcing', `Searching for ${targetCount} candidates...`);

  if (!isSniper) {
    // Apollo path — use source_leads tool
    const handler = getToolHandler(rexServer, 'source_leads');
    if (!handler) {
      return { status: 'failure', progress: { percent: 100, label: 'Failed' }, results: { summary: 'source_leads tool not available.' }, errors: [{ code: 'tool_not_found', message: 'source_leads handler missing' }], external_refs: [], duration_ms: Date.now() - stepStart, credits_used: 0, toolcalls: [], artifacts: [] };
    }

    const tc = buildToolCall(runId, step.step_id, 'source_leads', 'Apollo Lead Search');
    toolcalls.push(tc);
    publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

    try {
      // Build filters from plan constraints
      const title = constraints.skills?.[0] || constraints.seniority?.[0] || '';
      const location = constraints.location?.[0] || '';

      // We need a campaign to source into — check if one exists or create
      let campaignId = context.campaign_id;
      if (!campaignId) {
        const { data: newCamp } = await getDb()
          .from('sourcing_campaigns')
          .insert({
            user_id: userId,
            name: `REX Plan: ${goal.title || 'Sourcing'}`.slice(0, 100),
            source: 'apollo',
            status: 'active'
          })
          .select('id')
          .single();
        campaignId = newCamp?.id;
      }

      publishProgress(runId, step.step_id, 30, 'Sourcing via Apollo', `Searching Apollo for ${title || 'candidates'} in ${location || 'any location'}...`);

      const result = await handler({
        userId,
        campaignId: campaignId || '',
        source: 'apollo',
        filters: {
          title: title || goal.title || 'Software Engineer',
          location: location || '',
          keywords: (constraints.skills || []).join(', '),
          count: targetCount
        }
      });

      // Extract lead IDs from result
      const leadIds: string[] = [];
      if (result?.leads && Array.isArray(result.leads)) {
        for (const lead of result.leads) {
          if (lead?.id) leadIds.push(lead.id);
        }
      }
      // Also try to read from campaign
      if (!leadIds.length && campaignId) {
        const { data: campLeads } = await getDb()
          .from('leads')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('user_id', userId)
          .limit(targetCount);
        if (campLeads) {
          for (const l of campLeads) leadIds.push(l.id);
        }
      }

      const foundCount = leadIds.length;
      tc.status = 'success';
      tc.output = { profiles_found: foundCount, campaign_id: campaignId };
      tc.metrics = { duration_ms: Date.now() - stepStart, credits_used: foundCount };
      tc.ui = { ...tc.ui, badge: 'Complete' };
      publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

      const artifact = {
        artifact_id: `${runId}:artifact:sourced-leads`,
        type: 'leads',
        title: `Sourced Leads (${foundCount})`,
        description: `${foundCount} leads found via Apollo.`,
        status: 'complete',
        created_at: new Date().toISOString(),
        refs: { campaign_id: campaignId, source: { type: 'apollo' } },
        preview: { kind: 'text', data: { summary: `${foundCount} candidate profiles sourced from Apollo.` } },
        actions: [],
        meta: {}
      };

      return {
        status: 'success',
        progress: { percent: 100, current: foundCount, total: Math.max(foundCount, 1), label: 'Complete' },
        results: { summary: `Sourced ${foundCount} candidates via Apollo.`, metrics: { profiles_found: foundCount, target: targetCount } },
        errors: [],
        external_refs: [],
        duration_ms: Date.now() - stepStart,
        credits_used: foundCount,
        stats_delta: { profiles_found: foundCount },
        toolcalls,
        artifacts: [artifact],
        context_updates: { lead_ids: leadIds, campaign_id: campaignId || undefined }
      };
    } catch (e: any) {
      tc.status = 'failure';
      tc.errors = [{ code: 'source_failed', message: String(e?.message || e) }];
      tc.ui = { ...tc.ui, badge: 'Failed' };
      publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
      return {
        status: 'failure',
        progress: { percent: 100, label: 'Failed' },
        results: { summary: `Source candidates failed: ${e?.message || e}` },
        errors: [{ code: 'source_failed', message: String(e?.message || e) }],
        external_refs: [],
        duration_ms: Date.now() - stepStart,
        credits_used: 0,
        toolcalls,
        artifacts: []
      };
    }
  }

  // Sniper path — delegate to existing sniper bridge (handled by worker's original runSourceCandidatesStep)
  // Return a special marker so the worker knows to use the Sniper bridge
  return {
    status: 'failure',
    progress: { percent: 0, label: 'Use Sniper' },
    results: { summary: 'DELEGATE_TO_SNIPER' },
    errors: [{ code: 'delegate_sniper', message: 'Use Sniper bridge for LinkedIn sourcing' }],
    external_refs: [],
    duration_ms: 0,
    credits_used: 0,
    toolcalls: [],
    artifacts: []
  };
}

// ---------------------------------------------------------------------------
// Handler 2: Enrich Profiles
// ---------------------------------------------------------------------------

const ENRICH_BATCH_SIZE = 5;

export async function runEnrichStep(args: HandlerArgs, rexServer: any): Promise<StepOutcome> {
  const { run, runId, step, context } = args;
  const stepStart = Date.now();
  const toolcalls: any[] = [];
  const userId = String(run.user_id);
  const leadIds = context.lead_ids || [];

  if (!leadIds.length) {
    return {
      status: 'failure',
      progress: { percent: 100, label: 'No leads' },
      results: { summary: 'No lead IDs available from previous sourcing step.' },
      errors: [{ code: 'no_leads', message: 'No lead_ids in run context.' }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls: [],
      artifacts: []
    };
  }

  const handler = getToolHandler(rexServer, 'enrich_lead');
  if (!handler) {
    return {
      status: 'failure',
      progress: { percent: 100, label: 'Failed' },
      results: { summary: 'enrich_lead tool not available.' },
      errors: [{ code: 'tool_not_found', message: 'enrich_lead handler missing' }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls: [],
      artifacts: []
    };
  }

  publishProgress(runId, step.step_id, 5, 'Starting enrichment', `Enriching ${leadIds.length} leads in batches of ${ENRICH_BATCH_SIZE}...`);

  const enrichedLeads: RunContext['enriched_leads'] = [];
  let enrichedCount = 0;
  let failedCount = 0;

  // Process in batches
  for (let i = 0; i < leadIds.length; i += ENRICH_BATCH_SIZE) {
    const batch = leadIds.slice(i, i + ENRICH_BATCH_SIZE);
    const percent = Math.min(95, Math.round(((i + batch.length) / leadIds.length) * 100));

    publishProgress(runId, step.step_id, percent, `Enriching batch ${Math.floor(i / ENRICH_BATCH_SIZE) + 1}`, `Enriched ${enrichedCount}/${leadIds.length} leads...`, { enriched: enrichedCount, failed: failedCount });

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(async (leadId) => {
        const tc = buildToolCall(runId, step.step_id, 'enrich_lead', `Enrich ${leadId.slice(0, 8)}...`);
        tc.input = { leadId };
        toolcalls.push(tc);
        publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

        try {
          const result = await handler({ userId, identifier: leadId });
          tc.status = 'success';
          tc.output = { enriched: true };
          tc.metrics = { duration_ms: Date.now() - stepStart, credits_used: 1 };
          tc.ui = { ...tc.ui, badge: 'Complete' };
          publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
          return { leadId, result };
        } catch (e: any) {
          tc.status = 'failure';
          tc.errors = [{ code: 'enrich_failed', message: String(e?.message || e) }];
          tc.ui = { ...tc.ui, badge: 'Failed' };
          publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
          throw e;
        }
      })
    );

    for (const res of results) {
      if (res.status === 'fulfilled') {
        enrichedCount++;
        // Fetch enriched lead data
        const { data: lead } = await getDb()
          .from('leads')
          .select('id,first_name,last_name,email,title,company,linkedin_url')
          .eq('id', res.value.leadId)
          .maybeSingle();
        if (lead) {
          enrichedLeads.push({
            id: lead.id,
            name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
            email: lead.email || undefined,
            title: lead.title || undefined,
            company: lead.company || undefined,
            linkedin_url: lead.linkedin_url || undefined
          });
        }
      } else {
        failedCount++;
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + ENRICH_BATCH_SIZE < leadIds.length) await sleep(500);
  }

  return {
    status: enrichedCount > 0 ? 'success' : 'failure',
    progress: { percent: 100, current: enrichedCount, total: leadIds.length, label: 'Complete' },
    results: {
      summary: `Enriched ${enrichedCount}/${leadIds.length} profiles.${failedCount ? ` ${failedCount} failed.` : ''}`,
      metrics: { enriched: enrichedCount, failed: failedCount, total: leadIds.length }
    },
    errors: failedCount ? [{ code: 'partial_failure', message: `${failedCount} leads failed enrichment.` }] : [],
    external_refs: [],
    duration_ms: Date.now() - stepStart,
    credits_used: enrichedCount,
    stats_delta: { profiles_enriched: enrichedCount },
    toolcalls,
    artifacts: [],
    context_updates: { enriched_leads: enrichedLeads }
  };
}

// ---------------------------------------------------------------------------
// Handler 3: Score & Rank Candidates
// ---------------------------------------------------------------------------

export async function runScoreStep(args: HandlerArgs, _rexServer: any): Promise<StepOutcome> {
  const { run, runId, step, context } = args;
  const stepStart = Date.now();
  const toolcalls: any[] = [];

  const enrichedLeads = context.enriched_leads || [];
  if (!enrichedLeads.length) {
    // Fall back to lead_ids if no enriched data
    if (context.lead_ids?.length) {
      // Just pass through — can't score without enrichment data
      return {
        status: 'success',
        progress: { percent: 100, label: 'Skipped (no enrichment data)' },
        results: { summary: 'Scoring skipped — no enriched lead data available. Proceeding with all leads.' },
        errors: [],
        external_refs: [],
        duration_ms: Date.now() - stepStart,
        credits_used: 0,
        toolcalls: [],
        artifacts: [],
        context_updates: {
          scored_leads: context.lead_ids.map(id => ({ id, score: 50, reason: 'Not scored — no enrichment data' }))
        }
      };
    }
    return {
      status: 'failure',
      progress: { percent: 100, label: 'No data' },
      results: { summary: 'No enriched leads to score.' },
      errors: [{ code: 'no_data', message: 'No enriched_leads in run context.' }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls: [],
      artifacts: []
    };
  }

  publishProgress(runId, step.step_id, 10, 'Building scoring prompt', `Scoring ${enrichedLeads.length} candidates against job requirements...`);

  const goal = run.plan_json?.goal || {};
  const constraints = goal.constraints || {};

  // Build candidate list for GPT
  const candidateList = enrichedLeads.slice(0, 50).map((l, i) => (
    `${i + 1}. ID: ${l.id} | Name: ${l.name || 'Unknown'} | Title: ${l.title || 'N/A'} | Company: ${l.company || 'N/A'} | Email: ${l.email ? 'Yes' : 'No'}`
  )).join('\n');

  const scoringPrompt = `Score these candidates against the job requirements. Return ONLY valid JSON.

Job: ${goal.title || context.job_title || 'Open Role'}
Description: ${String(goal.description || '').slice(0, 1000)}
Required skills: ${(constraints.skills || []).join(', ') || 'Not specified'}
Seniority: ${(constraints.seniority || []).join(', ') || 'Not specified'}
Location: ${(constraints.location || []).join(', ') || 'Not specified'}
Must have: ${(constraints.must_have || []).join(', ') || 'Not specified'}

Candidates:
${candidateList}

Return a JSON array (no markdown, no code fences):
[{"id": "uuid", "score": 0-100, "reason": "one-line explanation"}]

Score based on: title relevance (40%), company quality (20%), having verified email (20%), overall fit (20%).
Rank from highest to lowest score.`;

  const tc = buildToolCall(runId, step.step_id, 'gpt4o.score', 'AI Candidate Scoring');
  toolcalls.push(tc);
  publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

  publishProgress(runId, step.step_id, 40, 'AI scoring in progress', 'GPT-4o-mini is analyzing candidates...');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: scoringPrompt }],
      temperature: 0.3,
      max_tokens: 4000
    });

    const raw = completion.choices[0]?.message?.content || '[]';
    // Strip code fences if present
    const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();

    let scored: Array<{ id: string; score: number; reason: string }> = [];
    try {
      scored = JSON.parse(cleaned);
    } catch {
      // Try to extract array from response
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) scored = JSON.parse(match[0]);
    }

    // Sort by score descending
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Validate IDs — only keep ones that exist in our enriched leads
    const validIds = new Set(enrichedLeads.map(l => l.id));
    scored = scored.filter(s => validIds.has(s.id));

    const avgScore = scored.length ? Math.round(scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length) : 0;

    publishProgress(runId, step.step_id, 90, 'Scoring complete', `Scored ${scored.length} candidates. Average: ${avgScore}/100.`);

    tc.status = 'success';
    tc.output = { scored_count: scored.length, avg_score: avgScore, top_score: scored[0]?.score || 0 };
    tc.metrics = { duration_ms: Date.now() - stepStart, credits_used: 1 };
    tc.ui = { ...tc.ui, badge: 'Complete' };
    publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

    return {
      status: 'success',
      progress: { percent: 100, current: scored.length, total: enrichedLeads.length, label: 'Complete' },
      results: {
        summary: `Scored ${scored.length} candidates. Average score: ${avgScore}/100. Top: ${scored[0]?.score || 0}/100.`,
        metrics: { scored_count: scored.length, avg_score: avgScore, top_score: scored[0]?.score },
        quality: { score_percent: avgScore, notes: `Top candidate: ${scored[0]?.reason || 'N/A'}` }
      },
      errors: [],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 1,
      toolcalls,
      artifacts: [],
      context_updates: { scored_leads: scored }
    };
  } catch (e: any) {
    tc.status = 'failure';
    tc.errors = [{ code: 'scoring_failed', message: String(e?.message || e) }];
    tc.ui = { ...tc.ui, badge: 'Failed' };
    publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

    return {
      status: 'failure',
      progress: { percent: 100, label: 'Failed' },
      results: { summary: `Scoring failed: ${e?.message || e}` },
      errors: [{ code: 'scoring_failed', message: String(e?.message || e) }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls,
      artifacts: []
    };
  }
}

// ---------------------------------------------------------------------------
// Handler 4: Convert Leads to Candidates + Add to Pipeline
// ---------------------------------------------------------------------------

export async function runConvertStep(args: HandlerArgs, rexServer: any): Promise<StepOutcome> {
  const { run, runId, step, context } = args;
  const stepStart = Date.now();
  const toolcalls: any[] = [];
  const userId = String(run.user_id);

  // Use scored leads (top candidates) or fall back to all lead_ids
  let leadsToConvert: string[] = [];
  if (context.scored_leads?.length) {
    // Take top candidates (score >= 40 or top 20)
    const filtered = context.scored_leads.filter(s => s.score >= 40);
    leadsToConvert = (filtered.length >= 3 ? filtered : context.scored_leads.slice(0, 20)).map(s => s.id);
  } else {
    leadsToConvert = context.lead_ids || [];
  }

  if (!leadsToConvert.length) {
    return {
      status: 'failure',
      progress: { percent: 100, label: 'No leads' },
      results: { summary: 'No leads to convert to candidates.' },
      errors: [{ code: 'no_leads', message: 'No lead IDs available for conversion.' }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls: [],
      artifacts: []
    };
  }

  const convertHandler = getToolHandler(rexServer, 'convert_lead_to_candidate');
  const addToJobHandler = getToolHandler(rexServer, 'add_candidate_to_job');

  if (!convertHandler) {
    return {
      status: 'failure',
      progress: { percent: 100, label: 'Failed' },
      results: { summary: 'convert_lead_to_candidate tool not available.' },
      errors: [{ code: 'tool_not_found', message: 'convert_lead_to_candidate handler missing' }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls: [],
      artifacts: []
    };
  }

  publishProgress(runId, step.step_id, 10, 'Converting leads', `Converting ${leadsToConvert.length} leads to candidates...`);

  const candidateIds: string[] = [];
  let convertedCount = 0;
  let failedCount = 0;

  // Convert one at a time to avoid overloading
  for (let i = 0; i < leadsToConvert.length; i++) {
    const leadId = leadsToConvert[i];
    const percent = Math.min(80, Math.round(((i + 1) / leadsToConvert.length) * 80));

    const tc = buildToolCall(runId, step.step_id, 'convert_lead_to_candidate', `Convert ${leadId.slice(0, 8)}...`);
    tc.input = { leadId };
    toolcalls.push(tc);
    publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

    try {
      const result = await convertHandler({ userId, leadId });
      const candidateId = result?.candidate?.id || result?.candidateId || result?.id;
      if (candidateId) {
        candidateIds.push(candidateId);

        // If we have a job context, add candidate to pipeline
        if (context.job_id && addToJobHandler) {
          try {
            await addToJobHandler({ userId, candidateId, jobId: context.job_id });
          } catch (e: any) {
            // Non-fatal: log but continue
            console.error(`[stepHandlers] add_candidate_to_job failed for ${candidateId}:`, e?.message);
          }
        }
      }

      convertedCount++;
      tc.status = 'success';
      tc.output = { candidate_id: candidateId };
      tc.metrics = { duration_ms: Date.now() - stepStart, credits_used: 0 };
      tc.ui = { ...tc.ui, badge: 'Complete' };
    } catch (e: any) {
      failedCount++;
      tc.status = 'failure';
      tc.errors = [{ code: 'convert_failed', message: String(e?.message || e) }];
      tc.ui = { ...tc.ui, badge: 'Failed' };
    }
    publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));
    publishProgress(runId, step.step_id, percent, `Converting ${i + 1}/${leadsToConvert.length}`, `Converted ${convertedCount} leads to candidates...`);
  }

  // Final: if job context, report pipeline additions
  const pipelineSummary = context.job_id
    ? ` Added ${candidateIds.length} to job pipeline "${context.job_title || context.job_id}".`
    : '';

  return {
    status: convertedCount > 0 ? 'success' : 'failure',
    progress: { percent: 100, current: convertedCount, total: leadsToConvert.length, label: 'Complete' },
    results: {
      summary: `Converted ${convertedCount}/${leadsToConvert.length} leads to candidates.${pipelineSummary}${failedCount ? ` ${failedCount} failed.` : ''}`,
      metrics: { converted: convertedCount, failed: failedCount, added_to_pipeline: context.job_id ? candidateIds.length : 0 }
    },
    errors: failedCount ? [{ code: 'partial_failure', message: `${failedCount} conversions failed.` }] : [],
    external_refs: [],
    duration_ms: Date.now() - stepStart,
    credits_used: 0,
    stats_delta: { leads_created: convertedCount },
    toolcalls,
    artifacts: [],
    context_updates: { candidate_ids: candidateIds }
  };
}

// ---------------------------------------------------------------------------
// Handler 5: Launch Outreach (Campaign + Email)
// ---------------------------------------------------------------------------

export async function runOutreachStep(args: HandlerArgs, rexServer: any): Promise<StepOutcome> {
  const { run, runId, step, context } = args;
  const stepStart = Date.now();
  const toolcalls: any[] = [];
  const userId = String(run.user_id);

  const campaignId = context.campaign_id;
  if (!campaignId) {
    return {
      status: 'failure',
      progress: { percent: 100, label: 'No campaign' },
      results: { summary: 'No campaign available for outreach. Source leads first to create a campaign.' },
      errors: [{ code: 'no_campaign', message: 'No campaign_id in run context.' }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls: [],
      artifacts: []
    };
  }

  publishProgress(runId, step.step_id, 10, 'Preparing outreach', 'Generating email template and scheduling campaign...');

  // Try send_campaign_email_auto
  const handler = getToolHandler(rexServer, 'send_campaign_email_auto');
  if (!handler) {
    return {
      status: 'failure',
      progress: { percent: 100, label: 'Failed' },
      results: { summary: 'send_campaign_email_auto tool not available.' },
      errors: [{ code: 'tool_not_found', message: 'send_campaign_email_auto handler missing' }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls: [],
      artifacts: []
    };
  }

  const tc = buildToolCall(runId, step.step_id, 'send_campaign_email_auto', 'Campaign Outreach');
  tc.input = { campaign_id: campaignId };
  toolcalls.push(tc);
  publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

  publishProgress(runId, step.step_id, 50, 'Sending outreach', 'Scheduling emails for campaign leads...');

  try {
    // Generate a subject/html based on job context
    const goal = run.plan_json?.goal || {};
    const jobTitle = context.job_title || goal.title || 'an exciting opportunity';

    const result = await handler({
      userId,
      campaign_id: campaignId,
      subject: `${jobTitle} — interested in connecting?`,
      html: `<p>Hi {{first_name}},</p><p>I came across your profile and thought you'd be a great fit for a <strong>${jobTitle}</strong> role we're working on.</p><p>Would you be open to a quick conversation this week?</p><p>Best,<br/>{{sender_name}}</p>`
    });

    const scheduled = result?.scheduled || result?.sent || 0;
    tc.status = 'success';
    tc.output = { scheduled, campaign_id: campaignId };
    tc.metrics = { duration_ms: Date.now() - stepStart, credits_used: Math.ceil(scheduled * 0.2) };
    tc.ui = { ...tc.ui, badge: 'Complete' };
    publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

    return {
      status: 'success',
      progress: { percent: 100, current: scheduled, total: Math.max(scheduled, 1), label: 'Complete' },
      results: { summary: `Outreach launched. ${scheduled} emails scheduled for campaign.`, metrics: { scheduled } },
      errors: [],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: Math.ceil(scheduled * 0.2),
      stats_delta: { messages_scheduled: scheduled },
      toolcalls,
      artifacts: []
    };
  } catch (e: any) {
    tc.status = 'failure';
    tc.errors = [{ code: 'outreach_failed', message: String(e?.message || e) }];
    tc.ui = { ...tc.ui, badge: 'Failed' };
    publishRex2Event(buildRex2Event(runId, 'toolcall.logged', { toolcall: tc }));

    return {
      status: 'failure',
      progress: { percent: 100, label: 'Failed' },
      results: { summary: `Outreach failed: ${e?.message || e}` },
      errors: [{ code: 'outreach_failed', message: String(e?.message || e) }],
      external_refs: [],
      duration_ms: Date.now() - stepStart,
      credits_used: 0,
      toolcalls,
      artifacts: []
    };
  }
}

// ---------------------------------------------------------------------------
// Handler 6: Create Artifacts (Summary / Fallback)
// ---------------------------------------------------------------------------

export async function runArtifactsStep(args: HandlerArgs, _rexServer: any): Promise<StepOutcome> {
  const { run, runId, step, context } = args;
  const stepStart = Date.now();

  publishProgress(runId, step.step_id, 30, 'Generating summary', 'Compiling run results...');

  await sleep(300);

  const artifacts: any[] = [];
  const metrics: Record<string, any> = {};

  // Summarize what happened
  const leadCount = context.lead_ids?.length || 0;
  const enrichedCount = context.enriched_leads?.length || 0;
  const scoredCount = context.scored_leads?.length || 0;
  const candidateCount = context.candidate_ids?.length || 0;
  const avgScore = scoredCount
    ? Math.round(context.scored_leads.reduce((sum, s) => sum + (s.score || 0), 0) / scoredCount)
    : 0;

  metrics.leads_sourced = leadCount;
  metrics.profiles_enriched = enrichedCount;
  metrics.candidates_scored = scoredCount;
  metrics.candidates_converted = candidateCount;
  if (avgScore) metrics.avg_score = avgScore;
  if (context.job_id) metrics.job_id = context.job_id;
  if (context.campaign_id) metrics.campaign_id = context.campaign_id;

  publishProgress(runId, step.step_id, 70, 'Building artifacts', 'Creating summary...');

  // Build summary artifact
  const summaryParts = [];
  if (leadCount) summaryParts.push(`${leadCount} leads sourced`);
  if (enrichedCount) summaryParts.push(`${enrichedCount} enriched`);
  if (scoredCount) summaryParts.push(`${scoredCount} scored (avg ${avgScore}/100)`);
  if (candidateCount) summaryParts.push(`${candidateCount} converted to candidates`);
  if (context.job_id) summaryParts.push(`added to job pipeline`);

  const summaryText = summaryParts.length
    ? `Run complete: ${summaryParts.join(' → ')}.`
    : 'Run complete.';

  artifacts.push({
    artifact_id: `${runId}:artifact:summary`,
    type: 'summary',
    title: 'Run Summary',
    description: summaryText,
    status: 'complete',
    created_at: new Date().toISOString(),
    refs: {
      campaign_id: context.campaign_id || null,
      job_id: context.job_id || null
    },
    preview: { kind: 'text', data: { summary: summaryText } },
    actions: [],
    meta: metrics
  });

  // If job context, create pipeline artifact
  if (context.job_id && candidateCount) {
    artifacts.push({
      artifact_id: `${runId}:artifact:pipeline`,
      type: 'pipeline',
      title: `Pipeline: ${context.job_title || 'Job'}`,
      description: `${candidateCount} candidates added to job pipeline.`,
      status: 'complete',
      created_at: new Date().toISOString(),
      refs: { job_id: context.job_id, pipeline_id: context.pipeline_id || null },
      preview: { kind: 'text', data: { summary: `${candidateCount} candidates in pipeline.` } },
      actions: [],
      meta: {}
    });
  }

  return {
    status: 'success',
    progress: { percent: 100, current: 1, total: 1, label: 'Complete' },
    results: { summary: summaryText, metrics },
    errors: [],
    external_refs: [],
    duration_ms: Date.now() - stepStart,
    credits_used: 0,
    stats_delta: {},
    toolcalls: [],
    artifacts
  };
}
