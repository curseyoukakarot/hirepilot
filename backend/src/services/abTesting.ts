import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabaseAdmin';

// ── Types ──

export interface Variant {
  id: string;
  step_id: string;
  label: string;
  subject: string;
  body: string;
  weight: number;
  is_winner: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface VariantMetrics {
  variant_id: string;
  label: string;
  weight: number;
  is_winner: boolean;
  sent: number;
  opened: number;
  replied: number;
  clicked: number;
  bounced: number;
  open_rate: number;
  reply_rate: number;
  click_rate: number;
}

export interface WinnerResult {
  variant_id: string;
  label: string;
  rate: number;
  metric: string;
  confidence: number;
}

export interface AbTest {
  id: string;
  sequence_id: string;
  step_id: string;
  status: 'active' | 'completed' | 'paused';
  primary_metric: string;
  min_sends_per_variant: number;
  winner_variant_id: string | null;
  auto_promoted_at: string | null;
  created_by: string | null;
}

// ── Variant Assignment ──

/**
 * Deterministic variant assignment using hash-based bucketing.
 * Same lead + step always gets the same variant (stable across retries).
 * Respects weight distribution across active variants.
 */
export function assignVariant(leadId: string, stepId: string, variants: Variant[]): Variant | null {
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];

  // Winner takes all
  const winner = variants.find(v => v.is_winner);
  if (winner) return winner;

  // Deterministic hash → bucket 0-99
  const hash = crypto.createHash('md5').update(`${leadId}:${stepId}`).digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;

  // Sort by label for stable ordering, then accumulate weights
  const sorted = [...variants].sort((a, b) => a.label.localeCompare(b.label));
  const totalWeight = sorted.reduce((sum, v) => sum + v.weight, 0);

  let cumulative = 0;
  for (const v of sorted) {
    cumulative += (v.weight / totalWeight) * 100;
    if (bucket < cumulative) return v;
  }

  // Fallback to last variant (rounding edge case)
  return sorted[sorted.length - 1];
}

// ── DB Queries ──

/**
 * Fetch active variants for a step.
 * If a winner has been promoted, returns ONLY the winner.
 * Returns empty array if no A/B test exists for this step.
 */
export async function getActiveVariants(stepId: string): Promise<Variant[]> {
  const { data } = await supabaseAdmin
    .from('sequence_step_variants')
    .select('*')
    .eq('step_id', stepId)
    .eq('is_active', true)
    .order('label', { ascending: true });

  if (!data?.length) return [];

  // If a winner exists, return only the winner
  const winner = (data as Variant[]).find(v => v.is_winner);
  if (winner) return [winner];

  return data as Variant[];
}

/**
 * Get per-variant performance metrics by aggregating email_events.
 */
export async function getVariantMetrics(abTestId: string): Promise<VariantMetrics[]> {
  // 1. Get the test to find step_id
  const { data: test } = await supabaseAdmin
    .from('ab_tests')
    .select('step_id')
    .eq('id', abTestId)
    .single();

  if (!test) return [];

  // 2. Get all variants for this step
  const { data: variants } = await supabaseAdmin
    .from('sequence_step_variants')
    .select('id, label, weight, is_winner')
    .eq('step_id', (test as any).step_id);

  if (!variants?.length) return [];

  // 3. Get variant IDs
  const variantIds = variants.map((v: any) => v.id);

  // 4. Aggregate email_events per variant
  const { data: events } = await supabaseAdmin
    .from('email_events')
    .select('variant_id, event_type, message_id')
    .in('variant_id', variantIds);

  // 5. Build metrics per variant
  const metricsMap = new Map<string, { sent: Set<string>; opened: Set<string>; replied: Set<string>; clicked: Set<string>; bounced: Set<string> }>();

  for (const v of variants as any[]) {
    metricsMap.set(v.id, { sent: new Set(), opened: new Set(), replied: new Set(), clicked: new Set(), bounced: new Set() });
  }

  for (const e of (events || []) as any[]) {
    const m = metricsMap.get(e.variant_id);
    if (!m || !e.message_id) continue;
    switch (e.event_type) {
      case 'sent': m.sent.add(e.message_id); break;
      case 'open': m.opened.add(e.message_id); break;
      case 'reply': m.replied.add(e.message_id); break;
      case 'click': m.clicked.add(e.message_id); break;
      case 'bounce': m.bounced.add(e.message_id); break;
    }
  }

  return variants.map((v: any) => {
    const m = metricsMap.get(v.id)!;
    const sent = m.sent.size;
    return {
      variant_id: v.id,
      label: v.label,
      weight: v.weight,
      is_winner: v.is_winner,
      sent,
      opened: m.opened.size,
      replied: m.replied.size,
      clicked: m.clicked.size,
      bounced: m.bounced.size,
      open_rate: sent > 0 ? Math.round((m.opened.size / sent) * 10000) / 100 : 0,
      reply_rate: sent > 0 ? Math.round((m.replied.size / sent) * 10000) / 100 : 0,
      click_rate: sent > 0 ? Math.round((m.clicked.size / sent) * 10000) / 100 : 0
    };
  });
}

// ── Winner Detection ──

/**
 * Detect if any variant is a statistically significant winner.
 * Uses a z-test for proportions with 90% confidence (z > 1.645).
 * Also requires >10% relative improvement to declare a winner.
 */
export function detectWinner(
  metrics: VariantMetrics[],
  minSends: number,
  primaryMetric: string = 'reply_rate'
): WinnerResult | null {
  if (metrics.length < 2) return null;

  // Check all variants have enough data
  if (metrics.some(m => m.sent < minSends)) return null;

  // Extract the primary rate for each variant
  const getRate = (m: VariantMetrics): number => {
    switch (primaryMetric) {
      case 'reply_rate': return m.sent > 0 ? m.replied / m.sent : 0;
      case 'open_rate': return m.sent > 0 ? m.opened / m.sent : 0;
      case 'click_rate': return m.sent > 0 ? m.clicked / m.sent : 0;
      default: return m.sent > 0 ? m.replied / m.sent : 0;
    }
  };

  const getSuccessCount = (m: VariantMetrics): number => {
    switch (primaryMetric) {
      case 'reply_rate': return m.replied;
      case 'open_rate': return m.opened;
      case 'click_rate': return m.clicked;
      default: return m.replied;
    }
  };

  // Find the best performing variant
  let bestIdx = 0;
  let bestRate = getRate(metrics[0]);
  for (let i = 1; i < metrics.length; i++) {
    const r = getRate(metrics[i]);
    if (r > bestRate) {
      bestRate = r;
      bestIdx = i;
    }
  }

  const best = metrics[bestIdx];

  // Compare best against all others — must beat ALL by >10% relative + z > 1.645
  for (let i = 0; i < metrics.length; i++) {
    if (i === bestIdx) continue;
    const other = metrics[i];
    const otherRate = getRate(other);

    // Require >10% relative improvement
    if (otherRate > 0 && (bestRate - otherRate) / otherRate < 0.10) return null;

    // Z-test for proportions
    const n1 = best.sent;
    const n2 = other.sent;
    const s1 = getSuccessCount(best);
    const s2 = getSuccessCount(other);
    const pooledP = (s1 + s2) / (n1 + n2);
    if (pooledP <= 0 || pooledP >= 1) continue;

    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));
    if (se === 0) continue;

    const z = (bestRate - otherRate) / se;
    if (z < 1.645) return null; // Not significant at 90% confidence
  }

  return {
    variant_id: best.variant_id,
    label: best.label,
    rate: bestRate,
    metric: primaryMetric,
    confidence: 90
  };
}

// ── Variant Promotion ──

/**
 * Promote a winning variant: set is_winner=true, deactivate losers,
 * update the ab_tests record to completed.
 */
export async function promoteVariant(testId: string, variantId: string): Promise<void> {
  // 1. Get the test
  const { data: test } = await supabaseAdmin
    .from('ab_tests')
    .select('step_id')
    .eq('id', testId)
    .single();

  if (!test) throw new Error('A/B test not found');

  const now = new Date().toISOString();

  // 2. Set winner
  await supabaseAdmin
    .from('sequence_step_variants')
    .update({ is_winner: true, updated_at: now })
    .eq('id', variantId);

  // 3. Deactivate losers
  await supabaseAdmin
    .from('sequence_step_variants')
    .update({ is_active: false, updated_at: now })
    .eq('step_id', (test as any).step_id)
    .neq('id', variantId);

  // 4. Complete the test
  await supabaseAdmin
    .from('ab_tests')
    .update({
      status: 'completed',
      winner_variant_id: variantId,
      auto_promoted_at: now,
      updated_at: now
    })
    .eq('id', testId);
}

/**
 * Create an A/B test for a sequence step.
 * Variant A = existing step content, Variant B = provided alternative.
 */
export async function createAbTest(params: {
  userId: string;
  sequenceId: string;
  stepId: string;
  variantBSubject: string;
  variantBBody: string;
  primaryMetric?: string;
  minSends?: number;
}): Promise<{ test_id: string; variant_a_id: string; variant_b_id: string }> {
  // 1. Fetch the existing step content for Variant A
  const { data: step } = await supabaseAdmin
    .from('message_sequence_steps')
    .select('subject, body')
    .eq('id', params.stepId)
    .single();

  if (!step) throw new Error('Step not found');

  // 2. Create Variant A (from existing step)
  const { data: varA } = await supabaseAdmin
    .from('sequence_step_variants')
    .insert({
      step_id: params.stepId,
      label: 'A',
      subject: (step as any).subject,
      body: (step as any).body,
      weight: 50,
      is_winner: false,
      is_active: true
    })
    .select('id')
    .single();

  // 3. Create Variant B (provided alternative)
  const { data: varB } = await supabaseAdmin
    .from('sequence_step_variants')
    .insert({
      step_id: params.stepId,
      label: 'B',
      subject: params.variantBSubject,
      body: params.variantBBody,
      weight: 50,
      is_winner: false,
      is_active: true
    })
    .select('id')
    .single();

  // 4. Create ab_tests record
  const { data: test } = await supabaseAdmin
    .from('ab_tests')
    .insert({
      sequence_id: params.sequenceId,
      step_id: params.stepId,
      status: 'active',
      primary_metric: params.primaryMetric || 'reply_rate',
      min_sends_per_variant: params.minSends || 50,
      created_by: params.userId
    })
    .select('id')
    .single();

  return {
    test_id: (test as any).id,
    variant_a_id: (varA as any).id,
    variant_b_id: (varB as any).id
  };
}
