import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

type WorkspaceMembership = {
  workspace_id: string;
  role: string | null;
  status: string | null;
  created_at?: string | null;
  workspaces?: {
    id?: string;
    name?: string | null;
    plan?: string | null;
    seat_count?: number | null;
  } | null;
};

const WORKSPACES_ENABLED = String(process.env.WORKSPACES_ENABLED || 'false').toLowerCase() === 'true';

function isJobSeekerRole(role: any): boolean {
  const r = String(role || '').toLowerCase();
  return r.startsWith('job_seeker');
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceMembership[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, status, created_at, workspaces (id, name, plan, seat_count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data || []) as WorkspaceMembership[];
}

export async function assertWorkspaceMember(userId: string, workspaceId: string): Promise<{ ok: boolean; role?: string | null }> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, status')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error || !data) return { ok: false };
  if (String((data as any).status || '').toLowerCase() !== 'active') return { ok: false };
  return { ok: true, role: (data as any).role ?? null };
}

async function ensureDefaultWorkspace(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('ensure_default_workspace_for_user', { p_user_id: userId });
    if (error) return null;
    return data as string | null;
  } catch {
    return null;
  }
}

export async function activeWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    const role = (req as any)?.user?.role;
    if (!userId) return next();
    if (isJobSeekerRole(role)) return next();

    const headerWorkspaceId = String(req.headers['x-workspace-id'] || '').trim();
    const cookieWorkspaceId = String((req as any)?.cookies?.active_workspace_id || '').trim();
    const requestedWorkspaceId = headerWorkspaceId || cookieWorkspaceId || '';

    if (requestedWorkspaceId) {
      const membership = await assertWorkspaceMember(userId, requestedWorkspaceId);
      if (membership.ok) {
        (req as any).workspaceId = requestedWorkspaceId;
        (req as any).workspaceRole = membership.role || null;
        return next();
      }
      if (WORKSPACES_ENABLED) {
        const allowed = await getUserWorkspaces(userId);
        const allowedIds = allowed
          .filter((m) => String(m.status || '').toLowerCase() === 'active')
          .map((m) => String(m.workspace_id));
        return res.status(403).json({
          error: 'workspace_forbidden',
          allowed_workspace_ids: allowedIds
        });
      }
      // Feature flag off: ignore invalid header/cookie and fall through.
    }

    let memberships = await getUserWorkspaces(userId);
    let active = memberships.find((m) => String(m.status || '').toLowerCase() === 'active');

    if (!active) {
      const created = await ensureDefaultWorkspace(userId);
      if (created) {
        const m = await assertWorkspaceMember(userId, created);
        if (m.ok) {
          (req as any).workspaceId = created;
          (req as any).workspaceRole = m.role || null;
          return next();
        }
      }
      memberships = await getUserWorkspaces(userId);
      active = memberships.find((m) => String(m.status || '').toLowerCase() === 'active');
    }

    if (active?.workspace_id) {
      (req as any).workspaceId = String(active.workspace_id);
      (req as any).workspaceRole = active.role || null;
    }
    return next();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'workspace_resolver_failed' });
  }
}

export default activeWorkspace;
