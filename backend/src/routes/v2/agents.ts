/**
 * v2 — /api/v2/agents
 * CRUD for hired specialist agents within a workspace.
 *
 * GET    /api/v2/agents                        list agents in active workspace (with skills)
 * GET    /api/v2/agents/:id                    one agent + its skills
 * POST   /api/v2/agents                        hire a new specialist (auto-installs default skills)
 * PATCH  /api/v2/agents/:id                    update trust_level / paused / display_name / config
 * DELETE /api/v2/agents/:id                    fire the agent (cascades agent_skills)
 *
 * POST   /api/v2/agents/:id/skills             install a skill on this agent
 * PATCH  /api/v2/agents/:id/skills/:skillId    update enabled / schedule_cron / config
 * DELETE /api/v2/agents/:id/skills/:skillId    uninstall a skill
 *
 * Auth: requireAuth + activeWorkspace.
 * Mutating ops require workspaceRole IN ('owner','admin').
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const VALID_ROLES = [
  'sourcer',
  'recruiter',
  'coordinator',
  'researcher',
  'business_dev',
  'closer',
  'account_manager',
  'reference_checker'
] as const;

const VALID_TRUST = ['manual', 'suggest', 'autopilot'] as const;

const ADMIN_ROLES = new Set(['owner', 'admin']);

function requireWorkspaceAdmin(req: Request, res: Response): boolean {
  const role = String((req as any).workspaceRole || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    res.status(403).json({ error: 'workspace_admin_required' });
    return false;
  }
  return true;
}

function getWorkspaceId(req: Request, res: Response): string | null {
  const wsId = (req as any).workspaceId;
  if (!wsId) {
    res.status(400).json({ error: 'no_active_workspace' });
    return null;
  }
  return String(wsId);
}

// ====================================================================
// GET /api/v2/agents — list agents (with skills) in the active workspace
// ====================================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;

    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, workspace_id, role, display_name, trust_level, paused, hired_by, hired_at, config')
      .eq('workspace_id', workspaceId)
      .order('hired_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const agentIds = (agents || []).map((a: any) => a.id);
    let skillsByAgent: Record<string, any[]> = {};

    if (agentIds.length) {
      const { data: skills, error: skillsErr } = await supabase
        .from('agent_skills')
        .select('agent_id, skill_id, enabled, schedule_cron, config, installed_at, last_run_at, skills_catalog ( id, name, description, category, integration_id, agent_role, icon, schedule_capable )')
        .in('agent_id', agentIds);

      if (skillsErr) {
        return res.status(500).json({ error: skillsErr.message });
      }

      for (const row of skills || []) {
        const agentId = String((row as any).agent_id);
        if (!skillsByAgent[agentId]) skillsByAgent[agentId] = [];
        skillsByAgent[agentId].push(row);
      }
    }

    return res.json({
      agents: (agents || []).map((a: any) => ({
        ...a,
        skills: skillsByAgent[a.id] || []
      }))
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'list_agents_failed' });
  }
});

// ====================================================================
// GET /api/v2/agents/:id
// ====================================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;

    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, workspace_id, role, display_name, trust_level, paused, hired_by, hired_at, config')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!agent) return res.status(404).json({ error: 'agent_not_found' });

    const { data: skills } = await supabase
      .from('agent_skills')
      .select('agent_id, skill_id, enabled, schedule_cron, config, installed_at, last_run_at, skills_catalog ( id, name, description, category, integration_id, agent_role, icon, schedule_capable )')
      .eq('agent_id', agent.id);

    return res.json({ agent: { ...agent, skills: skills || [] } });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'get_agent_failed' });
  }
});

// ====================================================================
// POST /api/v2/agents — hire a specialist
// Body: { role, display_name?, trust_level? }
// ====================================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;
    if (!requireWorkspaceAdmin(req, res)) return;

    const { role, display_name, trust_level } = req.body || {};
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role', valid_roles: VALID_ROLES });
    }
    if (trust_level && !VALID_TRUST.includes(trust_level)) {
      return res.status(400).json({ error: 'invalid_trust_level' });
    }

    const userId = (req as any)?.user?.id || null;

    // Pull the workspace's default trust level if the request didn't specify one.
    // team_settings is keyed off team_id; resolve via users.team_id.
    let resolvedTrust = trust_level || 'suggest';
    if (!trust_level) {
      try {
        let teamId: string | null = null;
        const { data: userRow } = await supabase
          .from('users')
          .select('team_id')
          .eq('id', userId)
          .maybeSingle();
        teamId = (userRow as any)?.team_id || null;
        if (teamId) {
          const { data: ts } = await supabase
            .from('team_settings')
            .select('default_trust_level')
            .eq('team_id', teamId)
            .maybeSingle();
          if ((ts as any)?.default_trust_level) {
            resolvedTrust = (ts as any).default_trust_level;
          }
        }
      } catch {}
    }

    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        workspace_id: workspaceId,
        role,
        display_name: display_name || null,
        trust_level: resolvedTrust,
        hired_by: userId
      })
      .select('id, workspace_id, role, display_name, trust_level, paused, hired_by, hired_at, config')
      .single();

    if (error) {
      // Unique constraint on (workspace_id, role) → already hired
      if ((error as any).code === '23505') {
        return res.status(409).json({ error: 'already_hired', message: `${role} is already on the team.` });
      }
      return res.status(500).json({ error: error.message });
    }

    // Auto-install default skills for this role
    const { data: defaultSkills } = await supabase
      .from('skills_catalog')
      .select('id')
      .eq('agent_role', role)
      .eq('default_installed', true);

    if (defaultSkills && defaultSkills.length) {
      const rows = defaultSkills.map((s: any) => ({ agent_id: agent.id, skill_id: s.id }));
      await supabase.from('agent_skills').insert(rows);
    }

    // Re-fetch with skills attached
    const { data: skills } = await supabase
      .from('agent_skills')
      .select('agent_id, skill_id, enabled, schedule_cron, config, installed_at, last_run_at, skills_catalog ( id, name, description, category, integration_id, agent_role, icon, schedule_capable )')
      .eq('agent_id', agent.id);

    try {
      const { logActivity } = await import('../../rex/activityLog');
      await logActivity({
        workspaceId,
        userId,
        agentId: agent.id,
        agentRole: role,
        eventType: 'agent_hired',
        summary: `Hired ${role}${display_name ? ` (${display_name})` : ''}`,
        detail: { trust_level: resolvedTrust },
      });
    } catch {}

    return res.status(201).json({ agent: { ...agent, skills: skills || [] } });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'hire_agent_failed' });
  }
});

// ====================================================================
// PATCH /api/v2/agents/:id
// Body: { trust_level?, paused?, display_name?, config? }
// ====================================================================
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;
    if (!requireWorkspaceAdmin(req, res)) return;

    const { trust_level, paused, display_name, config } = req.body || {};
    const updates: Record<string, any> = {};

    if (trust_level !== undefined) {
      if (!VALID_TRUST.includes(trust_level)) {
        return res.status(400).json({ error: 'invalid_trust_level' });
      }
      updates.trust_level = trust_level;
    }
    if (paused !== undefined) updates.paused = !!paused;
    if (display_name !== undefined) updates.display_name = display_name || null;
    if (config !== undefined) updates.config = config;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'no_updates_provided' });
    }

    const { data: agent, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select('id, workspace_id, role, display_name, trust_level, paused, hired_by, hired_at, config')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!agent) return res.status(404).json({ error: 'agent_not_found' });

    if (trust_level !== undefined) {
      try {
        const { logActivity } = await import('../../rex/activityLog');
        await logActivity({
          workspaceId,
          userId: (req as any)?.user?.id,
          agentId: agent.id,
          agentRole: (agent as any).role,
          eventType: 'agent_trust_changed',
          summary: `${(agent as any).role} trust level changed to ${trust_level}`,
          detail: { trust_level },
        });
      } catch {}
    }

    return res.json({ agent });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'update_agent_failed' });
  }
});

// ====================================================================
// DELETE /api/v2/agents/:id — fire the agent
// ====================================================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;
    if (!requireWorkspaceAdmin(req, res)) return;

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'fire_agent_failed' });
  }
});

// ====================================================================
// POST /api/v2/agents/:id/skills — install a skill on this agent
// Body: { skill_id, schedule_cron?, config? }
// ====================================================================
router.post('/:id/skills', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;
    if (!requireWorkspaceAdmin(req, res)) return;

    const { skill_id, schedule_cron, config } = req.body || {};
    if (!skill_id) return res.status(400).json({ error: 'skill_id_required' });

    // Verify agent in workspace
    const { data: agent } = await supabase
      .from('agents')
      .select('id, role')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!agent) return res.status(404).json({ error: 'agent_not_found' });

    // Verify skill exists and matches role
    const { data: skill } = await supabase
      .from('skills_catalog')
      .select('id, agent_role')
      .eq('id', skill_id)
      .maybeSingle();
    if (!skill) return res.status(404).json({ error: 'skill_not_found' });
    if ((skill as any).agent_role !== (agent as any).role) {
      return res.status(400).json({ error: 'skill_role_mismatch', expected: (agent as any).role });
    }

    const { data: row, error } = await supabase
      .from('agent_skills')
      .insert({
        agent_id: agent.id,
        skill_id,
        schedule_cron: schedule_cron || null,
        config: config || {}
      })
      .select('agent_id, skill_id, enabled, schedule_cron, config, installed_at, last_run_at')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        return res.status(409).json({ error: 'skill_already_installed' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ skill: row });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'install_skill_failed' });
  }
});

// ====================================================================
// PATCH /api/v2/agents/:id/skills/:skillId
// Body: { enabled?, schedule_cron?, config? }
// ====================================================================
router.patch('/:id/skills/:skillId', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;
    if (!requireWorkspaceAdmin(req, res)) return;

    const { enabled, schedule_cron, config } = req.body || {};
    const updates: Record<string, any> = {};
    if (enabled !== undefined) updates.enabled = !!enabled;
    if (schedule_cron !== undefined) updates.schedule_cron = schedule_cron || null;
    if (config !== undefined) updates.config = config;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'no_updates_provided' });
    }

    // Verify the agent is in this workspace
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!agent) return res.status(404).json({ error: 'agent_not_found' });

    const { data: row, error } = await supabase
      .from('agent_skills')
      .update(updates)
      .eq('agent_id', agent.id)
      .eq('skill_id', req.params.skillId)
      .select('agent_id, skill_id, enabled, schedule_cron, config, installed_at, last_run_at')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!row) return res.status(404).json({ error: 'skill_not_installed' });
    return res.json({ skill: row });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'update_skill_failed' });
  }
});

// ====================================================================
// DELETE /api/v2/agents/:id/skills/:skillId
// ====================================================================
router.delete('/:id/skills/:skillId', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;
    if (!requireWorkspaceAdmin(req, res)) return;

    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!agent) return res.status(404).json({ error: 'agent_not_found' });

    const { error } = await supabase
      .from('agent_skills')
      .delete()
      .eq('agent_id', agent.id)
      .eq('skill_id', req.params.skillId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'uninstall_skill_failed' });
  }
});

// ====================================================================
// POST /api/v2/agents/:id/skills/:skillId/invoke
// Directly invoke a Skill on a hired specialist (UI buttons → here).
// Same code path as REX's hp_invoke_skill, just exposed over HTTP.
// Body: { input?: object }
// ====================================================================
router.post('/:id/skills/:skillId/invoke', async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req, res);
    if (!workspaceId) return;
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    // Verify agent is in this workspace + grab its role
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, role, paused')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (agentErr) return res.status(500).json({ error: agentErr.message });
    if (!agent) return res.status(404).json({ error: 'agent_not_found' });
    if ((agent as any).paused) return res.status(409).json({ error: 'agent_paused' });

    // Verify skill is installed
    const { data: installed } = await supabase
      .from('agent_skills')
      .select('skill_id')
      .eq('agent_id', agent.id)
      .eq('skill_id', req.params.skillId)
      .maybeSingle();
    if (!installed) return res.status(404).json({ error: 'skill_not_installed' });

    // Load context + handler
    const { loadAgentContext } = await import('../../rex/agentLoader');
    const { getSkillHandler } = await import('../../rex/skills/registry');
    const ctx = await loadAgentContext(workspaceId, userId, (agent as any).role);
    if (!ctx) return res.status(404).json({ error: 'agent_context_unavailable' });

    const handler = getSkillHandler(req.params.skillId);
    if (!handler) return res.status(404).json({ error: 'no_handler_registered' });

    const result = await handler(req.body?.input || {}, ctx);

    // Bump last_run_at regardless of held/executed.
    await supabase
      .from('agent_skills')
      .update({ last_run_at: new Date().toISOString() })
      .eq('agent_id', agent.id)
      .eq('skill_id', req.params.skillId);

    // Log to the activity feed so this surfaces on Today + Team.
    try {
      const { logActivity, skillLabel } = await import('../../rex/activityLog');
      const sLabel = skillLabel(req.params.skillId);
      const role = (agent as any).role;
      const summary = result?.held
        ? `${role} held ${sLabel} for review`
        : result?.ok === false
          ? `${role} failed ${sLabel}`
          : `${role} ran ${sLabel}`;
      await logActivity({
        workspaceId,
        userId,
        agentId: agent.id,
        agentRole: role,
        eventType: result?.held ? 'skill_held' : (result?.ok === false ? 'skill_failed' : 'skill_executed'),
        skillId: req.params.skillId,
        summary,
        detail: { invokedFrom: 'ui' },
      });
    } catch {}

    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'invoke_skill_failed' });
  }
});

export default router;
