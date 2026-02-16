import express, { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { supabase as supabaseClient, supabaseAdmin, supabaseDb as supabaseDbClient } from '../lib/supabase';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const SETTINGS_KEY = 'rex2_agents_catalog';
const ADMIN_ROLES = new Set(['super_admin', 'superadmin', 'admin', 'team_admin', 'team_admins']);

type AgentStatus = 'active' | 'running' | 'idle';
type AgentProfile = {
  id: string;
  name: string;
  subtitle: string;
  status: AgentStatus;
  icon: string;
  iconBg: string;
  iconColor: string;
  links: string[];
  capabilities: string[];
  guides: string[];
  recipes: string[];
  instructions: string[];
};

const defaultAgents: AgentProfile[] = [
  {
    id: 'sourcing_agent',
    name: 'Sourcing Agent',
    subtitle: 'Personas, schedules, and Sniper sourcing',
    status: 'active',
    icon: 'fa-magnifying-glass',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    links: [
      'https://app.thehirepilot.com/agent/advanced/personas',
      'https://app.thehirepilot.com/agent/advanced/schedules',
      'https://app.thehirepilot.com/sniper'
    ],
    capabilities: [
      'Translate hiring goals into persona and search plans',
      'Run linked sourcing workflows across LinkedIn, Indeed, and Sniper',
      'Schedule recurring sourcing cadences with dependency-aware execution',
      'Generate candidate shortlists, prioritization notes, and handoff artifacts'
    ],
    guides: [
      'Start with role + geo + seniority + must-have skills',
      'Set source mix strategy: broad (Indeed) + precision (LinkedIn)',
      'Use minimum-results thresholds with retry/backoff policy',
      'Publish artifacts as candidate profiles and quality summaries'
    ],
    recipes: [
      'Recipe: Build 3 sourcing personas, run parallel discovery, merge by score',
      'Recipe: Source 100 profiles, enrich top 40, deliver top 15 shortlist',
      'Recipe: Run daily sniper capture and weekly quality refresh'
    ],
    instructions: [
      'Prefer concrete filters and explicit source targets',
      'Always include output counts and quality caveats',
      'When blocked, propose fallback source strategy instead of stopping'
    ]
  },
  {
    id: 'sales_agent',
    name: 'Sales Agent',
    subtitle: 'Campaign orchestration and inbox execution',
    status: 'active',
    icon: 'fa-chart-line',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    links: [
      'https://app.thehirepilot.com/agent/advanced/campaigns',
      'https://app.thehirepilot.com/agent/advanced/inbox'
    ],
    capabilities: [
      'Design outbound campaign plans and sequence structures',
      'Map intent segments to message variants and CTA paths',
      'Optimize inbox triage and response playbooks',
      'Track campaign conversion signals and propose iteration loops'
    ],
    guides: [
      'Define ICP + value hypothesis before drafting sequences',
      'Split campaign by persona and stage-aware objection handling',
      'Include inbox handling rules for reply categories',
      'Summarize expected KPIs, risks, and tuning checkpoints'
    ],
    recipes: [
      'Recipe: 3-touch outbound sequence with persona-specific variants',
      'Recipe: Build campaign + inbox triage matrix + next-step actions',
      'Recipe: Weekly campaign optimization loop from reply signals'
    ],
    instructions: [
      'Keep messaging specific, measurable, and persona-aware',
      'Show assumptions and expected conversion trade-offs',
      'When uncertain, ask for offer positioning and audience constraints'
    ]
  }
];

const agentSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  subtitle: z.string().min(1).max(240),
  status: z.enum(['active', 'running', 'idle']),
  icon: z.string().min(1).max(64),
  iconBg: z.string().min(1).max(64),
  iconColor: z.string().min(1).max(64),
  links: z.array(z.string().url()).max(20),
  capabilities: z.array(z.string().min(1).max(240)).max(30),
  guides: z.array(z.string().min(1).max(240)).max(30),
  recipes: z.array(z.string().min(1).max(240)).max(30),
  instructions: z.array(z.string().min(1).max(240)).max(30)
});

const catalogSchema = z.object({
  agents: z.array(agentSchema).min(1).max(10)
});

function getDb() {
  const db = (supabaseDbClient as any) || (supabaseAdmin as any) || (supabaseClient as any);
  if (!db || typeof db.from !== 'function') {
    throw new Error('supabase_db_client_unavailable');
  }
  return db;
}

async function resolveRequesterRole(req: Request): Promise<string> {
  const roleFromToken = String((req as any)?.user?.role || '').toLowerCase();
  if (roleFromToken) return roleFromToken;
  const userId = String((req as any)?.user?.id || '').trim();
  if (!userId) return '';
  try {
    const { data } = await getDb().from('users').select('role').eq('id', userId).maybeSingle();
    return String((data as any)?.role || '').toLowerCase();
  } catch {
    return '';
  }
}

async function loadAgentCatalog() {
  const { data, error } = await getDb()
    .from('system_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message || 'failed_to_load_rex2_agents');
  const value = (data as any)?.value;
  const parsed = catalogSchema.safeParse(
    Array.isArray(value) ? { agents: value } : value
  );
  if (!parsed.success) {
    return { agents: defaultAgents, source: 'default' as const };
  }
  return { agents: parsed.data.agents, source: 'system_settings' as const };
}

// GET /api/rex2/agents
router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const catalog = await loadAgentCatalog();
    return res.json(catalog);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_load_rex2_agents' });
  }
});

// PUT /api/rex2/agents  (admin/team_admin/super_admin)
router.put('/agents', async (req: Request, res: Response) => {
  try {
    const requesterRole = await resolveRequesterRole(req);
    if (!ADMIN_ROLES.has(requesterRole)) {
      return res.status(403).json({ error: 'forbidden_admin_only' });
    }
    const parsed = catalogSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const payload = {
      key: SETTINGS_KEY,
      value: { agents: parsed.data.agents },
      updated_at: new Date().toISOString()
    };
    const { error } = await getDb()
      .from('system_settings')
      .upsert(payload as any, { onConflict: 'key' });
    if (error) return res.status(500).json({ error: error.message || 'failed_to_save_rex2_agents' });
    return res.json({ ok: true, agents: parsed.data.agents });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_save_rex2_agents' });
  }
});

export default router;

